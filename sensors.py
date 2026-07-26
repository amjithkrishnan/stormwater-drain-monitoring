"""
sensors.py
Simulates 5 sensor types for a stormwater drain monitoring network.
No real hardware - values are generated with randomised, semi-realistic
patterns (including occasional "storm event" spikes) so the fog node has
something meaningful to react to.

Sensor types:
  1. water_level_cm      - drain water level (cm)
  2. flow_rate_lpm        - flow rate (litres per minute)
  3. rainfall_mm          - rainfall intensity (mm/hr)
  4. turbidity_ntu        - water turbidity (NTU)
  5. blockage_vibration_g - vibration proxy for blockage detection (g-force)
"""

import random
import time
import uuid

# Simulate a small network of drains across 3 zones (2 drains per zone)
DRAIN_IDS = ["drain-01", "drain-02", "drain-03", "drain-04", "drain-05", "drain-06"]

DRAIN_ZONES = {
    "drain-01": "North Zone",
    "drain-02": "North Zone",
    "drain-03": "Central Zone",
    "drain-04": "Central Zone",
    "drain-05": "South Zone",
    "drain-06": "South Zone",
}

# Internal state per drain so values drift realistically instead of
# being fully independent random noise each tick.
_state = {
    drain_id: {
        "water_level_cm": random.uniform(5, 15),
        "flow_rate_lpm": random.uniform(20, 60),
        "rainfall_mm": 0.0,
        "turbidity_ntu": random.uniform(5, 20),
        "blockage_vibration_g": random.uniform(0.01, 0.05),
        "storm_ticks_left": 0,
    }
    for drain_id in DRAIN_IDS
}


def _maybe_start_storm(drain_id):
    """Randomly trigger a short 'storm event' that spikes readings,
    so the fog node has real anomalies to catch."""
    state = _state[drain_id]
    if state["storm_ticks_left"] == 0 and random.random() < 0.05:
        state["storm_ticks_left"] = random.randint(5, 12)


def generate_reading(drain_id):
    """Generate one reading (all 5 sensor values) for a given drain."""
    state = _state[drain_id]
    _maybe_start_storm(drain_id)

    if state["storm_ticks_left"] > 0:
        # Storm event: rainfall and water level climb, flow surges,
        # turbidity rises (debris), vibration may spike (blockage risk)
        state["rainfall_mm"] = min(80, state["rainfall_mm"] + random.uniform(3, 10))
        state["water_level_cm"] = min(120, state["water_level_cm"] + random.uniform(4, 12))
        state["flow_rate_lpm"] = min(500, state["flow_rate_lpm"] + random.uniform(20, 60))
        state["turbidity_ntu"] = min(300, state["turbidity_ntu"] + random.uniform(10, 40))
        state["blockage_vibration_g"] = min(2.0, state["blockage_vibration_g"] + random.uniform(0.0, 0.3))
        state["storm_ticks_left"] -= 1
    else:
        # Normal conditions: values drift gently and decay back to baseline
        state["rainfall_mm"] = max(0.0, state["rainfall_mm"] * 0.7 + random.uniform(-0.5, 0.5))
        state["water_level_cm"] = max(2.0, state["water_level_cm"] * 0.95 + random.uniform(-1, 1))
        state["flow_rate_lpm"] = max(5.0, state["flow_rate_lpm"] * 0.95 + random.uniform(-3, 3))
        state["turbidity_ntu"] = max(1.0, state["turbidity_ntu"] * 0.97 + random.uniform(-1, 1))
        state["blockage_vibration_g"] = max(0.005, state["blockage_vibration_g"] * 0.9 + random.uniform(-0.005, 0.01))

    reading = {
        "reading_id": str(uuid.uuid4()),
        "drain_id": drain_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "water_level_cm": round(state["water_level_cm"], 2),
        "flow_rate_lpm": round(state["flow_rate_lpm"], 2),
        "rainfall_mm": round(state["rainfall_mm"], 2),
        "turbidity_ntu": round(state["turbidity_ntu"], 2),
        "blockage_vibration_g": round(state["blockage_vibration_g"], 3),
    }
    return reading


def generate_batch():
    """Generate one reading per simulated drain."""
    return [generate_reading(drain_id) for drain_id in DRAIN_IDS]


if __name__ == "__main__":
    # Quick standalone test
    for _ in range(5):
        for r in generate_batch():
            print(r)
        time.sleep(1)

