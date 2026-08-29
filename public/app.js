const $ = (id) => document.getElementById(id);

const state = {
  dashboard: null,
};

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice?.(0, 10) || value;
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

function formLabel(value) {
  if (value == null) return "fără date";
  if (value > 10) return "Fresh";
  if (value >= -10) return "Optimal";
  if (value >= -30) return "Training";
  return "High Risk";
}

function setMetric(id, value, suffix = "") {
  $(id).textContent = value == null ? "—" : `${value}${suffix}`;
}

function drawLineChart(canvas, series, options = {}) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = rect.width;
  const height = rect.height;
  const pad = { left: 44, right: 14, top: 12, bottom: 28 };

  ctx.clearRect(0, 0, width, height);

  let values = [];
  for (const s of series) {
    values.push(...s.values.filter(Number.isFinite));
  }
  if (options.min != null) values.push(options.min);
  if (options.max != null) values.push(options.max);
  if (!values.length) return;

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }

  const span = max - min;
  min -= span * 0.08;
  max += span * 0.08;

  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const n = Math.max(...series.map(s => s.values.length), 1);

  const x = (i) => pad.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v) => pad.top + ((max - v) / (max - min)) * plotH;

  if (options.zones) {
    for (const zone of options.zones) {
      const zTop = y(Math.min(max, zone.max));
      const zBottom = y(Math.max(min, zone.min));
      ctx.fillStyle = zone.fill;
      ctx.fillRect(pad.left, zTop, plotW, Math.max(0, zBottom - zTop));
    }
  }

  ctx.strokeStyle = "#2a2e35";
  ctx.fillStyle = "#747c88";
  ctx.lineWidth = 1;
  ctx.font = "10px system-ui";

  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4;
    const yy = y(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(width - pad.right, yy);
    ctx.stroke();
    ctx.fillText(String(Math.round(v)), 4, yy + 3);
  }

  if (options.zeroLine && min < 0 && max > 0) {
    const yy = y(0);
    ctx.strokeStyle = "#535962";
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(width - pad.right, yy);
    ctx.stroke();
  }

  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width || 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();

    let started = false;
    s.values.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      if (!started) {
        ctx.moveTo(x(i), y(v));
        started = true;
      } else {
        ctx.lineTo(x(i), y(v));
      }
    });
    ctx.stroke();
  }

  const labels = options.labels || [];
  if (labels.length) {
    ctx.fillStyle = "#656d78";
    const ticks = 5;
    for (let i = 0; i < ticks; i++) {
      const idx = Math.round((labels.length - 1) * (i / (ticks - 1)));
      const xx = x(idx);
      ctx.fillText(formatDate(labels[idx]), Math.max(pad.left, xx - 15), height - 5);
    }
  }

  return { pad, width, height, x, y, min, max, n };
}

function renderCharts() {
  const data = state.dashboard;
  if (!data) return;

  const labels = data.chart.map(d => d.date);

  drawLineChart(
    $("pmcChart"),
    [
      { values: data.chart.map(d => d.fitness), color: "#2f91ff", width: 2.4 },
      { values: data.chart.map(d => d.fatigue), color: "#bc6dff", width: 2.0 },
    ],
    { labels }
  );

  drawLineChart(
    $("formChart"),
    [{ values: data.chart.map(d => d.form), color: "#e3e5e8", width: 1.8 }],
    {
      labels,
      zeroLine: true,
      zones: [
        { min: 10, max: 1000, fill: "rgba(80,216,144,.07)" },
        { min: -10, max: 10, fill: "rgba(123,130,140,.05)" },
        { min: -30, max: -10, fill: "rgba(255,185,80,.06)" },
        { min: -1000, max: -30, fill: "rgba(255,101,119,.08)" },
      ],
    }
  );

  drawLineChart(
    $("rampChart"),
    [{ values: data.chart.map(d => d.rampRate), color: "#ffb950", width: 2 }],
    { labels, zeroLine: true }
  );
}

function renderActivities(items) {
  if (!items?.length) {
    $("activityRows").innerHTML =
      '<tr><td colspan="8" class="loading-cell">Nu există activități în perioada selectată.</td></tr>';
    return;
  }

  $("activityRows").innerHTML = items.map(a => `
    <tr>
      <td>
        <span class="activity-title">${escapeHtml(a.name)}</span>
        <span class="activity-type">${escapeHtml(a.type)}</span>
      </td>
      <td>${formatDate(a.date)}</td>
      <td>${a.distanceKm == null ? "—" : `${a.distanceKm} km`}</td>
      <td>${a.movingMinutes == null ? "—" : `${a.movingMinutes} min`}</td>
      <td>${a.elevationM == null ? "—" : `${Math.round(a.elevationM)} m`}</td>
      <td>${a.load == null ? "—" : Math.round(a.load)}</td>
      <td>${a.avgHr == null ? "—" : `${Math.round(a.avgHr)} bpm`}</td>
      <td>${a.avgWatts == null ? "—" : `${Math.round(a.avgWatts)} W`}</td>
    </tr>
  `).join("");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function load() {
  $("errorBox").classList.add("hidden");
  $("refreshBtn").disabled = true;
  $("refreshBtn").textContent = "Se actualizează…";

  try {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || data.error || `HTTP ${res.status}`);
    }

    state.dashboard = data;

    const c = data.current;
    setMetric("fitness", c.fitness);
    setMetric("fatigue", c.fatigue);
    setMetric("form", c.form);
    setMetric("ramp", c.rampRate);
    setMetric("weight", c.weight);
    setMetric("weightLarge", c.weight);

    $("formText").textContent = `${formLabel(c.form)} · CTL − ATL`;
    $("subtitle").textContent =
      `${data.athlete.name} · actualizat ${new Date(data.generatedAt).toLocaleTimeString("ro-RO", {hour:"2-digit", minute:"2-digit"})}`;

    renderActivities(data.activities);
    renderCharts();
  } catch (err) {
    $("errorBox").textContent =
      `Eroare la încărcare:\n${err.message}\n\nVerifică INTERVALS_API_KEY și conexiunea la internet.`;
    $("errorBox").classList.remove("hidden");
  } finally {
    $("refreshBtn").disabled = false;
    $("refreshBtn").textContent = "↻ Actualizează";
  }
}

$("refreshBtn").addEventListener("click", load);
window.addEventListener("resize", () => {
  clearTimeout(window.__chartResize);
  window.__chartResize = setTimeout(renderCharts, 120);
});

load();