const { DIMENSIONS } = require("./config");
const { plottedDigest } = require("./data");

const STYLES = Object.freeze({
  OUR_PER_SHARE_ANCHORING: Object.freeze({ color: "#1F4E79", dash: "", marker: "circle", label: "Per-Share" }),
  OUR_MERKLE_ROOT_ANCHORING: Object.freeze({ color: "#B35C00", dash: "18 11", marker: "square", label: "Merkle-Root" }),
  PEDIN_PAPER_GUIDED_SETUP: Object.freeze({ color: "#5B3F8C", dash: "18 8 4 8", marker: "triangle", label: "Pedin paper-guided" }),
});

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function typography(variant) {
  return variant === "single"
    ? { title: 36, axis: 29, tick: 22, legend: 23, note: 19, stroke: 4, marker: 9 }
    : { title: 50, axis: 40, tick: 32, legend: 34, note: 28, stroke: 6, marker: 13 };
}

function marker(shape, x, y, radius, color, fill = "#FFFFFF") {
  if (shape === "square") return `<rect x="${x - radius}" y="${y - radius}" width="${radius * 2}" height="${radius * 2}" fill="${fill}" stroke="${color}" stroke-width="${Math.max(2, radius / 3)}"/>`;
  if (shape === "triangle") return `<path d="M ${x} ${y - radius * 1.15} L ${x + radius * 1.1} ${y + radius} L ${x - radius * 1.1} ${y + radius} Z" fill="${fill}" stroke="${color}" stroke-width="${Math.max(2, radius / 3)}"/>`;
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${color}" stroke-width="${Math.max(2, radius / 3)}"/>`;
}

function header(width, height, data) {
  const digest = plottedDigest(data);
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-desc">` +
    `<title id="chart-title">${escapeXml(data.title)}</title>` +
    `<desc id="chart-desc">Publication figure derived from frozen Pedin and Final Statistics files.</desc>` +
    `<metadata id="plot-data" data-sha256="${digest}">${escapeXml(JSON.stringify(data))}</metadata>` +
    `<rect width="${width}" height="${height}" fill="#FFFFFF"/>`;
}

function numericX(value, domain, left, plotWidth) {
  return left + (value - domain[0]) / (domain[1] - domain[0]) * plotWidth;
}

function axisFrame({ width, height, margins, fonts, title, xLabel, yLabel, xTicks, xDomain, yTicks, yDomain, yFormatter }) {
  const parts = [];
  const plotWidth = width - margins.left - margins.right;
  const plotHeight = height - margins.top - margins.bottom;
  const x = (value) => numericX(value, xDomain, margins.left, plotWidth);
  const y = (value) => margins.top + plotHeight * (1 - (value - yDomain[0]) / (yDomain[1] - yDomain[0]));
  parts.push(`<text x="${width / 2}" y="${fonts.title + 12}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.title}" font-weight="600" fill="#1A1A1A">${escapeXml(title)}</text>`);
  for (const value of yTicks) {
    const yy = y(value);
    parts.push(`<line x1="${margins.left}" y1="${yy}" x2="${margins.left + plotWidth}" y2="${yy}" stroke="#D9D9D9" stroke-width="2"/>`);
    parts.push(`<text x="${margins.left - 16}" y="${yy + fonts.tick * 0.34}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.tick}" fill="#333333">${escapeXml(yFormatter(value))}</text>`);
  }
  for (const value of xTicks) {
    const xx = x(value);
    parts.push(`<line x1="${xx}" y1="${margins.top + plotHeight}" x2="${xx}" y2="${margins.top + plotHeight + 9}" stroke="#222222" stroke-width="3"/>`);
    parts.push(`<text x="${xx}" y="${margins.top + plotHeight + fonts.tick + 15}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.tick}" fill="#222222">${value}</text>`);
  }
  parts.push(`<line x1="${margins.left}" y1="${margins.top}" x2="${margins.left}" y2="${margins.top + plotHeight}" stroke="#222222" stroke-width="3"/>`);
  parts.push(`<line x1="${margins.left}" y1="${margins.top + plotHeight}" x2="${margins.left + plotWidth}" y2="${margins.top + plotHeight}" stroke="#222222" stroke-width="3"/>`);
  parts.push(`<text x="${margins.left + plotWidth / 2}" y="${height - 22}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.axis}" fill="#111111">${escapeXml(xLabel)}</text>`);
  parts.push(`<text x="${fonts.axis}" y="${margins.top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 ${fonts.axis} ${margins.top + plotHeight / 2})" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.axis}" fill="#111111">${escapeXml(yLabel)}</text>`);
  return { parts, x, y, plotWidth, plotHeight };
}

function legendItem(style, x, y, fonts, markerRadius = fonts.marker) {
  return `<g><line x1="${x}" y1="${y}" x2="${x + 62}" y2="${y}" stroke="${style.color}" stroke-width="${fonts.stroke}" ${style.dash ? `stroke-dasharray="${style.dash}"` : ""}/>` +
    marker(style.marker, x + 31, y, markerRadius, style.color) +
    `<text x="${x + 78}" y="${y + fonts.legend * 0.34}" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.legend}" fill="#222222">${escapeXml(style.label)}</text></g>`;
}

function figure6Svg(data, variant) {
  const { width, height } = DIMENSIONS[variant];
  const fonts = typography(variant);
  const margins = variant === "single"
    ? { left: 135, right: 45, top: 145, bottom: 108 }
    : { left: 205, right: 75, top: 185, bottom: 155 };
  const axes = axisFrame({ width, height, margins, fonts, title: data.title,
    xLabel: "Number of Guardians / Shares (n)", yLabel: "Setup Gas Used",
    xTicks: data.n, xDomain: [2, 192], yTicks: [66780, 66800, 66820, 66840, 66860, 66880],
    yDomain: data.y_domain, yFormatter: (value) => value.toLocaleString("en-US") });
  const style = STYLES.PEDIN_PAPER_GUIDED_SETUP;
  const parts = [header(width, height, data), ...axes.parts,
    legendItem(style, width / 2 - (variant === "single" ? 155 : 220), variant === "single" ? 92 : 118, fonts)];
  const points = data.means.map((value, index) => `${axes.x(data.n[index])},${axes.y(value)}`).join(" ");
  parts.push(`<polyline points="${points}" fill="none" stroke="${style.color}" stroke-width="${fonts.stroke}" stroke-dasharray="${style.dash}" stroke-linejoin="round"/>`);
  data.means.forEach((value, index) => {
    const xx = axes.x(data.n[index]);
    const low = axes.y(data.lower[index]);
    const high = axes.y(data.upper[index]);
    const cap = fonts.marker * 0.8;
    parts.push(`<line x1="${xx}" y1="${low}" x2="${xx}" y2="${high}" stroke="${style.color}" stroke-width="${Math.max(2, fonts.stroke * 0.65)}"/>`);
    parts.push(`<line x1="${xx - cap}" y1="${low}" x2="${xx + cap}" y2="${low}" stroke="${style.color}" stroke-width="${Math.max(2, fonts.stroke * 0.65)}"/>`);
    parts.push(`<line x1="${xx - cap}" y1="${high}" x2="${xx + cap}" y2="${high}" stroke="${style.color}" stroke-width="${Math.max(2, fonts.stroke * 0.65)}"/>`);
    parts.push(marker(style.marker, xx, axes.y(value), fonts.marker, style.color));
  });
  parts.push(`<text x="${width - margins.right}" y="${margins.top + fonts.note}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="${fonts.note}" fill="#444444">Mean range: 3.6 gas (0.0054%)</text>`);
  parts.push("</svg>\n");
  return { svg: parts.join(""), width, height, plottedDataSha256: plottedDigest(data) };
}

function figure7Svg(data, variant) {
  const { width, height } = DIMENSIONS[variant];
  const fonts = typography(variant);
  const margins = variant === "single"
    ? { left: 125, right: 45, top: 195, bottom: 115 }
    : { left: 190, right: 75, top: 190, bottom: 160 };
  const axes = axisFrame({ width, height, margins, fonts, title: data.title,
    xLabel: "Number of Shares (n)", yLabel: "Normalized Gas Used (n = 10 baseline = 1.0)",
    xTicks: data.n, xDomain: [10, 100], yTicks: [0, 2, 4, 6, 8, 10], yDomain: [0, 11],
    yFormatter: (value) => value.toFixed(1) });
  const parts = [header(width, height, data), ...axes.parts];
  const legendOrder = ["OUR_PER_SHARE_ANCHORING", "OUR_MERKLE_ROOT_ANCHORING", "PEDIN_PAPER_GUIDED_SETUP"];
  if (variant === "single") {
    legendOrder.forEach((name, index) => parts.push(legendItem(STYLES[name], 275, 82 + index * 32, fonts,
      name === "PEDIN_PAPER_GUIDED_SETUP" ? fonts.marker * 1.35 : fonts.marker)));
  } else {
    const positions = [160, 780, 1325];
    legendOrder.forEach((name, index) => parts.push(legendItem(STYLES[name], positions[index], 120, fonts,
      name === "PEDIN_PAPER_GUIDED_SETUP" ? fonts.marker * 1.3 : fonts.marker)));
  }
  const drawOrder = ["OUR_MERKLE_ROOT_ANCHORING", "PEDIN_PAPER_GUIDED_SETUP", "OUR_PER_SHARE_ANCHORING"];
  for (const name of drawOrder) {
    const series = data.series.find((item) => item.mechanism === name);
    const style = STYLES[name];
    const points = series.values.map((value, index) => `${axes.x(data.n[index])},${axes.y(value)}`).join(" ");
    parts.push(`<polyline points="${points}" fill="none" stroke="${style.color}" stroke-width="${fonts.stroke}" ${style.dash ? `stroke-dasharray="${style.dash}"` : ""} stroke-linejoin="round"/>`);
    series.values.forEach((value, index) => {
      const radius = name === "PEDIN_PAPER_GUIDED_SETUP" ? fonts.marker * 1.35 :
        name === "OUR_PER_SHARE_ANCHORING" ? fonts.marker * 0.75 : fonts.marker;
      parts.push(marker(style.marker, axes.x(data.n[index]), axes.y(value), radius, style.color,
        name === "OUR_PER_SHARE_ANCHORING" ? style.color :
          name === "PEDIN_PAPER_GUIDED_SETUP" ? "none" : "#FFFFFF"));
    });
  }
  parts.push("</svg>\n");
  return { svg: parts.join(""), width, height, plottedDataSha256: plottedDigest(data) };
}

function renderFigure(figureId, data, variant) {
  if (figureId === "figure6_pedin_paper_grid_setup_gas") return figure6Svg(data, variant);
  if (figureId === "figure7_normalized_common_grid_scalability") return figure7Svg(data, variant);
  throw new Error(`unknown Pedin publication figure: ${figureId}`);
}

module.exports = { STYLES, typography, figure6Svg, figure7Svg, renderFigure };
