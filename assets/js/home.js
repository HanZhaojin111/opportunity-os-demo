(async function () {
  document.getElementById("site-header").innerHTML = header("home");
  document.getElementById("site-footer").innerHTML = footer();
  const data = await loadDemoData();
  const latest = getDataset(data, 2024, "junior_lab_area_per_student");
  const vals = latest.values.filter((v) => v.metric_value != null).map((v) => v.metric_value);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  document.getElementById("brief").outerHTML = `
    <aside class="brief">
      <div class="eyebrow">National brief</div>
      <div style="margin-top:9px;font-weight:600">初中阶段官方配置信号</div>
      <div class="brief-grid">
        <div><div class="metric-label">省级分析单元</div><div class="metric-value">31<span> 个</span></div></div>
        <div><div class="metric-label">地图图层</div><div class="metric-value">3<span> / 3</span></div></div>
        <div><div class="metric-label">2024 生均实验室面积</div><div class="metric-value">${fmt(avg, 3)}<span> ㎡/生</span></div></div>
        <div><div class="metric-label">统计年份</div><div class="metric-value">2024<span> · 初中</span></div></div>
      </div>
      <div style="border-top:1px solid var(--line);margin-top:18px;padding-top:12px" class="metric-label">
        同一指标按全国 31 个大陆省级单元等分五档；深色为相对优先关注，不是需求缺口或教育质量评价。
      </div>
    </aside>`;
  document.getElementById("layer-cards").innerHTML = data.layers.map((layer, i) => {
    const metric = metricDef(layer, layer.default_metric);
    const ds = getDataset(data, 2024, metric.key);
    const good = ds.values.filter((v) => v.metric_value != null);
    const mean = good.reduce((a, b) => a + b.metric_value, 0) / good.length;
    return `<a class="card" href="./map.html?layer=${layer.code}&year=2024">
      <span class="pill">0${i + 1} · ${layer.name}</span>
      <h3>${layer.name}</h3>
      <p>${layer.description}</p>
      <div class="big">${fmt(mean, metric.unit === "㎡/生" ? 3 : 2)} <span class="metric-label">${metric.unit}</span></div>
      <p>${metric.label} · 2024 · 覆盖 ${good.length}/31</p>
    </a>`;
  }).join("");
})();
