(async function () {
  document.getElementById("site-header").innerHTML = header("map");
  document.getElementById("site-footer").innerHTML = footer();
  const data = await loadDemoData();
  const geo = demoState.geo;
  const params = new URLSearchParams(location.search);
  const validCodes = new Set(geo.features.map((f) => f.properties.code));
  const state = {
    layer: data.layers.some((l) => l.code === params.get("layer")) ? params.get("layer") : "labs",
    year: [2022, 2023, 2024].includes(Number(params.get("year"))) ? Number(params.get("year")) : 2024,
    metric: params.get("metric") || "junior_lab_area_per_student",
    selected: validCodes.has(params.get("region")) ? params.get("region") : (validCodes.has("340000") ? "340000" : geo.features[0].properties.code),
  };
  const regionProps = regionMap(geo);
  let map;
  let popup;
  let activeDataset;
  let activeLevels;

  function currentLayer() { return data.layers.find((l) => l.code === state.layer); }
  function currentMetric() {
    const layer = currentLayer();
    if (!(layer.metrics || []).some((m) => m.key === state.metric)) state.metric = layer.default_metric;
    return metricDef(layer, state.metric);
  }
  function clearPopup() {
    if (popup) popup.remove();
    if (map) map.getCanvas().style.cursor = "";
  }
  function colorFor(code) {
    return activeLevels.get(code)?.color || "#C9CED6";
  }
  function setPaint() {
    if (map?.getLayer("province-fill")) {
      map.setPaintProperty("province-fill", "fill-color", buildColorExpression());
    }
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
    const covered = activeDataset.values.filter((v) => v.metric_value != null).length;
    document.getElementById("coverage").textContent = `${covered}/31`;
    document.getElementById("legend").innerHTML = activeDataset.legend.map((b) => `
      <div class="legend-row"><span class="swatch" style="background:${b.color}"></span><span>${b.label}</span>
      <span class="legend-range">${fmt(b.min, 3)}–${fmt(b.max, 3)} ${b.unit || metric.unit}</span></div>`).join("") +
      `<div class="legend-row"><span class="swatch" style="background:#C9CED6"></span><span>数据不足 / 非大陆</span></div>`;
    document.getElementById("current-note").textContent = metric.note || "";
    setPaint();
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
    const hasValue = row?.metric_value !== null && row?.metric_value !== undefined;
    const display = hasValue
      ? `${fmt(row.metric_value, metric.unit === "㎡/生" ? 3 : 2)} <span class="metric-label">${esc(metric.unit)}</span>`
      : `<span style="font-size:12px;color:#8b958f">数据不足</span>`;
    document.getElementById("detail").innerHTML = `
      <div class="eyebrow">Official indicator</div>
      <div class="detail-region">${esc(props.name)}</div>
      <div class="detail-meta">${esc(state.selected)} · 初中 · ${state.year}</div>
      <div class="detail-kpis">
        <div><div class="k">指标值</div><div class="v">${display}</div></div>
        <div><div class="k">统计年份</div><div class="v">${state.year}</div></div>
        <div><div class="k">覆盖</div><div class="v">${activeDataset.values.filter((v) => v.metric_value != null).length}/31</div></div>
        <div><div class="k">数据级别</div><div class="v" style="font-size:10px">官方计算</div></div>
      </div>
      <div class="panel" style="margin-top:12px">
        <div class="metric-label">当前指标</div>
        <div style="font-weight:600;font-size:12px;margin-top:3px">${esc(metric.label)}</div>
        <div class="formula">${esc(metric.formula)}${hasValue ? `<br>${esc(row.numerator.label)}：${fmt(row.numerator.value, 2)} ${esc(row.numerator.unit)} ÷ ${esc(row.denominator.label)}：${fmt(row.denominator.value, 0)} ${esc(row.denominator.unit)}` : `<br>${esc(row?.missing_reason || "该地区当年该指标无同口径数据。")}`}</div>
        <div class="source-link">${hasValue ? sourceHtml(row) : "无可用核验来源"}</div>
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
    clearPopup();
    if (code === state.layer) return;
    state.layer = code;
    state.metric = currentLayer().default_metric;
    setDataset();
    renderSidebar();
  }
  function setDataset() {
    currentMetric();
    activeDataset = getDataset(data, state.year, state.metric);
    activeLevels = classifyDataset(activeDataset);
    const badge = document.getElementById("map-year-badge");
    if (badge) badge.textContent = state.year;
    const layerBadge = document.getElementById("map-layer-badge");
    if (layerBadge) layerBadge.textContent = currentLayer().name;
    setPaint();
  }
  function initMap() {
    popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, className: "hover-popup" });
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
      map.on("click", "province-fill", (e) => {
        state.selected = e.features[0].properties.code;
        clearPopup();
        updateDetail();
      });
      map.on("mousemove", "province-fill", (e) => {
        if (!e.features?.length) return;
        map.getCanvas().style.cursor = "pointer";
        const p = e.features[0].properties;
        const row = valueMap(activeDataset).get(p.code);
        const metric = currentMetric();
        const text = row?.metric_value != null
          ? `${fmt(row.metric_value, 3)} ${esc(metric.unit)}`
          : "数据不足";
        popup.setLngLat(e.lngLat)
          .setHTML(`<strong>${esc(p.name)}</strong><br>${esc(metric.label)}：${text}`)
          .addTo(map);
      });
      map.on("mouseleave", "province-fill", clearPopup);
      map.on("dragstart", clearPopup);
      map.on("zoomstart", clearPopup);
      map.on("click", clearPopup);
      map.fitBounds([[73, 17], [135, 54]], { padding: 20, duration: 0 });
      map.resize();
      setTimeout(() => map.resize(), 250);
    });
    window.addEventListener("resize", () => map.resize());
  }

  document.getElementById("year").value = String(state.year);
  document.addEventListener("change", (e) => {
    if (e.target.id === "year" || e.target.id === "metric-select") {
      clearPopup();
      if (e.target.id === "year") state.year = Number(e.target.value);
      else state.metric = e.target.value;
      setDataset();
      renderSidebar();
    }
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-layer]");
    if (b) selectLayer(b.dataset.layer);
  });
  setDataset();
  renderSidebar();
  initMap();
})();

