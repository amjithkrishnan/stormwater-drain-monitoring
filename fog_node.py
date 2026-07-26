"""
fog_node.py

This is the fog layer for my Stormwater Drain Monitoring project.
It grabs sensor readings from sensors.py, checks them against some
threshold values to flag risky readings straight away (instead of
waiting for the cloud to figure it out), then sends everything on
to the cloud backend.

Basic flow:
  1. Pull a batch of sensor readings
  2. Run local threshold checks -> tag each reading NORMAL/WARNING/CRITICAL
  3. Send it on to the API Gateway endpoint

To run:
  export API_ENDPOINT="https://<api-url>ingest"
  export DISPATCH_INTERVAL_SECONDS=5   (optional, defaults to 5)
  python3 fog_node.py
"""

import os
import time
import json
import logging
import requests

import sensors

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("fog_node")

API_ENDPOINT = os.environ.get("API_ENDPOINT", "http://localhost:8000/ingest")
DISPATCH_INTERVAL_SECONDS = float(os.environ.get("DISPATCH_INTERVAL_SECONDS", "5"))

# Local fog-layer thresholds for immediate risk flagging
THRESHOLDS = {
    "water_level_cm": 80.0,       # above this => high flood risk
    "flow_rate_lpm": 300.0,       # above this => surge event
    "rainfall_mm": 40.0,          # above this => heavy rainfall
    "turbidity_ntu": 150.0,       # above this => debris/contamination
    "blockage_vibration_g": 1.0,  # above this => possible blockage
}


def assess_risk(reading):
    """This is where the actual fog computing happens - turn raw sensor
    values into a risk assessment locally, before sending anything
    up to the cloud."""
    flags = []
    if reading["water_level_cm"] > THRESHOLDS["water_level_cm"]:
        flags.append("HIGH_WATER_LEVEL")
    if reading["flow_rate_lpm"] > THRESHOLDS["flow_rate_lpm"]:
        flags.append("FLOW_SURGE")
    if reading["rainfall_mm"] > THRESHOLDS["rainfall_mm"]:
        flags.append("HEAVY_RAINFALL")
    if reading["turbidity_ntu"] > THRESHOLDS["turbidity_ntu"]:
        flags.append("HIGH_TURBIDITY")
    if reading["blockage_vibration_g"] > THRESHOLDS["blockage_vibration_g"]:
        flags.append("POSSIBLE_BLOCKAGE")

    if len(flags) >= 2:
        risk_level = "CRITICAL"
    elif len(flags) == 1:
        risk_level = "WARNING"
    else:
        risk_level = "NORMAL"

    reading["risk_level"] = risk_level
    reading["risk_flags"] = flags
    return reading


def dispatch(payload):
    """Send the processed payload to the cloud backend (API Gateway)."""
    try:
        resp = requests.post(API_ENDPOINT, json=payload, timeout=5)
        if resp.status_code >= 300:
            log.warning("Dispatch failed (%s): %s", resp.status_code, resp.text)
        else:
            log.info(
                "Dispatched %s [%s] risk=%s",
                payload["drain_id"], payload["timestamp"], payload["risk_level"],
            )
    except requests.RequestException as exc:
        log.error("Dispatch error: %s", exc)


def run():
    log.info("Fog node starting. Dispatching to %s every %ss",
              API_ENDPOINT, DISPATCH_INTERVAL_SECONDS)
    while True:
        batch = sensors.generate_batch()
        for reading in batch:
            processed = assess_risk(reading)
            if processed["risk_level"] == "CRITICAL":
                log.warning("CRITICAL risk at %s: %s",
                            processed["drain_id"], processed["risk_flags"])
            dispatch(processed)
        time.sleep(DISPATCH_INTERVAL_SECONDS)


if __name__ == "__main__":
    run()
