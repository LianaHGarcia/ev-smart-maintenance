from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone

import websockets
from ocpp.v16 import ChargePoint as OcppChargePoint, call
from ocpp.v16.enums import ChargePointStatus, RegistrationStatus


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class SimulatedChargePoint(OcppChargePoint):
    async def boot(self, vendor: str, model: str) -> None:
        response = await self.call(
            call.BootNotificationPayload(
                charge_point_vendor=vendor,
                charge_point_model=model,
            )
        )
        if response.status != RegistrationStatus.accepted:
            raise RuntimeError(f"BootNotification rejected: {response.status}")

    async def heartbeat(self) -> None:
        await self.call(call.HeartbeatPayload())

    async def send_status(self, status: ChargePointStatus, error_code: str = "NoError") -> None:
        await self.call(
            call.StatusNotificationPayload(
                connector_id=1,
                error_code=error_code,
                status=status,
                timestamp=_iso_utc_now(),
            )
        )

    async def send_meter_values(self, voltage: float, current: float, power_kw: float, temperature: float) -> None:
        await self.call(
            call.MeterValuesPayload(
                connector_id=1,
                meter_value=[
                    {
                        "timestamp": _iso_utc_now(),
                        "sampledValue": [
                            {"measurand": "Voltage", "value": str(voltage)},
                            {"measurand": "Current.Import", "value": str(current)},
                            {"measurand": "Power.Active.Import", "value": str(power_kw)},
                            {"measurand": "Temperature", "value": str(temperature)},
                        ],
                    }
                ],
            )
        )


async def run_simulator(args: argparse.Namespace) -> None:
    websocket_url = f"{args.server.rstrip('/')}/{args.charge_point_id}"
    async with websockets.connect(websocket_url, subprotocols=["ocpp1.6"]) as websocket:
        charge_point = SimulatedChargePoint(args.charge_point_id, websocket)
        listener = asyncio.create_task(charge_point.start())
        try:
            print(f"Connected simulated charger {args.charge_point_id} to {websocket_url}")
            await charge_point.boot(args.vendor, args.model)
            await charge_point.send_status(ChargePointStatus.available)

            if args.mode == "fault":
                await charge_point.send_status(ChargePointStatus.faulted, error_code="ConnectorLockFailure")
            else:
                for _ in range(args.samples):
                    await charge_point.send_status(ChargePointStatus.charging)
                    await charge_point.send_meter_values(
                        voltage=args.voltage,
                        current=args.current,
                        power_kw=args.power,
                        temperature=args.temperature,
                    )
                    await charge_point.heartbeat()
                    await asyncio.sleep(args.interval)

                await charge_point.send_status(ChargePointStatus.available)

            print("Simulation complete")
        finally:
            listener.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await listener


if __name__ == "__main__":
    import contextlib

    parser = argparse.ArgumentParser(description="Simulate an OCPP 1.6 charger from a Raspberry Pi.")
    parser.add_argument("--server", default="ws://localhost:9000", help="OCPP websocket server URL without the charge point id suffix")
    parser.add_argument("--charge-point-id", default="pi-sim-01", help="Simulated charge point identifier")
    parser.add_argument("--vendor", default="RaspberryPi", help="Charge point vendor name")
    parser.add_argument("--model", default="OCPP-Sim", help="Charge point model name")
    parser.add_argument("--mode", choices=["charging", "fault"], default="charging", help="Simulation mode")
    parser.add_argument("--samples", type=int, default=10, help="Number of meter value samples to send")
    parser.add_argument("--interval", type=float, default=5.0, help="Seconds between charging samples")
    parser.add_argument("--voltage", type=float, default=404.0, help="Voltage value to send")
    parser.add_argument("--current", type=float, default=32.0, help="Current value to send")
    parser.add_argument("--power", type=float, default=11.5, help="Power value to send in kW")
    parser.add_argument("--temperature", type=float, default=37.0, help="Temperature value to send")
    asyncio.run(run_simulator(parser.parse_args()))