from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock
from typing import Dict, List, Optional
from ..models.schemaValidation import ChargerStatus, ChargerStatusEnum


class ChargerService:
	def __init__(self) -> None:
		self._chargers: Dict[str, ChargerStatus] = {}
		self._lock = Lock()
		self._seed_data()

	def _seed_data(self) -> None:
		seed_chargers = [
			ChargerStatus(
				charger_id="Belinda Street",
				status=ChargerStatusEnum.CHARGING,
				last_updated=datetime.now(timezone.utc),
				voltage=402.0,
				current=118.0,
				power=47.4,
				temperature=41.0,
			),
			ChargerStatus(
				charger_id="Hopewell View",
				status=ChargerStatusEnum.ONLINE,
				last_updated=datetime.now(timezone.utc),
				voltage=398.0,
				current=0.0,
				power=0.0,
				temperature=34.5,
			),
			ChargerStatus(
				charger_id="Albion Street",
				status=ChargerStatusEnum.FAULT,
				last_updated=datetime.now(timezone.utc),
				voltage=0.0,
				current=0.0,
				power=0.0,
				temperature=29.8,
				error_code="ConnectorLockFailure",
				error_description="Connector lock did not engage during session start.",
			),
			ChargerStatus(
				charger_id="Mill Road",
				status=ChargerStatusEnum.CHARGING,
				last_updated=datetime.now(timezone.utc),
				voltage=405.5,
				current=96.2,
				power=39.1,
				temperature=38.6,
			),
			ChargerStatus(
				charger_id="Station Parade",
				status=ChargerStatusEnum.ONLINE,
				last_updated=datetime.now(timezone.utc),
				voltage=401.1,
				current=0.0,
				power=0.0,
				temperature=33.2,
			),
		]

		with self._lock:
			for charger in seed_chargers:
				self._chargers[charger.charger_id] = charger

	@staticmethod
	def _to_dict(charger: ChargerStatus) -> Dict[str, object]:
		return {
			"id": charger.charger_id,
			"status": charger.status.value,
			"voltage": charger.voltage,
			"current": charger.current,
			"power": charger.power,
			"temperature": charger.temperature,
			"errorCode": charger.error_code,
			"lastUpdated": charger.last_updated.isoformat(),
		}

	def list_chargers(self, status: Optional[str] = None) -> List[Dict[str, object]]:
		with self._lock:
			chargers = list(self._chargers.values())

		if status:
			normalized = status.strip().lower()
			chargers = [c for c in chargers if c.status.value == normalized]

		return [self._to_dict(c) for c in chargers]

	def get_charger(self, charger_id: str) -> Optional[Dict[str, object]]:
		with self._lock:
			charger = self._chargers.get(charger_id)
		if not charger:
			return None
		return self._to_dict(charger)

	def create_or_update_charger(self, payload: Dict[str, object]) -> Dict[str, object]:
		charger_id = str(payload.get("charger_id") or "").strip()
		if not charger_id:
			raise ValueError("charger_id is required")

		status_value = str(payload.get("status", ChargerStatusEnum.OFFLINE.value)).lower()
		try:
			status = ChargerStatusEnum(status_value)
		except ValueError as exc:
			allowed = ", ".join([s.value for s in ChargerStatusEnum])
			raise ValueError(f"Invalid status '{status_value}'. Allowed: {allowed}") from exc

		with self._lock:
			existing = self._chargers.get(charger_id)
			charger = ChargerStatus(
				charger_id=charger_id,
				status=status,
				last_updated=datetime.now(timezone.utc),
				voltage=float(payload.get("voltage", existing.voltage if existing else 0.0)),
				current=float(payload.get("current", existing.current if existing else 0.0)),
				power=float(payload.get("power", existing.power if existing else 0.0)),
				temperature=float(payload.get("temperature", existing.temperature if existing else 0.0)),
				error_code=(
					str(payload["error_code"])
					if payload.get("error_code") is not None
					else (existing.error_code if existing else None)
				),
				error_description=(
					str(payload["error_description"])
					if payload.get("error_description") is not None
					else (existing.error_description if existing else None)
				),
			)
			self._chargers[charger_id] = charger

		return self._to_dict(charger)

	def update_status(
		self,
		charger_id: str,
		status: str,
		error_code: Optional[str] = None,
		error_description: Optional[str] = None,
	) -> Optional[Dict[str, object]]:
		normalized = status.strip().lower()
		try:
			parsed_status = ChargerStatusEnum(normalized)
		except ValueError as exc:
			allowed = ", ".join([s.value for s in ChargerStatusEnum])
			raise ValueError(f"Invalid status '{status}'. Allowed: {allowed}") from exc

		with self._lock:
			charger = self._chargers.get(charger_id)
			if not charger:
				return None

			updated = charger.model_copy(update={
				"status": parsed_status,
				"last_updated": datetime.now(timezone.utc),
				"error_code": error_code if parsed_status == ChargerStatusEnum.FAULT else None,
				"error_description": error_description if parsed_status == ChargerStatusEnum.FAULT else None,
			})
			self._chargers[charger_id] = updated

		return self._to_dict(updated)

	def delete_charger(self, charger_id: str) -> bool:
		with self._lock:
			return self._chargers.pop(charger_id, None) is not None

	def summary(self) -> Dict[str, object]:
		with self._lock:
			chargers = list(self._chargers.values())

		total = len(chargers)
		online = len([c for c in chargers if c.status in (ChargerStatusEnum.ONLINE, ChargerStatusEnum.CHARGING)])
		charging = len([c for c in chargers if c.status == ChargerStatusEnum.CHARGING])
		fault = len([c for c in chargers if c.status == ChargerStatusEnum.FAULT])
		avg_temperature = (
			round(sum([c.temperature for c in chargers]) / total, 2)
			if total > 0
			else 0.0
		)

		return {
			"total": total,
			"online": online,
			"charging": charging,
			"fault": fault,
			"avg_temperature": avg_temperature,
			"updated_at": datetime.now(timezone.utc).isoformat(),
		}


charger_service = ChargerService()
