const { sha256Buffer } = require("./data");

const SERIES_STYLE = Object.freeze({
  PER_SHARE: { color: "#1F4E79", dash: "none", marker: "circle", label: "PER_SHARE" },
  MERKLE_ROOT: { color: "#B35C00", dash: "18 11", marker: "square", label: "MERKLE_ROOT" },
});
const COMPONENT_STYLE = Object.freeze({
  share_load_time_ms: { label: "Dataset load", fill: "url(#component-load)" },
  blockchain_query_time_ms: { label: "Blockchain query", fill: "url(#component-query)" },
  verification_time_ms: { label: "Verification", fill: "url(#component-verify)" },
  merkle_proof_time_ms: { label: "Merkle proof", fill: "url(#component-proof)" },
  sss_reconstruction_time_ms: { label: "SSS reconstruction", fill: "url(#component-sss)" },
});

function escapeXml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dimensionsFor(kind, variant) {
  if (kind === "components_full") return variant === "single"
    ? { width: 1016, height: 1250 }
    : { width: 2100, height: 1100 };
  if (kind === "components_representative") return variant === "single"
    ? { width: 1016, height: 1500 }
    : { width: 2100, height: 900 };
  return variant === "single"
    ? { width: 1016, height: 780 }
    : { width: 2100, height: 1200 };
}

function typography(width) {
  const single = width < 1500;
  return {
    title: single ? 38 : 52,
    axis: single ? 31 : 42,
    tick: single ? 26 : 34,
    legend: single ? 27 : 36,
    note: single ? 24 : 31,
    stroke: single ? 4 : 6,
    marker: single ? 9 : 13,
  };
}

function niceCeil(value) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const normalized = value / power;
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const nice = steps.find((step) => normalized <= step) ?? 10;
  return nice * power;
}

function linearTicks(minimum, maximum, count = 5) {
  const range = maximum - minimum;
  const rawStep = range / count;
  const power = 10 ** Math.floor(Math.log10(rawStep || 1));
  const normalized = rawStep / power;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * power;
  const start = Math.ceil(minimum / step) * step;
  const output = [];
  for (let value = start; value <= maximum + step * 0.001; value += step) output.push(value);
  return output;
}

function numberLabel(value) {
  const absolute = Math.abs(value);
  if (absolute >= 1e6) return `${(value / 1e6).toFixed(value % 1e6 === 0 ? 0 : 1)}M`;
  if (absolute >= 1e3) return `${(value / 1e3).toFixed(value % 1e3 === 0 ? 0 : 1)}k`;
  if (absolute >= 100) return value.toFixed(0);
  if (absolute >= 10) return value.toFixed(0);
  if (absolute >= 1) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function svgHeader(width, height, title, data) {
  const digest = sha256Buffer(Buffer.from(JSON.stringify(data), "utf8"));
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-desc">` +
    `<title id="chart-title">${escapeXml(title)}</title>` +
    `<desc id="chart-desc">Publication figure generated from validated Final Statistics.</desc>` +
    `<metadata id="plot-data" data-sha256="${digest}">${escapeXml(JSON.stringify(data))}</metadata>` +
    `<rect width="${width}" height="${height}" fill="#FFFFFF"/>`;
}

function marker(shape, x, y, radius, color, fill = "#FFFFFF") {
  if (shape === "square") {
    return `<rect x="${x - radius}" y="${y - radius}" width="${2 * radius}" height="${2 * radius}" fill="${fill}" stroke="${color}" stroke-width="${Math.max(2, radius / 3)}"/>`;
  }
  if (shape === "diamond") {
    return `<path d="M ${x} ${y - radius} L ${x + radius} ${y} L ${x} ${y + radius} L ${x - radius} ${y} Z" fill="${fill}" stroke="${color}" stroke-width="${Math.max(2, radius / 3)}"/>`;
  }
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${color}" stroke-width="${Math.max(2, radius / 3)}"/>`;
}

function baseAxes({ width, height, title, yLabel, n, yTicks, xFor, yFor, margins, type, yTickLabel = numberLabel }) {
  const parts = [];
  const fonts = typography(width);
  const plotWidth = width - margins.left - margins.right;
  const plotHeight = height - margins.top - margins.bottom;
  parts.push(`<text x="${width / 2}" y="${fonts.title + 15}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.title}" font-weight="600" fill="#1A1A1A">${escapeXml(title)}</text>`);
  for (const tick of yTicks) {
    const y = yFor(tick);
    parts.push(`<line x1="${margins.left}" y1="${y}" x2="${margins.left + plotWidth}" y2="${y}" stroke="#D9D9D9" stroke-width="2"/>`);
    parts.push(`<text x="${margins.left - 18}" y="${y + fonts.tick * 0.34}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.tick}" fill="#333333">${escapeXml(yTickLabel(tick))}</text>`);
  }
  n.forEach((value, index) => {
    const x = xFor(index);
    parts.push(`<line x1="${x}" y1="${margins.top + plotHeight}" x2="${x}" y2="${margins.top + plotHeight + 10}" stroke="#222222" stroke-width="3"/>`);
    parts.push(`<text x="${x}" y="${margins.top + plotHeight + fonts.tick + 20}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.tick}" fill="#222222">${value}</text>`);
  });
  parts.push(`<line x1="${margins.left}" y1="${margins.top}" x2="${margins.left}" y2="${margins.top + plotHeight}" stroke="#222222" stroke-width="3"/>`);
  parts.push(`<line x1="${margins.left}" y1="${margins.top + plotHeight}" x2="${margins.left + plotWidth}" y2="${margins.top + plotHeight}" stroke="#222222" stroke-width="3"/>`);
  parts.push(`<text x="${margins.left + plotWidth / 2}" y="${height - 25}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.axis}" fill="#111111">Number of shares (n)</text>`);
  parts.push(`<text x="${30}" y="${margins.top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 30 ${margins.top + plotHeight / 2})" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.axis}" fill="#111111">${escapeXml(yLabel)}</text>`);
  return { parts, fonts, plotWidth, plotHeight, type };
}

function legend(width, y, series, fonts) {
  const itemWidth = width < 1500 ? 330 : 440;
  const total = itemWidth * series.length;
  const start = (width - total) / 2;
  return series.map((item, index) => {
    const style = SERIES_STYLE[item.name];
    const x = start + index * itemWidth;
    return `<g><line x1="${x}" y1="${y}" x2="${x + 70}" y2="${y}" stroke="${style.color}" stroke-width="${fonts.stroke}" ${style.dash === "none" ? "" : `stroke-dasharray="${style.dash}"`}/>` +
      marker(style.marker, x + 35, y, fonts.marker, style.color) +
      `<text x="${x + 90}" y="${y + fonts.legend * 0.35}" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.legend}" fill="#222222">${style.label}</text></g>`;
  }).join("");
}

function lineChart(data, variant) {
  const { width, height } = dimensionsFor(data.kind, variant);
  const fonts = typography(width);
  const margins = width < 1500
    ? { left: 135, right: 45, top: 165, bottom: 120 }
    : { left: 205, right: 75, top: 215, bottom: 170 };
  const plotWidth = width - margins.left - margins.right;
  const plotHeight = height - margins.top - margins.bottom;
  const xFor = (index) => margins.left + (data.n.length === 1 ? plotWidth / 2 : index * plotWidth / (data.n.length - 1));
  const allUpper = data.series.flatMap((series) => series.upper ?? series.values);
  let yMinimum = 0;
  let yMaximum;
  let yTicks;
  let yFor;
  let yTickLabel = numberLabel;
  if (data.yScale === "log") {
    yMinimum = 1e4;
    yMaximum = 1e8;
    yTicks = [1e4, 1e5, 1e6, 1e7, 1e8];
    yFor = (value) => margins.top + plotHeight *
      (1 - (Math.log10(value) - Math.log10(yMinimum)) / (Math.log10(yMaximum) - Math.log10(yMinimum)));
    yTickLabel = (value) => `10^${Math.round(Math.log10(value))}`;
  } else {
    const headroom = data.significantN ? 1.22 : 1.1;
    yMaximum = niceCeil(Math.max(...allUpper) * headroom);
    yTicks = linearTicks(yMinimum, yMaximum, 5);
    yFor = (value) => margins.top + plotHeight * (1 - (value - yMinimum) / (yMaximum - yMinimum));
  }
  const axes = baseAxes({ width, height, title: data.title, yLabel: data.yLabel, n: data.n,
    yTicks, xFor, yFor, margins, type: data.yScale, yTickLabel });
  const parts = [svgHeader(width, height, data.title, data), ...axes.parts,
    legend(width, width < 1500 ? 104 : 135, data.series, fonts)];
  data.series.forEach((series) => {
    const style = SERIES_STYLE[series.name];
    const points = series.values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
    parts.push(`<polyline points="${points}" fill="none" stroke="${style.color}" stroke-width="${fonts.stroke}" stroke-linejoin="round" stroke-linecap="round" ${style.dash === "none" ? "" : `stroke-dasharray="${style.dash}"`}/>`);
    series.values.forEach((value, index) => {
      const x = xFor(index);
      if (series.lower && series.upper) {
        const low = yFor(series.lower[index]);
        const high = yFor(series.upper[index]);
        const cap = fonts.marker * 0.9;
        parts.push(`<line x1="${x}" y1="${low}" x2="${x}" y2="${high}" stroke="${style.color}" stroke-width="${Math.max(2, fonts.stroke * 0.65)}"/>`);
        parts.push(`<line x1="${x - cap}" y1="${low}" x2="${x + cap}" y2="${low}" stroke="${style.color}" stroke-width="${Math.max(2, fonts.stroke * 0.65)}"/>`);
        parts.push(`<line x1="${x - cap}" y1="${high}" x2="${x + cap}" y2="${high}" stroke="${style.color}" stroke-width="${Math.max(2, fonts.stroke * 0.65)}"/>`);
      }
      parts.push(marker(style.marker, x, yFor(value), fonts.marker, style.color));
    });
  });
  if (data.significantN) {
    const topByIndex = data.n.map((_, index) => Math.max(...data.series.map((series) =>
      series.upper?.[index] ?? series.values[index])));
    data.n.forEach((n, index) => {
      if (!data.significantN.includes(n)) return;
      const y = yFor(topByIndex[index] + yMaximum * 0.045);
      parts.push(marker("diamond", xFor(index), y, fonts.marker * 0.8, "#333333", "#FFFFFF"));
    });
  }
  if (data.annotation) {
    parts.push(`<text x="${width - margins.right}" y="${margins.top + fonts.note}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.note}" fill="#3A3A3A">${escapeXml(data.annotation)}</text>`);
  }
  parts.push("</svg>\n");
  return { svg: parts.join(""), width, height };
}

function reductionChart(data, variant) {
  const { width, height } = dimensionsFor(data.kind, variant);
  const fonts = typography(width);
  const margins = width < 1500
    ? { left: 125, right: 75, top: 115, bottom: 120 }
    : { left: 185, right: 105, top: 150, bottom: 170 };
  const plotWidth = width - margins.left - margins.right;
  const plotHeight = height - margins.top - margins.bottom;
  const xFor = (index) => margins.left + index * plotWidth / (data.n.length - 1);
  const yFor = (value) => margins.top + plotHeight * (1 - value / 100);
  const axes = baseAxes({ width, height, title: data.title, yLabel: data.yLabel, n: data.n,
    yTicks: [0, 20, 40, 60, 80, 100], xFor, yFor, margins, type: "linear",
    yTickLabel: (value) => `${value}%` });
  const parts = [svgHeader(width, height, data.title, data), ...axes.parts];
  const points = data.values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
  parts.push(`<polyline points="${points}" fill="none" stroke="#2B6B3F" stroke-width="${fonts.stroke}" stroke-linejoin="round"/>`);
  data.values.forEach((value, index) => {
    const x = xFor(index); const y = yFor(value);
    parts.push(marker("diamond", x, y, fonts.marker, "#2B6B3F", "#FFFFFF"));
    parts.push(`<text x="${x}" y="${y - fonts.tick * 0.75}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.note}" font-weight="600" fill="#234F31">${value.toFixed(2)}%</text>`);
  });
  parts.push("</svg>\n");
  return { svg: parts.join(""), width, height };
}

function componentDefs() {
  return `<defs>` +
    `<pattern id="component-load" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#D7D7D7"/><path d="M0 12L12 0" stroke="#777" stroke-width="2"/></pattern>` +
    `<pattern id="component-query" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#4F81BD"/></pattern>` +
    `<pattern id="component-verify" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#F2A65A"/><path d="M-3 3L3-3M0 12L12 0M9 15L15 9" stroke="#8A4300" stroke-width="2"/></pattern>` +
    `<pattern id="component-proof" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#76A66A"/><circle cx="3" cy="3" r="1.8" fill="#244B22"/><circle cx="9" cy="9" r="1.8" fill="#244B22"/></pattern>` +
    `<pattern id="component-sss" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#9A7BB5"/><path d="M0 0L12 12M12 0L0 12" stroke="#513568" stroke-width="1.5"/></pattern>` +
    `</defs>`;
}

function componentLegend(width, y, fonts, components) {
  const labels = components.map((name) => COMPONENT_STYLE[name]);
  const itemWidth = width < 1500 ? 180 : 330;
  const start = Math.max(25, (width - itemWidth * labels.length) / 2);
  return labels.map((item, index) => {
    const x = start + index * itemWidth;
    return `<rect x="${x}" y="${y - 18}" width="28" height="28" fill="${item.fill}" stroke="#333" stroke-width="1.5"/>` +
      `<text x="${x + 38}" y="${y + 5}" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.note}" fill="#222">${escapeXml(item.label)}</text>`;
  }).join("");
}

function stackedPanel({ x, y, width, height, title, rows, components, yMaximum, fonts, showYLabel = true }) {
  const left = showYLabel ? 105 : 75;
  const right = 25; const top = 55; const bottom = 70;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const barWidth = Math.min(70, plotWidth / (rows.length * 1.7));
  const xFor = (index) => x + left + (index + 0.5) * plotWidth / rows.length;
  const yFor = (value) => y + top + plotHeight * (1 - value / yMaximum);
  const parts = [`<text x="${x + width / 2}" y="${y + fonts.axis}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.axis}" font-weight="600" fill="#222">${escapeXml(title)}</text>`];
  linearTicks(0, yMaximum, 4).forEach((tick) => {
    const yy = yFor(tick);
    parts.push(`<line x1="${x + left}" y1="${yy}" x2="${x + left + plotWidth}" y2="${yy}" stroke="#DDDDDD" stroke-width="2"/>`);
    parts.push(`<text x="${x + left - 12}" y="${yy + fonts.tick * 0.33}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.tick * 0.8}" fill="#333">${numberLabel(tick)}</text>`);
  });
  parts.push(`<line x1="${x + left}" y1="${y + top}" x2="${x + left}" y2="${y + top + plotHeight}" stroke="#222" stroke-width="3"/>`);
  parts.push(`<line x1="${x + left}" y1="${y + top + plotHeight}" x2="${x + left + plotWidth}" y2="${y + top + plotHeight}" stroke="#222" stroke-width="3"/>`);
  rows.forEach((row, index) => {
    let cumulative = 0;
    components.forEach((name) => {
      const value = row.values[name] ?? 0;
      if (value <= 0) return;
      const topY = yFor(cumulative + value); const bottomY = yFor(cumulative);
      parts.push(`<rect x="${xFor(index) - barWidth / 2}" y="${topY}" width="${barWidth}" height="${Math.max(0.5, bottomY - topY)}" fill="${COMPONENT_STYLE[name].fill}" stroke="#444" stroke-width="1.2"/>`);
      cumulative += value;
    });
    parts.push(`<text x="${xFor(index)}" y="${y + top + plotHeight + fonts.tick}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.tick * 0.82}" fill="#222">${row.n}</text>`);
  });
  parts.push(`<text x="${x + left + plotWidth / 2}" y="${y + height - 8}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.note}" fill="#222">Number of shares (n)</text>`);
  if (showYLabel) parts.push(`<text x="${x + 25}" y="${y + top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 ${x + 25} ${y + top + plotHeight / 2})" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.note}" fill="#222">Mean component time (ms)</text>`);
  return parts.join("");
}

function componentsFullChart(data, variant) {
  const { width, height } = dimensionsFor(data.kind, variant);
  const fonts = typography(width);
  const sums = [...data.perShare, ...data.merkleRoot].map((row) =>
    data.components.reduce((sum, name) => sum + (row.values[name] ?? 0), 0));
  const yMaximum = niceCeil(Math.max(...sums) * 1.08);
  const parts = [svgHeader(width, height, data.title, data), componentDefs(),
    `<text x="${width / 2}" y="${fonts.title + 12}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.title}" font-weight="600" fill="#1A1A1A">${escapeXml(data.title)}</text>`,
    componentLegend(width, width < 1500 ? 100 : 120, fonts, data.components)];
  if (variant === "double") {
    parts.push(stackedPanel({ x: 25, y: 145, width: width / 2 - 40, height: height - 165,
      title: "PER_SHARE", rows: data.perShare, components: data.components, yMaximum, fonts }));
    parts.push(stackedPanel({ x: width / 2 + 15, y: 145, width: width / 2 - 40, height: height - 165,
      title: "MERKLE_ROOT", rows: data.merkleRoot, components: data.components, yMaximum, fonts }));
  } else {
    const panelHeight = (height - 150) / 2;
    parts.push(stackedPanel({ x: 10, y: 130, width: width - 20, height: panelHeight,
      title: "PER_SHARE", rows: data.perShare, components: data.components, yMaximum, fonts }));
    parts.push(stackedPanel({ x: 10, y: 130 + panelHeight, width: width - 20, height: panelHeight,
      title: "MERKLE_ROOT", rows: data.merkleRoot, components: data.components, yMaximum, fonts }));
  }
  parts.push("</svg>\n");
  return { svg: parts.join(""), width, height };
}

function representativePanel({ x, y, width, height, n, perShare, merkleRoot, components, fonts }) {
  const left = 75; const right = 20; const top = 58; const bottom = 62;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const rows = [perShare, merkleRoot];
  const maximum = niceCeil(Math.max(...rows.map((row) =>
    components.reduce((sum, name) => sum + (row.values[name] ?? 0), 0))) * 1.1);
  const yFor = (value) => y + top + plotHeight * (1 - value / maximum);
  const barWidth = Math.min(90, plotWidth / 4);
  const xPositions = [x + left + plotWidth * 0.32, x + left + plotWidth * 0.72];
  const parts = [`<text x="${x + width / 2}" y="${y + fonts.axis}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.axis}" font-weight="600">n = ${n}</text>`];
  linearTicks(0, maximum, 4).forEach((tick) => {
    const yy = yFor(tick);
    parts.push(`<line x1="${x + left}" y1="${yy}" x2="${x + left + plotWidth}" y2="${yy}" stroke="#DEDEDE" stroke-width="2"/>`);
    parts.push(`<text x="${x + left - 10}" y="${yy + fonts.tick * 0.28}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.tick * 0.7}">${numberLabel(tick)}</text>`);
  });
  parts.push(`<line x1="${x + left}" y1="${y + top}" x2="${x + left}" y2="${y + top + plotHeight}" stroke="#222" stroke-width="3"/>`);
  parts.push(`<line x1="${x + left}" y1="${y + top + plotHeight}" x2="${x + left + plotWidth}" y2="${y + top + plotHeight}" stroke="#222" stroke-width="3"/>`);
  rows.forEach((row, rowIndex) => {
    let cumulative = 0;
    components.forEach((name) => {
      const value = row.values[name] ?? 0;
      if (value <= 0) return;
      const topY = yFor(cumulative + value); const bottomY = yFor(cumulative);
      parts.push(`<rect x="${xPositions[rowIndex] - barWidth / 2}" y="${topY}" width="${barWidth}" height="${Math.max(0.5, bottomY - topY)}" fill="${COMPONENT_STYLE[name].fill}" stroke="#444" stroke-width="1.2"/>`);
      cumulative += value;
    });
    const label = rowIndex === 0 ? "PER_SHARE" : "MERKLE_ROOT";
    parts.push(`<text x="${xPositions[rowIndex]}" y="${y + top + plotHeight + fonts.tick * 0.78}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.tick * 0.68}">${label}</text>`);
  });
  return parts.join("");
}

function componentsRepresentativeChart(data, variant) {
  const { width, height } = dimensionsFor(data.kind, variant);
  const fonts = typography(width);
  const parts = [svgHeader(width, height, data.title, data), componentDefs(),
    `<text x="${width / 2}" y="${fonts.title + 12}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.title}" font-weight="600">${escapeXml(data.title)}</text>`,
    componentLegend(width, width < 1500 ? 100 : 110, fonts, data.components)];
  if (variant === "double") {
    const panelWidth = (width - 50) / 3;
    data.n.forEach((n, index) => parts.push(representativePanel({
      x: 10 + index * panelWidth, y: 135, width: panelWidth - 10, height: height - 155,
      n, perShare: data.perShare[index], merkleRoot: data.merkleRoot[index], components: data.components, fonts,
    })));
  } else {
    const panelHeight = (height - 140) / 3;
    data.n.forEach((n, index) => parts.push(representativePanel({
      x: 10, y: 125 + index * panelHeight, width: width - 20, height: panelHeight - 5,
      n, perShare: data.perShare[index], merkleRoot: data.merkleRoot[index], components: data.components, fonts,
    })));
  }
  parts.push(`<text x="${25}" y="${height / 2}" text-anchor="middle" transform="rotate(-90 25 ${height / 2})" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.note}">Mean component time (ms; panel-specific scale)</text>`);
  parts.push("</svg>\n");
  return { svg: parts.join(""), width, height };
}

function deltaChart(data, variant) {
  const { width, height } = dimensionsFor(data.kind, variant);
  const fonts = typography(width);
  const margins = width < 1500
    ? { left: 130, right: 45, top: 115, bottom: 120 }
    : { left: 195, right: 75, top: 150, bottom: 170 };
  const plotWidth = width - margins.left - margins.right;
  const plotHeight = height - margins.top - margins.bottom;
  const minimum = Math.min(0, ...data.lower); const maximum = Math.max(0, ...data.upper);
  const span = maximum - minimum;
  const yMin = Math.floor((minimum - span * 0.1) / 5) * 5;
  const yMax = Math.ceil((maximum + span * 0.1) / 5) * 5;
  const xFor = (index) => margins.left + index * plotWidth / (data.n.length - 1);
  const yFor = (value) => margins.top + plotHeight * (1 - (value - yMin) / (yMax - yMin));
  const axes = baseAxes({ width, height, title: data.title, yLabel: data.yLabel, n: data.n,
    yTicks: linearTicks(yMin, yMax, 6), xFor, yFor, margins, type: "linear" });
  const parts = [svgHeader(width, height, data.title, data), ...axes.parts];
  parts.push(`<line x1="${margins.left}" y1="${yFor(0)}" x2="${margins.left + plotWidth}" y2="${yFor(0)}" stroke="#555" stroke-width="${fonts.stroke}" stroke-dasharray="12 10"/>`);
  const points = data.values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ");
  parts.push(`<polyline points="${points}" fill="none" stroke="#4A4A4A" stroke-width="${fonts.stroke}"/>`);
  data.values.forEach((value, index) => {
    const x = xFor(index); const low = yFor(data.lower[index]); const high = yFor(data.upper[index]);
    const cap = fonts.marker;
    parts.push(`<line x1="${x}" y1="${low}" x2="${x}" y2="${high}" stroke="#1F4E79" stroke-width="${fonts.stroke * 0.7}"/>`);
    parts.push(`<line x1="${x - cap}" y1="${low}" x2="${x + cap}" y2="${low}" stroke="#1F4E79" stroke-width="${fonts.stroke * 0.7}"/>`);
    parts.push(`<line x1="${x - cap}" y1="${high}" x2="${x + cap}" y2="${high}" stroke="#1F4E79" stroke-width="${fonts.stroke * 0.7}"/>`);
    parts.push(marker("diamond", x, yFor(value), fonts.marker, "#1F4E79", "#FFFFFF"));
  });
  parts.push(`<text x="${width - margins.right}" y="${margins.top + fonts.note}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.note}" fill="#333">Positive values favor MERKLE_ROOT</text>`);
  parts.push("</svg>\n");
  return { svg: parts.join(""), width, height };
}

function renderSvg(data, variant) {
  if (data.kind === "line") return lineChart(data, variant);
  if (data.kind === "reduction") return reductionChart(data, variant);
  if (data.kind === "components_full") return componentsFullChart(data, variant);
  if (data.kind === "components_representative") return componentsRepresentativeChart(data, variant);
  if (data.kind === "delta") return deltaChart(data, variant);
  throw new Error(`unsupported publication chart kind: ${data.kind}`);
}

module.exports = { SERIES_STYLE, COMPONENT_STYLE, dimensionsFor, renderSvg };
