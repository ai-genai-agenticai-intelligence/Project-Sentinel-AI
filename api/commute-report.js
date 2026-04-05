import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ALIASES = { "hitech city": "HITEC City" };

function loadJson(rel) {
  return JSON.parse(readFileSync(join(__dirname, rel), "utf8"));
}

const LOCATIONS = loadJson("data/locations.json");
const FLOOD_HOTSPOTS = loadJson("data/flood_hotspots.json");

function norm(name) {
  const k = String(name).trim();
  return ALIASES[k.toLowerCase()] ?? k;
}

function coords(name) {
  const key = norm(name);
  const c = LOCATIONS[key];
  if (!c) {
    throw new Error(`Unknown location: ${name}`);
  }
  return c;
}

function hashPair(a, b) {
  const s = `${norm(a)}|${norm(b)}`;
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function haversineKm(a, b) {
  const r = 6371;
  const la1 = (a[0] * Math.PI) / 180;
  const lo1 = (a[1] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const lo2 = (b[1] * Math.PI) / 180;
  const dlat = la2 - la1;
  const dlon = lo2 - lo1;
  const x =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dlon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(x)));
}

function lerpRoute(start, end, steps = 8) {
  const out = [];
  for (let i = 0; i < steps; i += 1) {
    const t = steps > 1 ? i / (steps - 1) : 0;
    out.push([
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
    ]);
  }
  return out;
}

function minDistToRouteKm(point, route) {
  let best = Infinity;
  for (const p of route) {
    best = Math.min(best, haversineKm(point, p));
  }
  return best;
}

function buildCommuteReport(fromLoc, toLoc) {
  if (String(fromLoc).trim() === String(toLoc).trim()) {
    throw new Error("from_loc and to_loc must differ");
  }

  const start = coords(fromLoc);
  const end = coords(toLoc);
  const pairHash = hashPair(fromLoc, toLoc);

  const routePoints = lerpRoute(start, end, 8);
  const routeTuples = routePoints.map((p) => [p[0], p[1]]);
  const distKm = haversineKm(start, end);

  const delay = 5 + (pairHash % 25);
  const travel = Math.max(12, Math.floor((distKm / 35) * 60) + delay);
  const levels = ["Low", "Moderate", "High", "Severe"];
  const trafficLevel = levels[pairHash % levels.length];

  const detected = [];
  for (const spot of FLOOD_HOTSPOTS) {
    const pt = [spot.lat, spot.lon];
    const d = minDistToRouteKm(pt, routeTuples);
    if (d < 4.5) {
      detected.push({
        ...spot,
        distance_km: Math.round(d * 10) / 10,
      });
    }
  }

  const aqi = 50 + (pairHash % 120);
  let aqiLabel = "Moderate";
  if (aqi >= 100 && aqi < 150) aqiLabel = "Poor";
  if (aqi >= 150) aqiLabel = "Unhealthy";

  const uv = Math.round((3 + (pairHash % 70) / 10) * 10) / 10;
  let uvLabel = "Moderate";
  if (uv >= 6 && uv < 8) uvLabel = "High";
  if (uv >= 8) uvLabel = "Very High";

  const isRaining = pairHash % 3 !== 0;
  const floodAlert = detected.length > 0 && isRaining;

  let score = Math.min(
    100,
    25 +
      (pairHash % 30) +
      (trafficLevel === "High" || trafficLevel === "Severe" ? 15 : 0) +
      (aqi >= 150 ? 20 : aqi >= 100 ? 10 : 0) +
      (isRaining ? 15 : 0) +
      Math.min(25, detected.length * 10),
  );

  let riskLabel = "Danger";
  if (score < 35) riskLabel = "Safe";
  else if (score < 65) riskLabel = "Caution";

  const warnings = [];
  if (trafficLevel === "High" || trafficLevel === "Severe") {
    warnings.push("Heavy traffic detected. Expect delays.");
  }
  if (aqi >= 100) {
    warnings.push(
      "Air quality is unhealthy. Limit long outdoor exposure, especially for sensitive groups.",
    );
  }
  if (uv >= 7) {
    warnings.push("High UV. Use sunscreen and avoid peak sun hours.");
  }
  if (isRaining) {
    warnings.push(
      "Rain detected. Roads may be slippery and visibility may reduce.",
    );
  }
  if (floodAlert) {
    warnings.push(
      "Flood-prone zones detected on your route. Avoid low roads and underpasses.",
    );
  }

  let recommendation =
    "Avoid travel if possible or choose a safer alternate route.";
  if (riskLabel === "Safe") {
    recommendation = "Conditions look reasonable. Drive carefully as usual.";
  } else if (riskLabel === "Caution") {
    recommendation = "Plan extra time and stay alert along the route.";
  }

  return {
    from: norm(fromLoc),
    to: norm(toLoc),
    route_points: routePoints,
    traffic: {
      travel_time_min: travel,
      traffic_delay_min: delay,
      traffic_level: trafficLevel,
    },
    environment_summary: {
      aqi_max: aqi,
      aqi_label: aqiLabel,
      uv_max: uv,
      uv_label: uvLabel,
      avg_temp: 28 + (pairHash % 8),
      avg_humidity: 55 + (pairHash % 25),
      is_raining: isRaining,
    },
    flood_alert_active: floodAlert,
    flood_hotspots_detected: detected,
    risk_breakdown: { total_score: score, risk_label: riskLabel },
    warnings,
    recommendation,
  };
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const fromLoc = req.query?.from_loc;
  const toLoc = req.query?.to_loc;

  if (!fromLoc || !toLoc) {
    res.status(400).json({ error: "from_loc and to_loc are required" });
    return;
  }

  try {
    const report = buildCommuteReport(String(fromLoc), String(toLoc));
    res.status(200).json(report);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? "Bad request" });
  }
}
