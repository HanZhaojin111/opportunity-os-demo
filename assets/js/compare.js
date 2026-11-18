(async function () {
  document.getElementById("site-header").innerHTML = header("compare");
  document.getElementById("site-footer").innerHTML = footer();
  const data = await loadDemoData();
  const geo = demoState.geo;
  const geoMap = regionMap(geo);
  const mainlands = geo.features.map((f) => f.properties).filter((p) => !["710000", "810000", "820000"].includes(p.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  const params = new URLSearchParams(location.search);
  const codes = (params.get("regions") || "340000,110000").split(",").filter(Boolean).slice(0, 2);
  const state = {
    year: [2022, 2023, 2024].includes(Number(params.get("year"))) ? Number(params.get("year")) : 2023,
    category: data.layers.some((l) => l.code === params.get("category")) ? params.get("category") : "labs",
    metric: params.get("metric") || "junior_lab_area_per_student",
    codes: [codes[0] || "340000", codes[1] || "110000"],
  };
  let chart;
  function layer() { return data.layers.find((l) => l.code === state.category); }
  function metric() {
    const l = layer();
    if (!(l.metrics || []).some((m) => m.key === state.metric)) state.metric = l.default_metric;
    return metricDef(l, state.metric);
  }
  function ds() { return getDataset(data, state.year, metric().key); }
  function optionHtml(selected) {
    return mainlands.map((p) => `<option value="${p.code}" ${p.code === selected ? "selected" : ""}>${p.name}</option>`).join("");
  }
  function coverage(code) {
    let count = 0;
    for (const l of data.layers) {
      const m = metricDef(l, l.default_metric);
      const row = valueMap(getDataset(data, state.year, m.key)).get(code);
      if (row?.metric_value != null) count++;
    }
    return `${count}/3`;
  }
  function render() {
    const l = layer();
    const m = metric();
    const d = ds();
    document.getElementById("category-tabs").innerHTML = data.layers.map((x) =>
      `<button class="tab ${x.code === state.category ? "active" : ""}" data-category="${x.code}">${x.name}</button>`).join("");
    document.getElementById("metric-select").innerHTML = l.metrics.map((x) =>
      `<option value="${x.key}" ${x.key === state.metric ? "selected" : ""}>${x.label}（${x.unit}）</option>`).join("");
    const rows = state.codes.map((code) => {
      const p = geoMap.get(code) || { name: code, short_name: code };
      return { code, p, row: valueMap(d).get(code) };
    });
    document.getElementById("chart-title").textContent = `${m.label}对比`;
    document.getElementById("chart-sub").textContent = `单位：${m.unit} · ${state.year} 年 · 初中；只比较同一指标。`;
    document.getElementById("chart-formula").textContent = `${m.formula} · ${m.note || ""}`;
    const chartEl = document.getElementById("chart");
    const existingChart = echarts.getInstanceByDom(chartEl);
    if (existingChart) existingChart.dispose();
    chartEl.innerHTML = "";
    chart = echarts.init(chartEl);
    chart.setOption({
      grid: { left: 20, right: 20, top: 30, bottom: 20, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (v) => v == null ? "数据不足" : `${v} ${m.unit}` },
      xAxis: { type: "category", data: rows.map((r) => r.p.short_name), axisTick: { show: false }, axisLine: { lineStyle: { color: "#e3e6e1" } }, axisLabel: { color: "#65706d", fontSize: 11 } },
      yAxis: { type: "value", splitLine: { lineStyle: { color: "#eef0ec" } }, axisLabel: { color: "#98a19c", fontSize: 9 } },
      series: [{ type: "bar", barMaxWidth: 44, itemStyle: { color: "#2f7d6e", borderRadius: [3, 3, 0, 0] }, label: { show: true, position: "top", fontSize: 9, formatter: (p) => p.value == null ? "数据不足" : p.value }, data: rows.map((r) => r.row?.metric_value ?? null) }],
    });
    document.getElementById("compare-table").innerHTML = `<table class="data"><thead><tr><th>地区</th><th>指标值</th><th>单位</th><th>分子</th><th>分母</th><th>年份</th><th>来源</th></tr></thead><tbody>${rows.map((r) => `<tr><td><strong>${esc(r.p.name)}</strong><br><span class="detail-meta">${r.code}</span></td><td>${r.row?.metric_value != null ? fmt(r.row.metric_value, 3) : "数据不足"}</td><td>${esc(r.row?.metric_unit || m.unit)}</td><td>${r.row?.numerator ? fmt(r.row.numerator.value, 2) + " " + esc(r.row.numerator.unit) : "—"}</td><td>${r.row?.denominator ? fmt(r.row.denominator.value, 0) + " " + esc(r.row.denominator.unit) : "—"}</td><td>${state.year}</td><td style="max-width:180px">${sourceHtml(r.row)}</td></tr>`).join("")}</tbody></table>`;
    document.getElementById("region-cards").innerHTML = rows.map((r) => `<div class="card" style="padding:14px"><div style="display:flex;justify-content:space-between;gap:8px"><div><strong>${esc(r.p.name)}</strong><div class="metric-label">对比类别覆盖 ${coverage(r.code)}</div></div><div style="text-align:right"><div class="metric-value" style="font-size:16px">${r.row?.metric_value != null ? fmt(r.row.metric_value, 3) : "—"} <span>${esc(m.unit)}</span></div><div class="metric-label">${esc(m.label)}</div></div></div></div>`).join("");
    document.getElementById("coverage-note").textContent = `对比类别覆盖按当前年份有三类有效数据的类别数计算；同一类别多指标只计一次。`;
    if (chart) chart.resize();
  }
  function initSelects() {
    document.getElementById("region-a").innerHTML = optionHtml(state.codes[0]);
    document.getElementById("region-b").innerHTML = optionHtml(state.codes[1]);
    document.getElementById("year").value = String(state.year);
  }
  document.addEventListener("change", (e) => {
    if (e.target.id === "year") { state.year = Number(e.target.value); render(); }
    if (e.target.id === "metric-select") { state.metric = e.target.value; render(); }
    if (e.target.id === "region-a") { state.codes[0] = e.target.value; render(); }
    if (e.target.id === "region-b") { state.codes[1] = e.target.value; render(); }
  });
  document.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-category]");
    if (tab) { state.category = tab.dataset.category; state.metric = layer().default_metric; render(); }
  });
  window.addEventListener("resize", () => chart?.resize());
  initSelects();
  render();
})();

