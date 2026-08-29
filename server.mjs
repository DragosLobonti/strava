import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.INTERVALS_API_KEY;
const BASE = "https://intervals.icu/api/v1";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");

if (!API_KEY) {
  console.error("Lipseste INTERVALS_API_KEY. Porneste cu: node --env-file=.env server.mjs");
  process.exit(1);
}

function authHeaders() {
  const auth = Buffer.from(`API_KEY:${API_KEY}`).toString("base64");
  return {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };
}

async function intervals(path) {
  const response = await fetch(`${BASE}${path}`, { headers: authHeaders() });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Intervals.icu ${response.status}: ${body}`);
  }

  return response.json();
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function latestNonNull(items, key) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]?.[key] != null) return items[i][key];
  }
  return null;
}

function num(v, digits = 1) {
  return Number.isFinite(v) ? Number(v.toFixed(digits)) : null;
}

async function getDashboard() {
  const newest = isoDate(new Date());
  const oldest = isoDate(daysAgo(89));

  const [profile, wellness, activities] = await Promise.all([
    intervals("/athlete/0"),
    intervals(`/athlete/0/wellness?oldest=${oldest}&newest=${newest}`),
    intervals(`/athlete/0/activities?oldest=${oldest}&newest=${newest}`),
  ]);

  const sorted = [...wellness].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const today = sorted.at(-1) || {};

  const profileWeight =
    profile.icu_weight ??
    profile.weight ??
    null;

  const weight =
    latestNonNull(sorted, "weight") ??
    profileWeight ??
    null;

  const chart = sorted.map((d) => ({
    date: d.id,
    fitness: num(d.ctl, 2),
    fatigue: num(d.atl, 2),
    form:
      Number.isFinite(d.ctl) && Number.isFinite(d.atl)
        ? num(d.ctl - d.atl, 2)
        : null,
    rampRate: num(d.rampRate, 2),
    weight: d.weight ?? null,
  }));

  const recentActivities = [...activities]
    .sort((a, b) =>
      String(b.start_date_local || b.start_date || "").localeCompare(
        String(a.start_date_local || a.start_date || "")
      )
    )
    .slice(0, 10)
    .map((a) => ({
      id: a.id,
      name: a.name || a.type || "Activitate",
      type: a.type || a.sport_type || "Activity",
      date: a.start_date_local || a.start_date || null,
      distanceKm: Number.isFinite(a.distance) ? num(a.distance / 1000, 1) : null,
      movingMinutes: Number.isFinite(a.moving_time) ? Math.round(a.moving_time / 60) : null,
      elevationM:
        a.total_elevation_gain ??
        a.icu_elevation_gain ??
        a.elevation_gain ??
        null,
      load:
        a.icu_training_load ??
        a.training_load ??
        a.tss ??
        null,
      avgHr:
        a.average_heartrate ??
        a.average_hr ??
        null,
      avgWatts:
        a.average_watts ??
        a.avg_power ??
        null,
    }));

  return {
    generatedAt: new Date().toISOString(),
    athlete: {
      name:
        [profile.firstname, profile.lastname].filter(Boolean).join(" ") ||
        profile.name ||
        "Athlete",
      weight: num(Number(weight), 1),
    },
    current: {
      fitness: num(today.ctl, 0),
      fitnessExact: num(today.ctl, 2),
      fatigue: num(today.atl, 0),
      fatigueExact: num(today.atl, 2),
      form:
        Number.isFinite(today.ctl) && Number.isFinite(today.atl)
          ? num(today.ctl - today.atl, 0)
          : null,
      formExact:
        Number.isFinite(today.ctl) && Number.isFinite(today.atl)
          ? num(today.ctl - today.atl, 2)
          : null,
      rampRate: num(today.rampRate, 1),
      weight: num(Number(weight), 1),
    },
    chart,
    activities: recentActivities,
  };
}

function contentType(path) {
  switch (extname(path).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".json": return "application/json; charset=utf-8";
    default: return "application/octet-stream";
  }
}

async function serveStatic(req, res) {
  const rawPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const clean = normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, clean);

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api/dashboard")) {
      const payload = await getDashboard();
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(payload));
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      error: "Nu am putut incarca datele Intervals.icu",
      detail: error.message,
    }));
  }
});

server.listen(PORT, () => {
  console.log(`Dashboard: http://localhost:${PORT}`);
});