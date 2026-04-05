import { useState } from "react";
import axios from "axios";

import { locations } from "./locations";
import mockReport from "./mockReport.json";

import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import MapViewSync from "./MapViewSync.jsx";

import "./App.css";

export default function App() {
  const [fromLoc, setFromLoc] = useState("Gachibowli");
  const [toLoc, setToLoc] = useState("Secunderabad");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  /** Same-origin `/api` on Vercel; Vite proxies to FastAPI (port 8000) in dev */
  const apiBase = import.meta.env.VITE_API_BASE ?? "";

  const fetchReport = async () => {
    setLoading(true);

    try {
      const res = await axios.get(`${apiBase}/api/commute-report`, {
        params: { from_loc: fromLoc, to_loc: toLoc },
      });
      setReport(res.data);
    } catch (error) {
      console.log("Backend not reachable, using mock data...", error?.message);
      setReport(mockReport);
    }

    setLoading(false);
  };

  const riskBadgeClass = (label) => {
    if (label === "Safe") return "sr-badge sr-badge--safe";
    if (label === "Caution") return "sr-badge sr-badge--caution";
    return "sr-badge sr-badge--danger";
  };

  const riskMeterClass = (label) => {
    if (label === "Safe") return "sr-meter-fill sr-meter-fill--safe";
    if (label === "Caution") return "sr-meter-fill sr-meter-fill--caution";
    return "sr-meter-fill sr-meter-fill--danger";
  };

  return (
    <div className="sr-app">
      <header className="sr-header">
        <p className="sr-kicker">Hyderabad commute intelligence</p>
        <h1 className="sr-title">SafeRoute</h1>
        <p className="sr-subtitle">
          Traffic, air quality, UV, and rain-aware flood alerts in one route risk
          preview.
        </p>
      </header>

      <section className="sr-controls" aria-label="Route selection">
        <div className="sr-field">
          <label htmlFor="from-loc">From</label>
          <select
            id="from-loc"
            value={fromLoc}
            onChange={(e) => setFromLoc(e.target.value)}
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div className="sr-field">
          <label htmlFor="to-loc">To</label>
          <select
            id="to-loc"
            value={toLoc}
            onChange={(e) => setToLoc(e.target.value)}
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="sr-primary"
          onClick={fetchReport}
          disabled={loading}
        >
          {loading ? "Analyzing route…" : "Predict commute risk"}
        </button>
      </section>

      {report && (
        <div className="sr-dashboard">
          <article className="sr-card">
            <h2>Overall risk</h2>
            <div className="sr-score-row">
              <span className="sr-score">{report.risk_breakdown.total_score}</span>
              <span className="sr-stat-value" style={{ opacity: 0.7 }}>
                / 100
              </span>
              <span className={riskBadgeClass(report.risk_breakdown.risk_label)}>
                {report.risk_breakdown.risk_label}
              </span>
            </div>
            <div className="sr-meter" aria-hidden>
              <div
                className={riskMeterClass(report.risk_breakdown.risk_label)}
                style={{ width: `${report.risk_breakdown.total_score}%` }}
              />
            </div>
            <p className="sr-reco">{report.recommendation}</p>
          </article>

          <article className="sr-card">
            <h2>Traffic</h2>
            <p>
              <span className="sr-stat-label">Travel time</span>
              <br />
              <span className="sr-stat-value">
                {report.traffic.travel_time_min} min
              </span>
            </p>
            <p>
              <span className="sr-stat-label">Delay</span>
              <br />
              <span className="sr-stat-value">
                {report.traffic.traffic_delay_min} min
              </span>
            </p>
            <p className="sr-lead">
              Congestion: {report.traffic.traffic_level}
            </p>
          </article>

          <article className="sr-card">
            <h2>Air quality</h2>
            <p>
              <span className="sr-stat-label">AQI</span>
              <br />
              <span className="sr-stat-value">
                {report.environment_summary.aqi_max}
              </span>
            </p>
            <p className="sr-lead">{report.environment_summary.aqi_label}</p>
          </article>

          <article className="sr-card">
            <h2>UV index</h2>
            <p>
              <span className="sr-stat-label">UV</span>
              <br />
              <span className="sr-stat-value">
                {report.environment_summary.uv_max}
              </span>
            </p>
            <p className="sr-lead">{report.environment_summary.uv_label}</p>
          </article>

          <article className="sr-card sr-card--wide">
            <h2>Rain and flood</h2>
            <p className="sr-lead">
              {report.environment_summary.is_raining
                ? "Raining — roads may be slippery."
                : "No rain in the snapshot."}
            </p>
            {report.flood_alert_active &&
            report.flood_hotspots_detected.length > 0 ? (
              <div>
                <p className="sr-stat-label" style={{ marginTop: "0.75rem" }}>
                  Hotspots
                </p>
                <ul className="sr-flood-list">
                  {report.flood_hotspots_detected.map((spot, i) => (
                    <li key={i}>
                      {spot.name} — {spot.risk}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="sr-flood-ok">No flood hotspots on this route.</p>
            )}
          </article>

          <article className="sr-card sr-card--wide">
            <h2>Warnings</h2>
            <ul className="sr-alert-list">
              {report.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </article>

          <article className="sr-card sr-card--wide">
            <h2 className="sr-map-title">Route map</h2>
            <div
              className="route-map-frame"
              style={{
                height: 400,
                width: "100%",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <MapContainer
                center={[17.385, 78.4867]}
                zoom={11}
                style={{ height: "100%", width: "100%" }}
                whenReady={(e) => {
                  e.target.invalidateSize();
                }}
              >
                <MapViewSync />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                <Polyline positions={report.route_points} />

                {report.flood_hotspots_detected.map((spot, i) => (
                  <Marker key={i} position={[spot.lat, spot.lon]}>
                    <Popup>
                      <strong>{spot.name}</strong>
                      <br />
                      Risk: {spot.risk}
                      <br />
                      Distance: {spot.distance_km} km
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
