const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { paths } = require("../config/pedinConfig");
const { renderWithBrowser } = require("../../../experiments/publicationAssets/renderer");

const WIDTH = 1800;
const HEIGHT = 1050;
const MARGIN = Object.freeze({ left: 190, right: 80, top: 180, bottom: 150 });
const STYLES = Object.freeze({
  PEDIN_PAPER_GUIDED_SETUP: { color: "#1F4E79", dash: "", marker: "circle", label: "Pedin paper-guided setup" },
  OUR_MERKLE_ROOT_ANCHORING: { color: "#B35C00", dash: "18 11", marker: "square", label: "Our Merkle-Root anchoring" },
  OUR_PER_SHARE_ANCHORING: { color: "#555555", dash: "5 9", marker: "triangle", label: "Our Per-Share anchoring" },
});

function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function marker(style, x, y) {
  if (style.marker === "square") return `<rect x="${x - 8}" y="${y - 8}" width="16" height="16" fill="#fff" stroke="${style.color}" stroke-width="4"/>`;
  if (style.marker === "triangle") return `<path d="M${x},${y - 10} L${x + 10},${y + 9} L${x - 10},${y + 9} Z" fill="#fff" stroke="${style.color}" stroke-width="4"/>`;
  return `<circle cx="${x}" cy="${y}" r="8" fill="#fff" stroke="${style.color}" stroke-width="4"/>`;
}

function niceMaximum(value) {
  const power = 10 ** Math.floor(Math.log10(value || 1));
  return Math.ceil(value / power * 1.1) * power;
}

function chartSvg({ title, yLabel, n, series, note }) {
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maximum = niceMaximum(Math.max(...series.flatMap((item) => item.upper || item.values)));
  const x = (index) => MARGIN.left + index * plotWidth / (n.length - 1);
  const y = (value) => MARGIN.top + plotHeight * (1 - value / maximum);
  const digest = crypto.createHash("sha256").update(JSON.stringify({ n, series })).digest("hex");
  const out = [`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<metadata data-source-sha256="${digest}">${escapeXml(JSON.stringify({ n, series }))}</metadata>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#fff"/>`,
    `<text x="${WIDTH / 2}" y="65" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="46" font-weight="600">${escapeXml(title)}</text>`];
  for (let tick = 0; tick <= 5; tick += 1) {
    const value = maximum * tick / 5;
    const yy = y(value);
    out.push(`<line x1="${MARGIN.left}" y1="${yy}" x2="${WIDTH - MARGIN.right}" y2="${yy}" stroke="#dedede" stroke-width="2"/>`);
    out.push(`<text x="${MARGIN.left - 22}" y="${yy + 10}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="28">${Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(2)}</text>`);
  }
  n.forEach((value, index) => out.push(`<text x="${x(index)}" y="${HEIGHT - MARGIN.bottom + 50}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="27">${value}</text>`));
  out.push(`<line x1="${MARGIN.left}" y1="${MARGIN.top}" x2="${MARGIN.left}" y2="${HEIGHT - MARGIN.bottom}" stroke="#222" stroke-width="3"/>`);
  out.push(`<line x1="${MARGIN.left}" y1="${HEIGHT - MARGIN.bottom}" x2="${WIDTH - MARGIN.right}" y2="${HEIGHT - MARGIN.bottom}" stroke="#222" stroke-width="3"/>`);
  out.push(`<text x="${MARGIN.left + plotWidth / 2}" y="${HEIGHT - 35}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="34">Number of guardians/shares (n)</text>`);
  out.push(`<text x="45" y="${MARGIN.top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 45 ${MARGIN.top + plotHeight / 2})" font-family="Arial,Helvetica,sans-serif" font-size="34">${escapeXml(yLabel)}</text>`);
  const legendWidth = 460;
  series.forEach((item, index) => {
    const style = STYLES[item.name];
    const lx = WIDTH / 2 - series.length * legendWidth / 2 + index * legendWidth;
    out.push(`<line x1="${lx}" y1="125" x2="${lx + 75}" y2="125" stroke="${style.color}" stroke-width="6" ${style.dash ? `stroke-dasharray="${style.dash}"` : ""}/>`);
    out.push(marker(style, lx + 38, 125));
    out.push(`<text x="${lx + 95}" y="136" font-family="Arial,Helvetica,sans-serif" font-size="27">${escapeXml(style.label)}</text>`);
  });
  series.forEach((item) => {
    const style = STYLES[item.name];
    out.push(`<polyline points="${item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}" fill="none" stroke="${style.color}" stroke-width="6" ${style.dash ? `stroke-dasharray="${style.dash}"` : ""}/>`);
    item.values.forEach((value, index) => {
      if (item.lower && item.upper) {
        const low = y(item.lower[index]); const high = y(item.upper[index]);
        out.push(`<line x1="${x(index)}" y1="${low}" x2="${x(index)}" y2="${high}" stroke="${style.color}" stroke-width="3"/>`);
        out.push(`<line x1="${x(index) - 8}" y1="${low}" x2="${x(index) + 8}" y2="${low}" stroke="${style.color}" stroke-width="3"/>`);
        out.push(`<line x1="${x(index) - 8}" y1="${high}" x2="${x(index) + 8}" y2="${high}" stroke="${style.color}" stroke-width="3"/>`);
      }
      out.push(marker(style, x(index), y(value)));
    });
  });
  if (note) out.push(`<text x="${WIDTH - MARGIN.right}" y="${HEIGHT - 75}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="23" fill="#444">${escapeXml(note)}</text>`);
  out.push("</svg>\n");
  return out.join("");
}

function saveFigure(name, svg) {
  const root = path.join(paths.analysis, "figures");
  const svgPath = path.join(root, "svg", `${name}.svg`);
  const pngPath = path.join(root, "png", `${name}.png`);
  const pdfPath = path.join(root, "pdf", `${name}.pdf`);
  fs.mkdirSync(path.dirname(svgPath), { recursive: true });
  fs.writeFileSync(svgPath, svg, "utf8");
  renderWithBrowser({ svg, width: WIDTH, height: HEIGHT, pngPath, pdfPath });
  return { svg: svgPath, png: pngPath, pdf: pdfPath };
}

function createPedinFigures({ paper, comparison }) {
  const p1 = chartSvg({
    title: "Pedin Paper-Guided Setup Gas",
    yLabel: "Setup gas used",
    n: paper.map((row) => row.n),
    series: [{ name: "PEDIN_PAPER_GUIDED_SETUP", values: paper.map((row) => row.mean_setup_gas),
      lower: paper.map((row) => row.ci95_lower), upper: paper.map((row) => row.ci95_upper) }],
    note: "Mean and 95% CI; 30 repetitions per condition",
  });
  const mechanisms = Object.keys(STYLES);
  const commonN = [...new Set(comparison.map((row) => row.n))].sort((a, b) => a - b);
  const p2 = chartSvg({
    title: "Normalized Gas Scaling on the Common Grid",
    yLabel: "Normalized gas (n=10 = 1.0)",
    n: commonN,
    series: mechanisms.map((name) => ({ name, values: commonN.map((n) =>
      comparison.find((row) => row.n === n && row.mechanism === name).normalized_gas_n10_equals_1) })),
    note: "Normalization compares scaling, not absolute contract responsibility",
  });
  const files = {
    figure_p1_pedin_paper_grid_setup_gas: saveFigure("figure_p1_pedin_paper_grid_setup_gas", p1),
    figure_p2_normalized_common_grid_scaling: saveFigure("figure_p2_normalized_common_grid_scaling", p2),
  };
  fs.writeFileSync(path.join(paths.analysis, "PEDIN_FIGURE_CAPTIONS.md"),
    `# Pedin Baseline Figure Captions\n\n` +
    `**Figure P1.** Setup transaction gas for the paper-guided Merkle-SHA256 implementation over the guardian counts shown in Pedin et al.'s Figure 9. Points are means over 30 independent synthetic datasets; error bars are 95% confidence intervals.\n\n` +
    `**Figure P2.** Normalized gas growth on the additional common grid. Each mechanism is normalized to its own n=10 mean (1.0), so the figure compares scaling patterns rather than absolute gas or protocol superiority.\n`, "utf8");
  return files;
}

module.exports = { chartSvg, createPedinFigures };
