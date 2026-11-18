(async function () {
  document.getElementById("site-header").innerHTML = header("map");
  document.getElementById("site-footer").innerHTML = footer();
  const data = await loadDemoData();
  const geo = demoState.geo;
  const params = new URLSearchParams(location.search);
  const state = {
    layer: data.layers.some((l) => l.code === params.get("layer")) ? params.get("layer") : "labs",
    year: [2022, 2023, 2024].includes(Number(params.get("year"))) ? Number(params.get("year")) : 2024,
    metric: params.get("metric") || "junior_lab_area_per_student",
    selected: params.get("region") || "340000",
  };
  const regionProps = regionMap(geo);
  let map;
  let activeDataset;

  function currentLayer() { return data.layers.find((l) => l.code === state.layer); }
  function currentMetric() {
    const layer = currentLayer();
    if (!(layer.metrics || []).some((m) => m.key === state.metric)) state.metric = layer.default_metric;
    return metricDef(layer, state.metric);
  }
  function levelFor(value) {
    if (value == null) return null;
    return activeDataset.legend.find((b) => value >= b.min && value <= b.max) || activeDataset.legend[activeDataset.legend.length - 1];
  }
  function colorFor(code) {
    const row = valueMap(activeDataset).get(code);
    return levelFor(row?.metric_value)?.color || "#C9CED6";
  }
  function renderSidebar() {
    const layer = currentLayer();
    const metric = currentMetric();
    document.getElementById("layer-list").innerHTML = data.layers.map((l) => `
      <button class="layer-btn ${l.code === state.layer ? "active" : ""}" data-layer="${l.code}">
        <i>${l.code === "mentors" ? "人" : l.code === "labs" ? "验" : "数"}</i>
        <span>${l.name}</span><span class="layer-count">31/31</span>
      </button>`).join("");
    document.getElementById("metric-select").innerHTML = layer.metrics.map((m) =>
      `<option value="${m.key}" ${m.key === state.metric ? "selected" : ""}>${m.label}</option>`).join("");
    document.getElementById("coverage").textContent = `${activeDataset.values.filter((v) => v.metric_value != null).length}/31`;
    document.getElementById("legend").innerHTML = activeDataset.legend.map((b) => `
      <div class="legend-row"><span class="swatch" style="background:${b.color}"></span><span>${b.label}</span>
      <span class="legend-range">${fmt(b.min, 3)}–${fmt(b.max, 3)} ${b.unit || metric.unit}</span></div>`).join("") +
      `<div class="legend-row"><span class="swatch" style="background:#C9CED6"></span><span>数据不足 / 非大陆</span></div>`;
    document.getElementById("current-note").textContent = metric.note || "";
    if (map?.getLayer("province-fill")) {
      map.setPaintProperty("province-fill", "fill-color", buildColorExpression());
    }
    updateDetail();
  }
  function buildColorExpression() {
    const expr = ["match", ["get", "code"]];
    for (const feature of geo.features) {
      expr.push(feature.properties.code, colorFor(feature.properties.code));
    }
    expr.push("#C9CED6");
    return expr;
  }
  function updateDetail() {
    const row = valueMap(activeDataset).get(state.selected);
    const props = regionProps.get(state.selected) || { name: state.selected, short_name: state.selected };
    const metric = currentMetric();
    document.getElementById("detail").innerHTML = `
      <div class="eyebrow">Official indicator</div>
      <div class="detail-region">${esc(props.name)}</div>
      <div class="detail-meta">${esc(state.selected)} · 初中 · ${state.year}</div>
      <div class="detail-kpis">
        <div><div class="k">指标值</div><div class="v">${row?.metric_value != null ? fmt(row.metric_value, metric.unit === "㎡/生" ? 3 : 2) : "—"} <span class="metric-label">${esc(metric.unit)}</span></div></div>
        <div><div class="k">统计年份</div><div class="v">${state.year}</div></div>
        <div><div class="k">覆盖</div><div class="v">${activeDataset.values.filter((v) => v.metric_value != null).length}/31</div></div>
        <div><div class="k">数据级别</div><div class="v" style="font-size:10px">官方计算</div></div>
      </div>
      <div class="panel" style="margin-top:12px">
        <div class="metric-label">当前指标</div>
        <div style="font-weight:600;font-size:12px;margin-top:3px">${esc(metric.label)}</div>
        <div class="formula">${esc(metric.formula)}<br>${row?.numerator ? `${esc(row.numerator.label)}：${fmt(row.numerator.value, 2)} ${esc(row.numerator.unit)} ÷ ${esc(row.denominator.label)}：${fmt(row.denominator.value, 0)} ${esc(row.denominator.unit)}` : ""}</div>
        <div class="source-link">${sourceHtml(row)}</div>
      </div>
      <div class="detail-cats">${data.layers.map((l) => {
        const m = metricDef(l, l.default_metric);
        const d = getDataset(data, state.year, m.key);
        const r = valueMap(d).get(state.selected);
        return `<button data-layer="${l.code}"><span>${l.name}</span><span>${r?.metric_value != null ? fmt(r.metric_value, m.unit === "㎡/生" ? 3 : 2) + " " + m.unit : "数据不足"}</span></button>`;
      }).join("")}</div>
      <div class="note" style="margin-top:12px">展示供给侧配置指标，不计算需求缺口、未满足比例或综合排名。</div>`;
    document.querySelectorAll("#detail [data-layer]").forEach((b) => b.addEventListener("click", () => selectLayer(b.dataset.layer)));
  }
  function selectLayer(code) {
    state.layer = code;
    state.metric = currentLayer().default_metric;
    setDataset();
    renderSidebar();
  }
  function setDataset() {
    currentMetric();
    activeDataset = getDataset(data, state.year, state.metric);
    const badge = document.getElementById("map-year-badge");
    if (badge) badge.textContent = state.year;
    const layerBadge = document.getElementById("map-layer-badge");
    if (layerBadge) layerBadge.textContent = currentLayer().name;
  }
  function initMap() {
    map = new maplibregl.Map({
      container: "map",
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#eef1eb" } }] },
      center: [104, 35], zoom: 2.7, attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("provinces", { type: "geojson", data: geo });
      map.addLayer({ id: "province-fill", type: "fill", source: "provinces", paint: { "fill-color": buildColorExpression(), "fill-opacity": 1 } });
      map.addLayer({ id: "province-line", type: "line", source: "provinces", paint: { "line-color": "#ffffff", "line-width": 0.7 } });
      map.on("click", "province-fill", (e) => { state.selected = e.features[0].properties.code; updateDetail(); });
      map.on("mousemove", "province-fill", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const p = e.features[0].properties;
        const row = valueMap(activeDataset).get(p.code);
        const metric = currentMetric();
        new maplibregl.Popup({ closeButton: false, offset: 6 })
          .setLngLat(e.lngLat)
          .setHTML(`<strong>${esc(p.name)}</strong><br>${esc(metric.label)}：${row?.metric_value != null ? fmt(row.metric_value, 3) + " " + esc(metric.unit) : "数据不足"}`)
          .addTo(map);
      });
      map.on("mouseleave", "province-fill", () => { map.getCanvas().style.cursor = ""; });
      map.fitBounds([[73, 17], [135, 54]], { padding: 20, duration: 0 });
    });
  }

  document.getElementById("year").value = String(state.year);
  document.addEventListener("change", (e) => {
    if (e.target.id === "year") { state.year = Number(e.target.value); setDataset(); renderSidebar(); }
    if (e.target.id === "metric-select") { state.metric = e.target.value; setDataset(); renderSidebar(); }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-layer]");
    if (b) selectLayer(b.dataset.layer);
  });
  setDataset();
  renderSidebar();
  initMap();
})();


