const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { experimentConfig } = require("../config/experimentConfig");
const {
  FINAL_DIRECTORY,
  REQUIRED_INPUTS,
  identity,
  loadFinalStatistics,
  figureData,
  tableDefinitions,
  captions,
  overview,
  sha256File,
} = require("./data");
const { dimensionsFor, renderSvg } = require("./charts");
const { pngInfo, renderWithBrowser, validatePdf } = require("./renderer");

const OUTPUT_ROOT = path.join(experimentConfig.paths.root, "results", "publication_assets");
const FIGURE_ROOT = path.join(OUTPUT_ROOT, "figures");
const TABLE_ROOT = path.join(OUTPUT_ROOT, "tables");
const CAPTION_ROOT = path.join(OUTPUT_ROOT, "captions");
const MANIFEST_ROOT = path.join(OUTPUT_ROOT, "manifest");
const MANIFEST_PATH = path.join(MANIFEST_ROOT, "publication_assets_manifest.json");
const VALIDATION_PATH = path.join(MANIFEST_ROOT, "publication_assets_validation.json");
const VARIANTS = Object.freeze(["single", "double"]);
const FORMATS = Object.freeze(["png", "svg", "pdf"]);

function relative(filePath) {
  return path.relative(experimentConfig.paths.root, filePath).replace(/\\/g, "/");
}

function ensureDirectories() {
  ["png", "svg", "pdf"].forEach((format) =>
    fs.mkdirSync(path.join(FIGURE_ROOT, format), { recursive: true }));
  ["csv", "md", "doc_ready"].forEach((format) =>
    fs.mkdirSync(path.join(TABLE_ROOT, format), { recursive: true }));
  fs.mkdirSync(CAPTION_ROOT, { recursive: true });
  fs.mkdirSync(MANIFEST_ROOT, { recursive: true });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function dataDigest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function sourceIdentities() {
  return REQUIRED_INPUTS.map((name) => identity(path.join(FINAL_DIRECTORY, name)));
}

function createFigures(data) {
  const specifications = figureData(data);
  const records = [];
  const paths = [];
  let completed = 0;
  const total = Object.keys(specifications).length * VARIANTS.length;
  for (const [baseName, specification] of Object.entries(specifications)) {
    for (const variant of VARIANTS) {
      const rendered = renderSvg(specification, variant);
      const fileName = `${baseName}_${variant}`;
      const svgPath = path.join(FIGURE_ROOT, "svg", `${fileName}.svg`);
      const pngPath = path.join(FIGURE_ROOT, "png", `${fileName}.png`);
      const pdfPath = path.join(FIGURE_ROOT, "pdf", `${fileName}.pdf`);
      let reusable = false;
      if (fs.existsSync(svgPath) && fs.existsSync(pngPath) && fs.existsSync(pdfPath) &&
          fs.readFileSync(svgPath, "utf8") === rendered.svg && validatePdf(pdfPath)) {
        try {
          const png = pngInfo(pngPath);
          reusable = png.width === rendered.width && png.height === rendered.height &&
            png.dpi !== null && Math.abs(png.dpi - 300) <= 0.2;
        } catch (_error) { reusable = false; }
      }
      if (!reusable) {
        fs.writeFileSync(svgPath, rendered.svg, "utf8");
        renderWithBrowser({ svg: rendered.svg, width: rendered.width, height: rendered.height,
          pngPath, pdfPath });
      }
      paths.push(svgPath, pngPath, pdfPath);
      records.push({
        figure_id: baseName,
        role: baseName.startsWith("appendix_") ? "SUPPLEMENTARY" :
          baseName.includes("representative") ? "MAIN_TEXT" :
            baseName.includes("components_full") ? "SUPPLEMENTARY" : "MAIN_TEXT",
        variant,
        width_px: rendered.width,
        height_px: rendered.height,
        png_dpi: 300,
        plotted_data_sha256: dataDigest(specification),
        files: {
          png: relative(pngPath),
          svg: relative(svgPath),
          pdf: relative(pdfPath),
        },
      });
      completed += 1;
      process.stdout.write(`[Publication Assets] figure ${completed}/${total} ${fileName}${reusable ? " REUSE" : " RENDER"}\n`);
    }
  }
  return { specifications, records, paths };
}

function createTables(data) {
  const definitions = tableDefinitions(data);
  const paths = [];
  const records = definitions.map((table) => {
    const csvPath = path.join(TABLE_ROOT, "csv", `${table.id}.csv`);
    const mdPath = path.join(TABLE_ROOT, "md", `${table.id}.md`);
    const docPath = path.join(TABLE_ROOT, "doc_ready", `${table.id}.txt`);
    fs.writeFileSync(csvPath, table.csv, "utf8");
    fs.writeFileSync(mdPath, table.markdown, "utf8");
    fs.writeFileSync(docPath, table.docReady, "utf8");
    paths.push(csvPath, mdPath, docPath);
    return {
      table_id: table.id,
      table_number: table.number,
      title: table.title,
      role: table.number.startsWith("Table S") ? "SUPPLEMENTARY" : "MAIN_TEXT",
      row_count: table.rows.length,
      files: { csv: relative(csvPath), markdown: relative(mdPath), doc_ready: relative(docPath) },
    };
  });
  return { definitions, records, paths };
}

function createTextAssets() {
  const captionText = captions();
  const figureCaptionPath = path.join(CAPTION_ROOT, "figure_captions.md");
  const tableCaptionPath = path.join(CAPTION_ROOT, "table_captions.md");
  const overviewPath = path.join(OUTPUT_ROOT, "PUBLICATION_ASSETS_OVERVIEW.md");
  fs.writeFileSync(figureCaptionPath, captionText.figure_captions, "utf8");
  fs.writeFileSync(tableCaptionPath, captionText.table_captions, "utf8");
  fs.writeFileSync(overviewPath, overview(), "utf8");
  return { paths: [figureCaptionPath, tableCaptionPath, overviewPath],
    captionPaths: [figureCaptionPath, tableCaptionPath], overviewPath };
}

function allFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const current = path.join(directory, entry.name);
    return entry.isDirectory() ? allFiles(current) : [current];
  });
}

function extractSvgDigest(svgPath) {
  const match = fs.readFileSync(svgPath, "utf8").match(/<metadata id="plot-data" data-sha256="([a-f0-9]{64})">/);
  return match?.[1] ?? null;
}

function validatePublicationAssets() {
  const errors = [];
  let data;
  try {
    data = loadFinalStatistics();
  } catch (error) {
    return { valid: false, status: "INVALID", errors: [error.message] };
  }
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { valid: false, status: "INVALID", errors: ["publication_assets_manifest.json is missing"] };
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const currentSources = sourceIdentities();
  const sourceMap = new Map((manifest.source_files ?? []).map((item) => [item.relative_path, item]));
  currentSources.forEach((source) => {
    const frozen = sourceMap.get(source.relative_path);
    if (!frozen || frozen.sha256 !== source.sha256 || frozen.size_bytes !== source.size_bytes) {
      errors.push(`Final Statistics source changed: ${source.relative_path}`);
    }
  });
  const generatedMap = new Map((manifest.generated_asset_hashes ?? []).map((item) => [item.relative_path, item]));
  for (const [relativePath, record] of generatedMap) {
    const filePath = path.join(experimentConfig.paths.root, ...relativePath.split("/"));
    if (!fs.existsSync(filePath)) {
      errors.push(`generated asset missing: ${relativePath}`);
      continue;
    }
    if (fs.statSync(filePath).size !== record.size_bytes || sha256File(filePath) !== record.sha256) {
      errors.push(`generated asset hash mismatch: ${relativePath}`);
    }
  }
  const expectedFigures = figureData(data);
  const expectedFigureFiles = new Set();
  for (const [figureId, specification] of Object.entries(expectedFigures)) {
    for (const variant of VARIANTS) {
      const record = manifest.figures?.find((item) => item.figure_id === figureId && item.variant === variant);
      if (!record) {
        errors.push(`figure manifest record missing: ${figureId} ${variant}`);
        continue;
      }
      const dimensions = dimensionsFor(specification.kind, variant);
      if (record.width_px !== dimensions.width || record.height_px !== dimensions.height ||
          record.plotted_data_sha256 !== dataDigest(specification)) {
        errors.push(`figure data/dimensions mismatch: ${figureId} ${variant}`);
      }
      for (const format of FORMATS) expectedFigureFiles.add(record.files[format]);
      const svgPath = path.join(experimentConfig.paths.root, ...record.files.svg.split("/"));
      const pngPath = path.join(experimentConfig.paths.root, ...record.files.png.split("/"));
      const pdfPath = path.join(experimentConfig.paths.root, ...record.files.pdf.split("/"));
      if (fs.existsSync(svgPath)) {
        const svg = fs.readFileSync(svgPath, "utf8");
        if (extractSvgDigest(svgPath) !== dataDigest(specification)) errors.push(`SVG plotted values mismatch: ${record.files.svg}`);
        if (!svg.includes("viewBox=") || !svg.includes("fill=\"#FFFFFF\"")) errors.push(`SVG design frame invalid: ${record.files.svg}`);
        if (["line", "components_full", "components_representative"].includes(specification.kind) &&
            (!svg.includes("PER_SHARE") || !svg.includes("MERKLE_ROOT"))) {
          errors.push(`mechanism labels missing: ${record.files.svg}`);
        }
        if (specification.kind === "line" && specification.series.length === 2 &&
            (!svg.includes("stroke-dasharray") || !svg.includes("<circle") || !svg.includes("<rect"))) {
          errors.push(`redundant grayscale encoding missing: ${record.files.svg}`);
        }
      }
      if (fs.existsSync(pngPath)) {
        const info = pngInfo(pngPath);
        if (info.width !== dimensions.width || info.height !== dimensions.height ||
            info.dpi === null || Math.abs(info.dpi - 300) > 0.2) {
          errors.push(`PNG dimensions/DPI invalid: ${record.files.png}`);
        }
      }
      if (fs.existsSync(pdfPath) && !validatePdf(pdfPath)) errors.push(`PDF invalid: ${record.files.pdf}`);
    }
  }
  const actualFigureFiles = allFiles(FIGURE_ROOT).map(relative);
  if (actualFigureFiles.length !== expectedFigureFiles.size ||
      actualFigureFiles.some((filePath) => !expectedFigureFiles.has(filePath))) {
    errors.push("figure filenames contain missing, duplicate, or unmanifested files");
  }
  const expectedTables = tableDefinitions(data);
  for (const table of expectedTables) {
    const files = {
      csv: path.join(TABLE_ROOT, "csv", `${table.id}.csv`),
      markdown: path.join(TABLE_ROOT, "md", `${table.id}.md`),
      doc_ready: path.join(TABLE_ROOT, "doc_ready", `${table.id}.txt`),
    };
    const expected = { csv: table.csv, markdown: table.markdown, doc_ready: table.docReady };
    for (const [format, filePath] of Object.entries(files)) {
      if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== expected[format]) {
        errors.push(`table does not match Final Statistics: ${table.id} ${format}`);
      }
    }
  }
  const captionText = captions();
  const figureCaptionPath = path.join(CAPTION_ROOT, "figure_captions.md");
  const tableCaptionPath = path.join(CAPTION_ROOT, "table_captions.md");
  if (!fs.existsSync(figureCaptionPath) || fs.readFileSync(figureCaptionPath, "utf8") !== captionText.figure_captions) {
    errors.push("figure captions mismatch");
  }
  if (!fs.existsSync(tableCaptionPath) || fs.readFileSync(tableCaptionPath, "utf8") !== captionText.table_captions) {
    errors.push("table captions mismatch");
  }
  if (!fs.existsSync(path.join(OUTPUT_ROOT, "PUBLICATION_ASSETS_OVERVIEW.md")) ||
      fs.readFileSync(path.join(OUTPUT_ROOT, "PUBLICATION_ASSETS_OVERVIEW.md"), "utf8") !== overview()) {
    errors.push("publication overview mismatch");
  }
  const excluded = data.paired.filter((row) => row.ci_excludes_zero).map((row) => row.n).join(",");
  const included = data.paired.filter((row) => !row.ci_excludes_zero).map((row) => row.n).join(",");
  if (excluded !== "20,50,100,500" || included !== "5,10,1000") errors.push("paired-CI interpretation mismatch");
  if (manifest.final_metric_sources?.gas !== "MAIN_FINAL_STATISTICS" ||
      manifest.final_metric_sources?.recovery !== "COUNTERBALANCED_FINAL_STATISTICS") {
    errors.push("final metric source declaration mismatch");
  }
  return {
    valid: errors.length === 0,
    status: errors.length === 0 ? "VALID" : "INVALID",
    checked_at: new Date().toISOString(),
    source_files_valid: !errors.some((error) => error.startsWith("Final Statistics source")),
    figure_values_match_final_statistics: !errors.some((error) =>
      error.includes("figure data") || error.includes("plotted values")),
    table_values_match_final_statistics: !errors.some((error) => error.startsWith("table does not match")),
    gas_source_valid: manifest.final_metric_sources?.gas === "MAIN_FINAL_STATISTICS",
    recovery_source_valid: manifest.final_metric_sources?.recovery === "COUNTERBALANCED_FINAL_STATISTICS",
    n_values_valid: data.manifest.n_values.join(",") === "5,10,20,50,100,500,1000",
    paired_ci_notes_valid: excluded === "20,50,100,500" && included === "5,10,1000",
    figure_count: Object.keys(expectedFigures).length,
    figure_render_count: manifest.figures?.length ?? 0,
    figure_files_by_format: Object.fromEntries(FORMATS.map((format) => [format,
      manifest.figures?.filter((record) => record.files?.[format]).length ?? 0])),
    table_count: expectedTables.length,
    png_300_dpi_valid: !errors.some((error) => error.startsWith("PNG")),
    vector_formats_valid: !errors.some((error) => error.startsWith("PDF") || error.startsWith("SVG")),
    grayscale_redundant_encoding_valid: !errors.some((error) => error.includes("grayscale encoding")),
    render_bounds_strategy: "Fixed viewBox, explicit margins, external legends, and exact viewport rendering",
    errors,
  };
}

function consoleValidation(result) {
  if (!result.valid) {
    process.stdout.write(`[Publication Assets] INVALID\n${result.errors.map((error) => `- ${error}`).join("\n")}\n`);
    return;
  }
  process.stdout.write(
    `[Publication Assets] VALID\nFigures=${result.figure_count}\n` +
    `Figure renders=${result.figure_render_count}\nTables=${result.table_count}\n` +
    `PNG=${result.figure_files_by_format.png} VALID (300 dpi)\n` +
    `SVG=${result.figure_files_by_format.svg} VALID\nPDF=${result.figure_files_by_format.pdf} VALID\n` +
    `Figure values=FINAL_STATISTICS MATCH\nTable values=FINAL_STATISTICS MATCH\n` +
    `Gas source=MAIN\nRecovery source=COUNTERBALANCED\nStatus=VALID\n`,
  );
}

function generatePublicationAssets() {
  const data = loadFinalStatistics();
  const sourceBefore = sourceIdentities();
  ensureDirectories();
  const figures = createFigures(data);
  const tables = createTables(data);
  const textAssets = createTextAssets();
  const generatedPaths = [...figures.paths, ...tables.paths, ...textAssets.paths];
  const sourceAfter = sourceIdentities();
  if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter)) {
    throw new Error("Final Statistics inputs changed during publication generation");
  }
  const manifest = {
    publication_assets_version: "MDPI_PUBLICATION_ASSETS_V1",
    generated_at: new Date().toISOString(),
    status: "VALID",
    input_policy: "Only validated files in results/analysis/final_statistics were read.",
    source_files: sourceBefore,
    frozen_raw_hashes_from_final_statistics_manifest: data.manifest.source_hashes,
    final_metric_sources: {
      gas: "MAIN_FINAL_STATISTICS",
      recovery: "COUNTERBALANCED_FINAL_STATISTICS",
      transaction_count: "MAIN_FINAL_STATISTICS",
    },
    figures: figures.records,
    figure_count: Object.keys(figures.specifications).length,
    figure_render_count: figures.records.length,
    tables: tables.records,
    table_count: tables.records.length,
    captions: textAssets.captionPaths.map(relative),
    overview: relative(textAssets.overviewPath),
    generated_asset_hashes: generatedPaths.map(identity),
    validation_status: "VALID",
  };
  writeJson(MANIFEST_PATH, manifest);
  const validation = validatePublicationAssets();
  writeJson(VALIDATION_PATH, validation);
  if (!validation.valid) {
    manifest.status = "INVALID";
    manifest.validation_status = "INVALID";
    writeJson(MANIFEST_PATH, manifest);
    throw new Error(`Publication asset validation failed: ${validation.errors.join("; ")}`);
  }
  consoleValidation(validation);
  return { manifest, validation };
}

module.exports = {
  OUTPUT_ROOT,
  MANIFEST_PATH,
  VALIDATION_PATH,
  validatePublicationAssets,
  consoleValidation,
  generatePublicationAssets,
};
