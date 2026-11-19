/* Shared helpers for the static GitHub Pages demo. */
const DEMO_BASE = "./";
const demoState = { data: null, geo: null };

async function loadDemoData() {
  if (demoState.data) return demoState.data;
  const [data, geo] = await Promise.all([
    fetch(`${DEMO_BASE}data/indicators.json`).then((r) => { if (!r.ok) throw new Error("indicators.json"); return r.json(); }),
    fetch(`${DEMO_BASE}data/china-provinces.geojson`).then((r) => { if (!r.ok) throw new Error("geojson"); return r.json(); }),
  ]);
  demoState.data = data;
  demoState.geo = geo;
  return data;
}

function fmt(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function datasetKey(year, metric) { return `${year}|${metric}`; }
function getDataset(data, year, metric) { return data.datasets[datasetKey(year, metric)]; }
function metricDef(layer, key) { return (layer.metrics || []).find((m) => m.key === key) || (layer.metrics || [])[0]; }
function layersFor(data) { return data.layers || []; }
function regionMap(geo) {
  const map = new Map();
  for (const feature of geo.features || []) map.set(feature.properties.code, feature.properties);
  return map;
}
function valueMap(dataset) {
  const map = new Map();
  for (const row of dataset?.values || []) map.set(row.region_code, row);
  return map;
}
function sourceHtml(row) {
  if (!row || !row.source?.length) return "无可用核验来源";
  return row.source.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.name)}</a>`).join("<br>");
}
function yearSelect(el, selected) {
  const years = [2024, 2023, 2022];
  el.innerHTML = years.map((y) => `<option value="${y}" ${Number(selected) === y ? "selected" : ""}>${y} 年</option>`).join("");
}
function header(active) {
  const items = [
    ["index.html", "首页", "home"],
    ["map.html", "全国地图", "map"],
    ["compare.html", "省份对比", "compare"],
    ["sources.html", "数据来源", "sources"],
  ];
  return `<header class="site-header"><div class="wrap">
    <a class="brand" href="./index.html"><span class="mark">机</span><span>机会地图<small>OPPORTUNITY OS</small></span></a>
    <nav class="nav">${items.map(([href, label, key]) => `<a class="${active === key ? "active" : ""}" href="./${href}">${label}</a>`).join("")}</nav>
    <div class="header-meta"><span><i class="status-dot"></i>公开数据展示</span><span>2022–2024 · 初中</span></div>
  </div></header>`;
}
function footer() {
  return `<footer class="site-footer"><div class="wrap">
    <div>© 2026 Opportunity OS · 机会地图。公开数据展示版，无需登录。</div>
    <div>数据：教育部 2022–2024 年教育统计数据；边界：geoBoundaries CHN ADM1（Public Domain）。</div>
  </div></footer>`;
}
function levelColor(level) {
  return ["#7a3b2a", "#9e563f", "#c27d62", "#ddab94", "#f0d5c8"][Math.max(0, Math.min(4, Number(level || 1) - 1))];
}
function classifyDataset(dataset) {
  const bands = [...(dataset.legend || [])].sort((a, b) => a.level - b.level);
  const valid = (dataset.values || []).filter((v) => v.metric_value !== null && v.metric_value !== undefined);
  const lowerIsBetter = dataset.metric?.direction === "lower_is_better";
  const sorted = [...valid].sort((a, b) => lowerIsBetter ? b.metric_value - a.metric_value : a.metric_value - b.metric_value);
  const levels = new Map();
  let offset = 0;
  bands.forEach((band, index) => {
    const count = Number.isFinite(Number(band.count)) ? Number(band.count) : Math.ceil(valid.length / bands.length);
    const slice = sorted.slice(offset, offset + count);
    for (const row of slice) levels.set(row.region_code, band);
    offset += count;
  });
  // The official legend counts should total 31; if a snapshot is incomplete,
  // allocate any remainder by equal-count fallback rather than a rounded boundary.
  for (let i = offset; i < sorted.length; i++) {
    const fallback = bands[Math.min(bands.length - 1, Math.floor((i * bands.length) / sorted.length))];
    levels.set(sorted[i].region_code, fallback);
  }
  return levels;
}

