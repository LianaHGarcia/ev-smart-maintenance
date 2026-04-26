import logging
from datetime import datetime, timezone
from typing import Dict, List

from ocpp.routing import on
from ocpp.v16 import ChargePoint as OCPPChargePoint
from ocpp.v16 import call_result
from ocpp.v16.enums import Action, RegistrationStatus

from .api.websocket import sio
from .services.chargerService import charger_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _map_status(ocpp_status: str) -> str:
    mapped = {
        "Available": "online",
        "Preparing": "online",
        "Charging": "charging",
        "SuspendedEV": "online",
        "SuspendedEVSE": "online",
        "Finishing": "online",
        "Reserved": "online",
        "Unavailable": "offline",
        "Faulted": "fault",
    }
    return mapped.get(ocpp_status, "online")


def _extract_metrics(meter_value: List[Dict]) -> Dict[str, float]:
    metrics = {
        "voltage": 0.0,
        "current": 0.0,
        "power": 0.0,
        "temperature": 0.0,
    }
    for mv in meter_value or []:
        for sampled in mv.get("sampledValue", []):
            measurand = sampled.get("measurand", "")
            value_raw = sampled.get("value")
            try:
                value = float(value_raw)
            except (TypeError, ValueError):
                continue

            if measurand == "Voltage":
                metrics["voltage"] = value
            elif measurand == "Current.Import":
                metrics["current"] = value
            elif measurand in ("Power.Active.Import", "Power.Offered"):
                metrics["power"] = value
            elif measurand == "Temperature":
                metrics["temperature"] = value
    return metrics


class ChargePointHandler(OCPPChargePoint):
    def __init__(self, charge_point_id: str, connection) -> None:
        super().__init__(charge_point_id, connection)
        self.charge_point_id = charge_point_id

    async def _broadcast_update(self, payload: Dict[str, object]) -> None:
        await sio.emit("charger_updated", {"charger": payload})

    @on(Action.BootNotification)
    async def on_boot_notification(self, charge_point_vendor: str, charge_point_model: str, **kwargs):
        payload = charger_service.create_or_update_charger(
            {
                "charger_id": self.charge_point_id,
                "status": "online",
                "error_code": None,
            }
        )
        await self._broadcast_update(payload)

        logger.info("BootNotification from %s (%s/%s)", self.charge_point_id, charge_point_vendor, charge_point_model)
        return call_result.BootNotificationPayload(
            current_time=_iso_utc_now(),
            interval=30,
            status=RegistrationStatus.accepted,
        )

    @on(Action.Heartbeat)
    async def on_heartbeat(self):
        logger.debug("Heartbeat from %s", self.charge_point_id)
        return call_result.HeartbeatPayload(current_time=_iso_utc_now())

    @on(Action.StatusNotification)
    async def on_status_notification(
        self,
        connector_id: int,
        error_code: str,
        status: str,
        timestamp: str = None,
        **kwargs,
    ):
        service_status = _map_status(status)
        payload = charger_service.create_or_update_charger(
            {
                "charger_id": self.charge_point_id,
                "status": service_status,
                "error_code": None if error_code == "NoError" else error_code,
            }
        )
        await self._broadcast_update(payload)

        logger.info(
            "StatusNotification cp=%s connector=%s status=%s error=%s",
            self.charge_point_id,
            connector_id,
            status,
            error_code,
        )
        return call_result.StatusNotificationPayload()

    @on(Action.MeterValues)
    async def on_meter_values(self, connector_id: int, meter_value: List[Dict], **kwargs):
        metrics = _extract_metrics(meter_value)
        payload = charger_service.create_or_update_charger(
            {
                "charger_id": self.charge_point_id,
                "status": "charging",
                "voltage": metrics["voltage"],
                "current": metrics["current"],
                "power": metrics["power"],
                "temperature": metrics["temperature"],
            }
        )
        await self._broadcast_update(payload)
        logger.debug("MeterValues cp=%s connector=%s", self.charge_point_id, connector_id)
        return call_result.MeterValuesPayload()