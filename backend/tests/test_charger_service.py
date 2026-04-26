import pytest

from app.services.chargerService import ChargerService


@pytest.fixture
def service() -> ChargerService:
	return ChargerService()


def test_seed_data_is_loaded(service: ChargerService) -> None:
	chargers = service.list_chargers()

	assert len(chargers) >= 5
	assert all("id" in charger for charger in chargers)


def test_list_chargers_filters_by_status_case_insensitive(service: ChargerService) -> None:
	charging = service.list_chargers(status="ChArGiNg")

	assert charging
	assert all(charger["status"] == "charging" for charger in charging)


def test_get_charger_returns_none_for_unknown_id(service: ChargerService) -> None:
	charger = service.get_charger("unknown-charger")

	assert charger is None


def test_create_or_update_charger_creates_new_entry(service: ChargerService) -> None:
	created = service.create_or_update_charger(
		{
			"charger_id": "SmartGlasses-Bay-01",
			"status": "online",
			"voltage": 400.0,
			"current": 8.5,
			"power": 3.4,
			"temperature": 30.2,
		}
	)

	assert created["id"] == "SmartGlasses-Bay-01"
	assert created["status"] == "online"
	assert created["power"] == 3.4


def test_create_or_update_requires_charger_id(service: ChargerService) -> None:
	with pytest.raises(ValueError, match="charger_id is required"):
		service.create_or_update_charger({"status": "online"})


def test_update_status_fault_sets_error_fields(service: ChargerService) -> None:
	updated = service.update_status(
		charger_id="Belinda Street",
		status="fault",
		error_code="OverTemp",
		error_description="Thermal threshold exceeded",
	)

	assert updated is not None
	assert updated["status"] == "fault"
	assert updated["errorCode"] == "OverTemp"


def test_update_status_non_fault_clears_error_fields(service: ChargerService) -> None:
	service.update_status(
		charger_id="Belinda Street",
		status="fault",
		error_code="OverCurrent",
		error_description="Current exceeded threshold",
	)

	updated = service.update_status(charger_id="Belinda Street", status="online")

	assert updated is not None
	assert updated["status"] == "online"
	assert updated["errorCode"] is None


def test_summary_returns_consistent_counts(service: ChargerService) -> None:
	summary = service.summary()

	assert summary["total"] >= 5
	assert summary["online"] >= summary["charging"]
	assert "avg_temperature" in summary
