import time
import uuid
import csv
import argparse
import statistics
from threading import Event, Lock
import socketio
import httpx

"""
Lightweight latency test runner for an 8-hour session and sends timestamp-injected messages to an HTTP endpoint (OCPP/message injector)
and listens for a socket.io event that signals voice output. Matches by sample_id.

"""

def percentile(data, p):
    if not data:
        return None
    s = sorted(data)
    k = (len(s)-1) * (p/100.0)
    f = int(k)
    c = min(f + 1, len(s)-1)
    if f == c:
        return s[int(k)]
    d0 = s[f] * (c - k)
    d1 = s[c] * (k - f)
    return d0 + d1

def ascii_histogram(samples, bins=10, width=60):
    if not samples:
        return "(no samples)"
    lo, hi = min(samples), max(samples)
    if lo == hi:
        return f"All samples equal: {lo:.1f} ms"
    bin_size = (hi - lo) / bins
    counts = [0]*bins
    for s in samples:
        idx = int((s - lo) / bin_size)
        if idx == bins:
            idx = bins - 1
        counts[idx] += 1
    out = []
    out.append(f"Histogram ({bins} bins) range {lo:.1f} ms - {hi:.1f} ms")
    maxc = max(counts)
    for i, c in enumerate(counts):
        left = lo + i*bin_size
        right = left + bin_size
        bar = "#" * int((c / maxc) * width) if maxc > 0 else ""
        out.append(f"{left:8.1f} - {right:8.1f} | {c:4d} | {bar}")
    return "\n".join(out)

def run_test(post_url, server_url, event_name, samples, duration_hours, timeout):
    sio = socketio.Client(logger=False, reconnection=True, reconnection_attempts=5)
    received_times = {}
    lock = Lock()
    done = Event()

    @sio.event
    def connect():
        print("socketio: connected")

    @sio.event
    def disconnect():
        print("socketio: disconnected")

    @sio.on(event_name)
    def on_voice_event(data):
        sid = None
        if isinstance(data, dict):
            sid = data.get("sample_id")
        if sid is None and isinstance(data, str):
            try:
                import json
                j = json.loads(data)
                sid = j.get("sample_id")
            except Exception:
                sid = None
        if sid:
            with lock:
                received_times[sid] = time.time()

    print(f"Connecting to socketio server {server_url} ...")
    sio.connect(server_url, wait=True)

    interval = (duration_hours * 3600) / max(samples, 1)
    print(f"Configured: samples={samples}, duration={duration_hours}h, interval={interval:.1f}s")

    results = []
    client = httpx.Client(timeout=timeout)

    try:
        for i in range(samples):
            sample_id = str(uuid.uuid4())
            injection_ts = time.time()
            payload = {"sample_id": sample_id, "injection_ts": injection_ts}
            try:
                r = client.post(post_url, json=payload)
                r.raise_for_status()
            except Exception as e:
                print(f"[{i+1}/{samples}] POST failed: {e}")
                results.append(None)
                next_time = injection_ts + interval
                sleep = max(0, next_time - time.time())
                time.sleep(sleep)
                continue

            print(f"[{i+1}/{samples}] injected sample_id={sample_id}")
            waited = 0.0
            poll_interval = 0.25
            matched = False
            while waited < timeout:
                with lock:
                    if sample_id in received_times:
                        recv_ts = received_times.pop(sample_id)
                        latency_ms = (recv_ts - injection_ts) * 1000.0
                        results.append(latency_ms)
                        print(f"  -> received after {latency_ms:.1f} ms")
                        matched = True
                        break
                time.sleep(poll_interval)
                waited += poll_interval
            if not matched:
                print(f"  -> no event for sample within timeout ({timeout}s)")
                results.append(None)

            next_time = injection_ts + interval
            sleep = max(0, next_time - time.time())
            time.sleep(sleep)
    finally:
        try:
            sio.disconnect()
        except Exception:
            pass
        client.close()

    successful = [r for r in results if r is not None]
    failed = len(results) - len(successful)
    csv_path = "latency_results.csv"
    with open(csv_path, "w", newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["sample_index", "latency_ms_or_EMPTY"])
        for idx, r in enumerate(results):
            writer.writerow([idx, "" if r is None else f"{r:.3f}"])
    print(f"\nSaved raw results to {csv_path}")

    if not successful:
        print("No successful samples collected.")
        return

    mean = statistics.mean(successful)
    med = statistics.median(successful)
    p95 = percentile(successful, 95)
    rng = max(successful) - min(successful)

    print("\nLatency measurements with {} samples ({} failed):".format(len(results), failed))
    print(f"- Mean: {mean:.1f} ms")
    print(f"- Median: {med:.1f} ms")
    print(f"- 95th percentile: {p95:.1f} ms")
    print(f"- Range: {rng:.1f} ms")
    print("\n" + ascii_histogram(successful, bins=12))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Latency test: inject timestamped OCPP message and listen for voice output event.")
    parser.add_argument("--post-url", required=True, help="HTTP endpoint that will inject the OCPP message (receives JSON with sample_id and injection_ts)")
    parser.add_argument("--server-url", required=True, help="Socket.IO server URL (e.g. http://localhost:8000)")
    parser.add_argument("--event", default="voice_played", help="Socket.IO event name that signals voice output (default: voice_played)")
    parser.add_argument("--samples", type=int, default=100, help="Number of samples to collect (default: 100)")
    parser.add_argument("--duration", type=float, default=8.0, help="Total test duration in hours (default: 8)")
    parser.add_argument("--timeout", type=int, default=300, help="Timeout (seconds) to wait for each sample's event (default: 300)")
    args = parser.parse_args()

    run_test(args.post_url, args.server_url, args.event, args.samples, args.duration, args.timeout)