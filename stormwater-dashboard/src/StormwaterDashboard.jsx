import { useState, useEffect } from "react";
import { Droplets, Waves, AlertTriangle, Table2, Radio, Wind } from "lucide-react";

// ---------------------------------------------------------------------------
// set this to my API Gateway invoke URL once it's deployed
// ---------------------------------------------------------------------------
const API_BASE = "https://wg17ys4acb.execute-api.us-east-1.amazonaws.com";
const POLL_MS = 4000;
const HISTORY_LEN = 24;
const DRAIN_IDS = ["drain-01", "drain-02", "drain-03", "drain-04", "drain-05", "drain-06"];

const DRAIN_ZONES = {
  "drain-01": "North Zone",
  "drain-02": "North Zone",
  "drain-03": "Central Zone",
  "drain-04": "Central Zone",
  "drain-05": "South Zone",
  "drain-06": "South Zone",
};
const ZONE_ORDER = ["North Zone", "Central Zone", "South Zone"];

const RISK_COLOR = {
  NORMAL: "#2DD4BF",
  WARNING: "#F5B94D",
  CRITICAL: "#FB5B5B",
};

function DrainGauge({ drain, selected, onClick }) {
  const pct = Math.min(100, (drain.water_level_cm / 120) * 100);
  const color = RISK_COLOR[drain.risk_level];

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      style={{
        background: "#0F1B2D",
        border: selected ? `1px solid ${color}` : "1px solid #1E3049",
        boxShadow: selected ? `0 0 0 1px ${color}44` : "none",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        gap: 18,
        alignItems: "center",
        cursor: "pointer",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      <div style={{ position: "relative", width: 34, height: 120, flexShrink: 0 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: 17,
          border: "2px solid #2A3F5A", background: "#0A1220", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            height: `${pct}%`, background: `linear-gradient(180deg, ${color}55, ${color})`,
            transition: "height 0.6s ease",
          }} />
          {[25, 50, 75].map((m) => (
            <div key={m} style={{
              position: "absolute", left: 0, right: 0, bottom: `${m}%`,
              borderTop: "1px dashed #2A3F5A",
            }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 13, color: "#7FA8C9", letterSpacing: 0.5, textTransform: "uppercase",
          }}>
            {drain.drain_id}
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: `${color}22`, color, letterSpacing: 0.5,
          }}>
            {drain.risk_level}
          </span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#EAF2FA", marginTop: 2, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          {drain.water_level_cm}<span style={{ fontSize: 14, color: "#5C7A99", fontWeight: 400 }}> cm</span>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11.5, color: "#7FA8C9", flexWrap: "wrap" }}>
          <span><Wind size={11} style={{ verticalAlign: -2, marginRight: 3 }} />{drain.flow_rate_lpm} L/min</span>
          <span><Droplets size={11} style={{ verticalAlign: -2, marginRight: 3 }} />{drain.rainfall_mm} mm/hr</span>
        </div>
        {drain.risk_flags.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {drain.risk_flags.map((f) => (
              <span key={f} style={{
                fontSize: 10, color: "#FB5B5B", border: "1px solid #4A2530",
                background: "#2A1518", borderRadius: 5, padding: "2px 6px",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              }}>
                {f.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const RISK_ROW_BG = {
  NORMAL: "transparent",
  WARNING: "#2A230F",
  CRITICAL: "#2A1518",
};

function ReadingCard({ r }) {
  const color = RISK_COLOR[r.risk_level];
  return (
    <div style={{
      borderBottom: "1px solid #16233A", padding: "10px 2px",
      background: RISK_ROW_BG[r.risk_level] || "transparent",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12, color: "#7FA8C9" }}>
          {r.timestamp?.slice(11, 19)}
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10.5, fontWeight: 700, color, padding: "1px 8px",
          borderRadius: 999, background: `${color}22`,
        }}>
          {r.risk_level}
        </span>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12.5, color: "#EAF2FA",
      }}>
        <div><span style={{ color: "#5C7A99" }}>Level: </span>{r.water_level_cm} cm</div>
        <div><span style={{ color: "#5C7A99" }}>Flow: </span>{r.flow_rate_lpm} L/min</div>
        <div><span style={{ color: "#5C7A99" }}>Rain: </span>{r.rainfall_mm} mm/hr</div>
        <div><span style={{ color: "#5C7A99" }}>Turb: </span>{r.turbidity_ntu} NTU</div>
        <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "#5C7A99" }}>Vibration: </span>{r.blockage_vibration_g} g</div>
      </div>
      {r.risk_flags?.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
          {r.risk_flags.map((f) => (
            <span key={f} style={{
              fontSize: 9.5, color: "#FB5B5B", border: "1px solid #4A2530",
              background: "#2A1518", borderRadius: 4, padding: "1px 5px",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}>
              {f.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadingsList({ rows }) {
  const ordered = [...rows].reverse();

  if (ordered.length === 0) {
    return (
      <div style={{ color: "#5C7A99", fontSize: 13, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
        No readings yet for this drain.
      </div>
    );
  }

  return (
    <div>
      {ordered.map((r) => (
        <ReadingCard key={r.reading_id || r.timestamp} r={r} />
      ))}
    </div>
  );
}

export default function StormwaterDashboard() {
  const [drains, setDrains] = useState([]);
  const [history, setHistory] = useState({});
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDrain, setSelectedDrain] = useState(DRAIN_IDS[0]);
  const [zoneFilter, setZoneFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const results = await Promise.all(
          DRAIN_IDS.map(async (drainId) => {
            const res = await fetch(`${API_BASE}/readings?drain_id=${drainId}&limit=${HISTORY_LEN}`);
            if (!res.ok) throw new Error(`API returned HTTP ${res.status} for ${drainId}`);
            const items = await res.json();
            if (!Array.isArray(items)) throw new Error(`API response for ${drainId} was not a JSON array`);
            return { drainId, items }; // items are newest-first
          })
        );

        if (cancelled) return;

        setConnected(true);
        setError(null);
        
        const latestPerDrain = [];
        const nextHistoryEntries = {};
        results.forEach(({ drainId, items }) => {
          if (items.length === 0) return;
          latestPerDrain.push(items[0]); // most recent reading for this drain
          nextHistoryEntries[drainId] = [...items].reverse().map((r, i) => ({ t: i, ...r }));
        });

        setDrains(latestPerDrain);
        setHistory((prev) => ({ ...prev, ...nextHistoryEntries }));
        setLastUpdate(new Date());
      } catch (err) {
        if (!cancelled) {
          setConnected(false);
          setError(err.message || String(err));
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const criticalCount = drains.filter((d) => d.risk_level === "CRITICAL").length;
  const warningCount = drains.filter((d) => d.risk_level === "WARNING").length;

  return (
    <div style={{
      height: "100vh", width: "100%", background: "#0A1220", color: "#EAF2FA",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* header bar */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, padding: "18px clamp(14px, 4vw, 24px)",
        borderBottom: "1px solid #1E3049",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: "#132038",
            display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #1E3049",
          }}>
            <Waves size={20} color="#2DD4BF" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.2 }}>Stormwater Drain Network</div>
            <div style={{ fontSize: 12.5, color: "#5C7A99" }}>Fog-layer risk scoring &middot; cloud-aggregated history !!</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12.5, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: connected ? "#2DD4BF" : "#FB5B5B" }}>
            <Radio size={13} />
            {connected ? "LIVE (AWS)" : "DISCONNECTED"}
          </span>
          {criticalCount > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#FB5B5B" }}>
              <AlertTriangle size={13} /> {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span style={{ color: "#F5B94D" }}>{warningCount} warning</span>
          )}
          <span style={{ color: "#3E5975" }}>
            {lastUpdate ? lastUpdate.toLocaleTimeString() : "—"}
          </span>
        </div>
      </div>

      {/* main content row: drains on the left, readings panel on the right */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* left side - zones and drain cards */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "20px clamp(14px, 4vw, 24px) 32px" }}>
          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#2A1518", border: "1px solid #4A2530", color: "#FCA5A5",
              borderRadius: 10, padding: "12px 16px", marginBottom: 20,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13,
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700 }}>API request failed</div>
                <div style={{ color: "#E29797", fontSize: 12, marginTop: 2 }}>{error}</div>
              </div>
            </div>
          )}

          {drains.length === 0 && !error && (
            <div style={{ color: "#5C7A99", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 13 }}>
              Waiting for first reading...
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {["All", ...ZONE_ORDER].map((zone) => {
              const isActive = zoneFilter === zone;
              return (
                <button
                  key={zone}
                  onClick={() => {
                    setZoneFilter(zone);
                    if (zone !== "All") {
                      const firstInZone = DRAIN_IDS.find((id) => DRAIN_ZONES[id] === zone);
                      if (firstInZone) setSelectedDrain(firstInZone);
                    }
                  }}
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 12, letterSpacing: 0.3, padding: "6px 14px", borderRadius: 999,
                    border: isActive ? "1px solid #2DD4BF" : "1px solid #1E3049",
                    background: isActive ? "#2DD4BF1A" : "#0F1B2D",
                    color: isActive ? "#2DD4BF" : "#7FA8C9",
                    cursor: "pointer", transition: "all 0.15s ease",
                  }}
                >
                  {zone}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#3E5975", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginRight: 2 }}>
              SEVERITY:
            </span>
            {["All", "NORMAL", "WARNING", "CRITICAL"].map((sev) => {
              const isActive = severityFilter === sev;
              const dotColor = sev === "All" ? "#7FA8C9" : RISK_COLOR[sev];
              return (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 12, letterSpacing: 0.3, padding: "6px 14px", borderRadius: 999,
                    border: isActive ? `1px solid ${dotColor}` : "1px solid #1E3049",
                    background: isActive ? `${dotColor}1A` : "#0F1B2D",
                    color: isActive ? dotColor : "#7FA8C9",
                    cursor: "pointer", transition: "all 0.15s ease",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: dotColor }} />
                  {sev}
                </button>
              );
            })}
          </div>

          {ZONE_ORDER.filter((zone) => zoneFilter === "All" || zoneFilter === zone).map((zone) => {
            const zoneDrains = drains.filter((d) =>
              DRAIN_ZONES[d.drain_id] === zone &&
              (severityFilter === "All" || d.risk_level === severityFilter)
            );
            if (zoneDrains.length === 0) return null;

            const zoneCritical = zoneDrains.filter((d) => d.risk_level === "CRITICAL").length;
            const zoneWarning = zoneDrains.filter((d) => d.risk_level === "WARNING").length;
            const zoneColor = zoneCritical > 0 ? "#FB5B5B" : zoneWarning > 0 ? "#F5B94D" : "#2DD4BF";

            return (
              <div key={zone} style={{ marginBottom: 24 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: zoneColor, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 13, color: "#B7CBDE", fontWeight: 700,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 0.5, textTransform: "uppercase",
                  }}>
                    {zone}
                  </span>
                  <span style={{ fontSize: 11.5, color: "#5C7A99" }}>
                    {zoneDrains.length} drain{zoneDrains.length !== 1 ? "s" : ""}
                  </span>
                  {zoneCritical > 0 && (
                    <span style={{ fontSize: 11, color: "#FB5B5B", fontWeight: 700 }}>
                      &middot; {zoneCritical} critical
                    </span>
                  )}
                  {zoneWarning > 0 && (
                    <span style={{ fontSize: 11, color: "#F5B94D", fontWeight: 700 }}>
                      &middot; {zoneWarning} warning
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
                  {zoneDrains.map((d) => (
                    <DrainGauge
                      key={d.drain_id}
                      drain={d}
                      selected={d.drain_id === selectedDrain}
                      onClick={() => setSelectedDrain(d.drain_id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* right side - readings panel, heading stays put while the list scrolls */}
        <div style={{
          width: "min(420px, 34vw)", flexShrink: 0,
          borderLeft: "1px solid #1E3049",
          display: "flex", flexDirection: "column", minHeight: 0,
        }}>
          <div style={{
            flexShrink: 0, padding: "16px 18px 12px", borderBottom: "1px solid #1E3049",
            fontSize: 12, color: "#7FA8C9", fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: 0.5, textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Table2 size={13} /> Readings &mdash; {selectedDrain}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 24px" }}>
            <ReadingsList rows={history[selectedDrain] || []} />
          </div>
        </div>
      </div>
    </div>
  );
}

