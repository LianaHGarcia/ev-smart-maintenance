# ev-smart-maintenance
Dissertation project on smart glasses in maintenance.

The energy industry is one of the core industries that we need to run our day to day lives and quite literally contributes to climate change. As wide as it is, there are many ways to improve operations from the simplest tasks to the most complex ones. I want to combine different technologies and find new ways we can adopt them into the industry and this is one of the ways. Welcome.

## Structure

- `backend/` – Python backend to send data to the dashboard and, later, smart glasses.
- `frontend/` – React + TypeScript dashboard to visualise charger status, errors and maintenance history.
- `py-scripts/` – Python scripts running on the Raspberry Pi to call the OCM API and send charger data.

## Session Recording

- Smart-glasses recordings can now be uploaded to the backend through `POST /api/v1/session-recordings`.
- Uploaded videos are stored on disk under `backend/storage/session_recordings/` by default.
- Each upload persists metadata linking the recording to charger id, operator name, recording mode, and start/end timestamps.
- Set `SESSION_RECORDING_STORAGE_DIR` to move the storage location.

## Raspberry Pi Charger Simulation

- The backend starts an OCPP 1.6 websocket server on `ws://localhost:9000` by default.
- Use `backend/scripts/pi_ocpp_simulator.py` on the Raspberry Pi to simulate a charger connecting to that endpoint.
- Example:

```bash
cd backend
.venv/bin/python scripts/pi_ocpp_simulator.py --server ws://<backend-host>:9000 --charge-point-id pi-sim-01 --mode charging
```

- The simulator sends `BootNotification`, `StatusNotification`, `Heartbeat`, and `MeterValues`, so the dashboard and HUD update as if a real charger were online.
