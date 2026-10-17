const fs = require("fs");
const path = require("path");
const { pngInfo, renderWithBrowser, validatePdf } = require("../../../experiments/publicationAssets/renderer");
const { readCsvObjects } = require("../../../experiments/logger/experimentLogger");
const {
  ROOT, paths, EXPECTED_HASHES, PAPER_N, COMMON_N, VARIANTS, FORMATS, DIMENSIONS,
  EXISTING_FIGURE_IDS, EXISTING_TABLE_IDS,
} = require("./config");
const { identity, relative, sha256Buffer, sha256File, plottedDigest, almostEqual,
  loadPublicationData, sourceFiles } = require("./data");
const { renderFigure } = require("./charts");
const { tableDefinitions, DISPLAY } = require("./tables");
const { FIGURE_MARKER, TABLE_MARKER, OVERVIEW_MARKER, appendOrReplace,
  figureCaptionSection, tableCaptionSection, overviewSection, interpretationDocument } = require("./text");

const FIGURES = Object.freeze([
  { id: "figure6_pedin_paper_grid_setup_gas", number: "Figure 6", role: "MAIN_TEXT", dataKey: "figure6",
    title: "Pedin Paper-Guided Merkle-SHA256 Setup Gas", sourceKeys: ["paperStats", "scalability"] },
  { id: "figure7_normalized_common_grid_scalability", number: "Figure 7", role: "MAIN_TEXT", dataKey: "figure7",
    title: "Normalized Gas Scaling on the Common Grid", sourceKeys: ["commonComparison", "normalized", "finalGasComparison", "finalTransactionCount"] },
]);

const SOURCE_PATH_BY_KEY = Object.freeze(Object.fromEntries([
  "paperStats", "commonStats", "scalability", "commonComparison", "normalized", "feasibility",
  "baselineAnalysis", "methodFidelity", "sourceAudit", "assumptionRegister", "pedinFreeze",
  "finalGasComparison", "finalTransactionCount",
].map((key) => [key, paths[key]])));

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureDirectories() {
  for (const format of FORMATS) fs.mkdirSync(path.join(paths.figureRoot, format), { recursive: true });
  for (const format of ["csv", "md", "doc_ready"]) fs.mkdirSync(path.join(paths.tableRoot, format), { recursive: true });
  fs.mkdirSync(paths.captionRoot, { recursive: true });
  fs.mkdirSync(paths.manifestRoot, { recursive: true });
  fs.mkdirSync(paths.documentationRoot, { recursive: true });
}

function protectedPathsFromManifest(manifest) {
  const output = [];
  for (const record of manifest.figures || []) {
    if (!EXISTING_FIGURE_IDS.includes(record.figure_id)) continue;
    for (const format of FORMATS) output.push(path.join(ROOT, ...record.files[format].split("/")));
  }
  for (const record of manifest.tables || []) {
    if (!EXISTING_TABLE_IDS.includes(record.table_id)) continue;
    for (const rel of Object.values(record.files)) output.push(path.join(ROOT, ...rel.split("/")));
  }
  return [...new Set(output)].sort((a, b) => relative(a).localeCompare(relative(b)));
}

function createOrLoadExistingSnapshot() {
  const manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
  if (fs.existsSync(paths.existingSnapshot)) return JSON.parse(fs.readFileSync(paths.existingSnapshot, "utf8"));
  if (manifest.status !== "VALID" || manifest.validation_status !== "VALID") {
    throw new Error("Existing Publication Assets are not VALID before the Pedin extension");
  }
  const protectedPaths = protectedPathsFromManifest(manifest);
  if (protectedPaths.length !== 66) throw new Error(`expected 66 existing Figure/Table files, found ${protectedPaths.length}`);
  const snapshot = {
    snapshot_version: "PRE_PEDIN_PUBLICATION_EXTENSION_V1",
    captured_at: new Date().toISOString(),
    prior_manifest_status: manifest.status,
    prior_validation_status: manifest.validation_status,
    prior_figure_records: (manifest.figures || []).filter((record) => EXISTING_FIGURE_IDS.includes(record.figure_id)),
    prior_table_records: (manifest.tables || []).filter((record) => EXISTING_TABLE_IDS.includes(record.table_id)),
    protected_artifacts: protectedPaths.map(identity),
    mutable_text_prefixes: {
      figure_captions_sha256: sha256File(paths.figureCaptions),
      table_captions_sha256: sha256File(paths.tableCaptions),
      overview_sha256: sha256File(paths.overview),
    },
  };
  fs.writeFileSync(paths.existingSnapshot, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return snapshot;
}

function verifyExistingSnapshot(snapshot) {
  const errors = [];
  for (const record of snapshot.protected_artifacts || []) {
    const filePath = path.join(ROOT, ...record.relative_path.split("/"));
    if (!fs.existsSync(filePath)) errors.push(`existing artifact missing: ${record.relative_path}`);
    else if (fs.statSync(filePath).size !== Number(record.size_bytes) || sha256File(filePath) !== record.sha256) {
      errors.push(`existing artifact changed: ${record.relative_path}`);
    }
  }
  return { valid: errors.length === 0, errors, checked: snapshot.protected_artifacts?.length || 0 };
}

function figurePaths(figureId, variant) {
  const stem = `${figureId}_${variant}`;
  return {
    png: path.join(paths.figureRoot, "png", `${stem}.png`),
    svg: path.join(paths.figureRoot, "svg", `${stem}.svg`),
    pdf: path.join(paths.figureRoot, "pdf", `${stem}.pdf`),
  };
}

function sourceIdentities(keys) {
  return keys.map((key) => identity(SOURCE_PATH_BY_KEY[key]));
}

function createFigures(data) {
  const records = [];
  const generatedPaths = [];
  for (const specification of FIGURES) {
    for (const variant of VARIANTS) {
      const rendered = renderFigure(specification.id, data[specification.dataKey], variant);
      const output = figurePaths(specification.id, variant);
      let reusable = false;
      if (fs.existsSync(output.svg) && fs.existsSync(output.png) && fs.existsSync(output.pdf) &&
          fs.readFileSync(output.svg, "utf8") === rendered.svg && validatePdf(output.pdf)) {
        try {
          const png = pngInfo(output.png);
          reusable = png.width === rendered.width && png.height === rendered.height &&
            png.dpi !== null && Math.abs(png.dpi - 300) <= 0.2;
        } catch (_error) { reusable = false; }
      }
      if (!reusable) {
        fs.writeFileSync(output.svg, rendered.svg, "utf8");
        renderWithBrowser({ svg: rendered.svg, width: rendered.width, height: rendered.height,
          pngPath: output.png, pdfPath: output.pdf });
      }
      generatedPaths.push(output.png, output.svg, output.pdf);
      records.push({
        figure_id: specification.id,
        figure_number: specification.number,
        title: specification.title,
        role: specification.role,
        variant,
        width_px: rendered.width,
        height_px: rendered.height,
        png_dpi: 300,
        numeric_x_axis: true,
        plotted_data_sha256: rendered.plottedDataSha256,
        source_files: sourceIdentities(specification.sourceKeys),
        files: { png: relative(output.png), svg: relative(output.svg), pdf: relative(output.pdf) },
      });
      process.stdout.write(`[Pedin Publication Assets] ${reusable ? "reused" : "rendered"} ${specification.id}_${variant}\n`);
    }
  }
  return { records, generatedPaths };
}

function tablePaths(tableId) {
  return {
    csv: path.join(paths.tableRoot, "csv", `${tableId}.csv`),
    markdown: path.join(paths.tableRoot, "md", `${tableId}.md`),
    doc_ready: path.join(paths.tableRoot, "doc_ready", `${tableId}.txt`),
  };
}

function tableSourceKeys(tableId) {
  if (tableId.startsWith("table6_")) return ["paperStats", "feasibility"];
  if (tableId.startsWith("table7_")) return ["commonComparison", "normalized", "finalGasComparison", "finalTransactionCount"];
  return ["sourceAudit", "assumptionRegister", "methodFidelity"];
}

function createTables(data) {
  const definitions = tableDefinitions(data);
  const records = [];
  const generatedPaths = [];
  for (const table of definitions) {
    const output = tablePaths(table.id);
    fs.writeFileSync(output.csv, table.csv, "utf8");
    fs.writeFileSync(output.markdown, table.markdown, "utf8");
    fs.writeFileSync(output.doc_ready, table.docReady, "utf8");
    generatedPaths.push(output.csv, output.markdown, output.doc_ready);
    records.push({
      table_id: table.id, table_number: table.number, title: table.title,
      role: table.number === "Table S2" ? "SUPPLEMENTARY" : "MAIN_TEXT",
      row_count: table.rowCount,
      source_files: sourceIdentities(tableSourceKeys(table.id)),
      value_data_sha256: plottedDigest(table.sourceRows),
      files: { csv: relative(output.csv), markdown: relative(output.markdown), doc_ready: relative(output.doc_ready) },
    });
  }
  return { definitions, records, generatedPaths };
}

function createTextAssets() {
  const figureExisting = fs.readFileSync(paths.figureCaptions, "utf8");
  const tableExisting = fs.readFileSync(paths.tableCaptions, "utf8");
  const overviewExisting = fs.readFileSync(paths.overview, "utf8");
  fs.writeFileSync(paths.figureCaptions, appendOrReplace(figureExisting, FIGURE_MARKER, figureCaptionSection()), "utf8");
  fs.writeFileSync(paths.tableCaptions, appendOrReplace(tableExisting, TABLE_MARKER, tableCaptionSection()), "utf8");
  fs.writeFileSync(paths.overview, appendOrReplace(overviewExisting, OVERVIEW_MARKER, overviewSection()), "utf8");
  fs.writeFileSync(paths.interpretation, interpretationDocument(), "utf8");
  return [paths.figureCaptions, paths.tableCaptions, paths.overview, paths.interpretation];
}

function extensionGeneratedPaths(snapshot, newPaths, textPaths) {
  return [
    ...snapshot.protected_artifacts.map((record) => path.join(ROOT, ...record.relative_path.split("/"))),
    ...newPaths,
    ...textPaths,
  ];
}

function updateManifest({ data, snapshot, figures, tables, generatedPaths }) {
  const manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
  const existingFigures = (manifest.figures || []).filter((record) => !FIGURES.some((item) => item.id === record.figure_id));
  const extensionTableIds = new Set(tables.records.map((record) => record.table_id));
  const existingTables = (manifest.tables || []).filter((record) => !extensionTableIds.has(record.table_id));
  const sourceMap = new Map((manifest.source_files || []).map((record) => [record.relative_path, record]));
  for (const record of sourceFiles()) sourceMap.set(record.relative_path, record);
  manifest.publication_assets_version = "MDPI_PUBLICATION_ASSETS_V1_PEDIN_EXTENSION_1";
  manifest.generated_at = new Date().toISOString();
  manifest.status = "PENDING_VALIDATION";
  manifest.input_policy = "Existing assets retain their validated Final Statistics sources; Pedin extension values are read only from frozen Pedin Statistics and validated Final Statistics. Raw files are integrity checks only.";
  manifest.source_files = [...sourceMap.values()].sort((a, b) => a.relative_path.localeCompare(b.relative_path));
  manifest.figures = [...existingFigures, ...figures.records];
  manifest.figure_count = 10;
  manifest.figure_render_count = manifest.figures.length;
  manifest.tables = [...existingTables, ...tables.records];
  manifest.table_count = manifest.tables.length;
  manifest.captions = [relative(paths.figureCaptions), relative(paths.tableCaptions)];
  manifest.overview = relative(paths.overview);
  manifest.documentation = [...new Set([...(manifest.documentation || []), relative(paths.interpretation)])];
  manifest.frozen_raw_hashes = { pedin: data.frozen.raw.pedin, main: data.frozen.raw.main, recovery_counterbalanced: data.frozen.raw.recovery };
  manifest.pedin_external_baseline_extension = {
    version: "PEDIN_PUBLICATION_EXTENSION_V1",
    status: "PENDING_VALIDATION",
    implementation_name: "Paper-guided reimplementation of Pedin et al.'s Merkle-SHA256 setup",
    generated_at: manifest.generated_at,
    logical_figures: 2,
    figure_renders: 4,
    tables: 3,
    source_files: sourceFiles(),
    script: { ...identity(paths.script), version: "1.0.0" },
    existing_asset_snapshot: relative(paths.existingSnapshot),
  };
  manifest.generated_asset_hashes = generatedPaths.map(identity)
    .sort((a, b) => a.relative_path.localeCompare(b.relative_path));
  manifest.validation_status = "PENDING";
  writeJson(paths.manifest, manifest);
  return manifest;
}

function prefixBefore(text, marker) {
  const index = text.indexOf(marker);
  return index < 0 ? null : text.slice(0, index);
}

function extractSvgDigest(svg) {
  return svg.match(/<metadata id="plot-data" data-sha256="([a-f0-9]{64})">/)?.[1] || null;
}

function generatedHashMatches(manifest, filePath) {
  const rel = relative(filePath);
  const record = (manifest.generated_asset_hashes || []).find((item) => item.relative_path === rel);
  return Boolean(record && Number(record.size_bytes) === fs.statSync(filePath).size && record.sha256 === sha256File(filePath));
}

function validateFigures(data, manifest, errors) {
  let png = 0; let svg = 0; let pdf = 0;
  for (const specification of FIGURES) {
    for (const variant of VARIANTS) {
      const record = (manifest.figures || []).find((item) => item.figure_id === specification.id && item.variant === variant);
      if (!record) { errors.push(`figure record missing: ${specification.id}/${variant}`); continue; }
      const expected = renderFigure(specification.id, data[specification.dataKey], variant);
      if (record.width_px !== expected.width || record.height_px !== expected.height ||
          record.plotted_data_sha256 !== expected.plottedDataSha256 || record.numeric_x_axis !== true) {
        errors.push(`figure manifest/source mismatch: ${specification.id}/${variant}`);
      }
      const output = figurePaths(specification.id, variant);
      for (const filePath of Object.values(output)) if (!fs.existsSync(filePath)) errors.push(`figure file missing: ${relative(filePath)}`);
      if (!fs.existsSync(output.svg) || fs.readFileSync(output.svg, "utf8") !== expected.svg ||
          extractSvgDigest(expected.svg) !== expected.plottedDataSha256) errors.push(`SVG source-data mismatch: ${specification.id}/${variant}`);
      else svg += 1;
      if (fs.existsSync(output.png)) {
        const info = pngInfo(output.png);
        if (info.width !== DIMENSIONS[variant].width || info.height !== DIMENSIONS[variant].height ||
            info.dpi === null || Math.abs(info.dpi - 300) > 0.2) errors.push(`PNG dimension/DPI mismatch: ${specification.id}/${variant}`);
        else png += 1;
      }
      if (fs.existsSync(output.pdf) && validatePdf(output.pdf)) pdf += 1;
      else errors.push(`PDF vector container invalid: ${specification.id}/${variant}`);
      for (const filePath of Object.values(output)) if (fs.existsSync(filePath) && !generatedHashMatches(manifest, filePath)) errors.push(`generated figure hash mismatch: ${relative(filePath)}`);
    }
  }
  const ySpan = data.figure6.y_domain[1] - data.figure6.y_domain[0];
  if (data.figure6.n.join(",") !== PAPER_N.join(",") || data.figure6.counts.some((count) => count !== 30)) errors.push("Figure 6 Paper Grid/count mismatch");
  if (ySpan / data.scale.absoluteRange < 20 || Math.min(...data.figure6.lower) < data.figure6.y_domain[0] ||
      Math.max(...data.figure6.upper) > data.figure6.y_domain[1]) errors.push("Figure 6 axis exaggerates variation or clips CI");
  if (data.figure7.n.join(",") !== COMMON_N.join(",") || data.figure7.series.length !== 3 ||
      data.figure7.normalization !== "METHOD_SPECIFIC_N10_MEAN_EQUALS_1") errors.push("Figure 7 design/source mismatch");
  for (const series of data.figure7.series) if (!almostEqual(series.values[0], 1)) errors.push(`Figure 7 n=10 is not 1: ${series.mechanism}`);
  const pedin = data.figure7.series.find((row) => row.mechanism === "PEDIN_PAPER_GUIDED_SETUP").values;
  const merkle = data.figure7.series.find((row) => row.mechanism === "OUR_MERKLE_ROOT_ANCHORING").values;
  const perShare = data.figure7.series.find((row) => row.mechanism === "OUR_PER_SHARE_ANCHORING").values;
  if (Math.max(...pedin) - Math.min(...pedin) > 0.001 || Math.max(...merkle) - Math.min(...merkle) > 0.001) errors.push("Figure 7 Merkle-based near-flat sanity check failed");
  if (!(perShare[1] > 1.99 && perShare[2] > 4.99 && perShare[3] > 9.99)) errors.push("Figure 7 Per-Share scaling sanity check failed");
  return { png, svg, pdf };
}

function validateTables(data, manifest, errors) {
  const definitions = tableDefinitions(data);
  const status = {};
  for (const table of definitions) {
    const record = (manifest.tables || []).find((item) => item.table_id === table.id);
    if (!record || record.row_count !== table.rowCount || record.value_data_sha256 !== plottedDigest(table.sourceRows)) {
      errors.push(`table manifest/source mismatch: ${table.id}`);
    }
    const output = tablePaths(table.id);
    const expected = { csv: table.csv, markdown: table.markdown, doc_ready: table.docReady };
    for (const [format, filePath] of Object.entries(output)) {
      if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== expected[format]) errors.push(`table byte/value mismatch: ${table.id}/${format}`);
      else if (!generatedHashMatches(manifest, filePath)) errors.push(`generated table hash mismatch: ${relative(filePath)}`);
    }
    status[table.id] = !errors.some((error) => error.includes(table.id));
  }
  if (definitions[0].rowCount !== 13 || definitions[1].rowCount !== 12 || definitions[2].rowCount < 20) errors.push("table row-count validation failed");
  const table7 = definitions[1].sourceRows;
  for (const mechanism of ["Pedin Paper-Guided", "Merkle-Root", "Per-Share"]) {
    const base = table7.find((row) => row.n === 10 && row.mechanism === mechanism);
    if (!base || !almostEqual(base.normalized_gas, 1)) errors.push(`Table 7 n=10 normalization mismatch: ${mechanism}`);
  }
  const scopes = new Set(table7.map((row) => row.on_chain_scope));
  if (!["Recovery address + Merkle root", "Merkle root", "n share hashes"].every((scope) => scopes.has(scope))) errors.push("Table 7 scope distinction missing");
  const elements = new Set(definitions[2].sourceRows.map((row) => row.implementation_element));
  for (const required of ["Shamir Secret Sharing", "Secret Recovery Key", "n = guardians = shares", "k = n/2 + 1",
    "Merkle SHA-256 variant", "Share-hash leaves", "Leaf ordering and sorting", "Left/right parent ordering", "Last-leaf padding",
    "PBK + Merkle Root storage", "Setup transaction count", "SSS library", "Share serialization",
    "Proof indexing", "Solidity version", "Compiler optimizer", "Hardhat environment", "Repetition count",
    "Deployment gas treatment", "Common Grid", "Contract layout"]) if (!elements.has(required)) errors.push(`Table S2 fidelity row missing: ${required}`);
  return status;
}

function validateText(snapshot, manifest, errors) {
  const figure = fs.readFileSync(paths.figureCaptions, "utf8");
  const table = fs.readFileSync(paths.tableCaptions, "utf8");
  const overview = fs.readFileSync(paths.overview, "utf8");
  const figurePrefix = prefixBefore(figure, FIGURE_MARKER);
  const tablePrefix = prefixBefore(table, TABLE_MARKER);
  const overviewPrefix = prefixBefore(overview, OVERVIEW_MARKER);
  if (figurePrefix === null || sha256Buffer(Buffer.from(figurePrefix, "utf8")) !== snapshot.mutable_text_prefixes.figure_captions_sha256 ||
      figure !== figurePrefix + figureCaptionSection()) errors.push("Figure captions prefix or extension mismatch");
  if (tablePrefix === null || sha256Buffer(Buffer.from(tablePrefix, "utf8")) !== snapshot.mutable_text_prefixes.table_captions_sha256 ||
      table !== tablePrefix + tableCaptionSection()) errors.push("Table captions prefix or extension mismatch");
  if (overviewPrefix === null || sha256Buffer(Buffer.from(overviewPrefix, "utf8")) !== snapshot.mutable_text_prefixes.overview_sha256 ||
      overview !== overviewPrefix + overviewSection()) errors.push("Overview prefix or extension mismatch");
  if (!fs.existsSync(paths.interpretation) || fs.readFileSync(paths.interpretation, "utf8") !== interpretationDocument()) errors.push("Pedin interpretation document mismatch");
  for (const filePath of [paths.figureCaptions, paths.tableCaptions, paths.overview, paths.interpretation]) {
    if (!generatedHashMatches(manifest, filePath)) errors.push(`generated text hash mismatch: ${relative(filePath)}`);
  }
  const extensionText = [figureCaptionSection(), tableCaptionSection(), overviewSection(), interpretationDocument(),
    ...tableDefinitions(loadPublicationData()).flatMap((item) => [item.markdown, item.docReady])].join("\n");
  const forbidden = [
    /Our method is superior to Pedin/i, /outperforms Pedin/i, /Pedin is inefficient/i,
    /We reproduced Pedin exactly/i, /Pedin and our system implement the same recovery protocol/i,
    /proves our entire recovery architecture is better/i, /more gas-efficient than Pedin/i,
  ];
  if (forbidden.some((pattern) => pattern.test(extensionText))) errors.push("forbidden superiority or exact-reproduction claim found");
  if (!figureCaptionSection().includes("not claimed as an exact reproduction")) errors.push("exact-reproduction disclaimer missing");
  return {
    figure_captions_valid: !errors.some((error) => error.startsWith("Figure captions")),
    table_captions_valid: !errors.some((error) => error.startsWith("Table captions")),
    overview_valid: !errors.some((error) => error.startsWith("Overview")),
    interpretation_valid: !errors.some((error) => error.includes("interpretation")),
  };
}

function validatePedinPublicationAssets({ writeRecord = true } = {}) {
  const errors = [];
  let data; let snapshot; let manifest;
  try {
    data = loadPublicationData();
    snapshot = createOrLoadExistingSnapshot();
    manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
  } catch (error) {
    const failure = { status: "INVALID", valid: false, checked_at: new Date().toISOString(), errors: [error.message] };
    if (writeRecord) writeJson(paths.validation, failure);
    return failure;
  }
  const existing = verifyExistingSnapshot(snapshot);
  errors.push(...existing.errors);
  const raw = data.frozen.raw;
  if (raw.pedin !== EXPECTED_HASHES.pedin) errors.push("Pedin Raw SHA mismatch");
  if (raw.main !== EXPECTED_HASHES.main) errors.push("Main Raw SHA mismatch");
  if (raw.recovery !== EXPECTED_HASHES.recovery) errors.push("Recovery Raw SHA mismatch");
  const sourceMap = new Map((manifest.source_files || []).map((item) => [item.relative_path, item]));
  for (const source of sourceFiles()) {
    const record = sourceMap.get(source.relative_path);
    if (!record || record.sha256 !== source.sha256 || Number(record.size_bytes) !== source.size_bytes) errors.push(`manifest source mismatch: ${source.relative_path}`);
  }
  const figureFormats = validateFigures(data, manifest, errors);
  const tableStatus = validateTables(data, manifest, errors);
  const textStatus = validateText(snapshot, manifest, errors);
  if (manifest.figure_count !== 10 || manifest.figure_render_count !== 20 || manifest.table_count !== 9) errors.push("extended manifest counts mismatch");
  if (manifest.pedin_external_baseline_extension?.implementation_name !== "Paper-guided reimplementation of Pedin et al.'s Merkle-SHA256 setup") errors.push("implementation naming mismatch");
  const result = {
    validation_version: "PEDIN_PUBLICATION_EXTENSION_V1",
    checked_at: new Date().toISOString(),
    status: errors.length === 0 ? "VALID" : "INVALID",
    valid: errors.length === 0,
    pedin_raw_sha_valid: raw.pedin === EXPECTED_HASHES.pedin,
    main_raw_sha_valid: raw.main === EXPECTED_HASHES.main,
    recovery_raw_sha_valid: raw.recovery === EXPECTED_HASHES.recovery,
    figure6_source_match: !errors.some((error) => error.includes("Figure 6") || error.includes("figure6_")),
    figure7_source_match: !errors.some((error) => error.includes("Figure 7") || error.includes("figure7_")),
    table6_source_match: tableStatus.table6_pedin_paper_grid_results === true,
    table7_source_match: tableStatus.table7_common_grid_scalability_comparison === true,
    tableS2_fidelity_match: tableStatus.tableS2_pedin_method_fidelity === true,
    existing_assets_unchanged: existing.valid,
    existing_asset_files_checked: existing.checked,
    logical_figures: 2,
    figure_renders: 4,
    figure_files_by_format: figureFormats,
    tables: 3,
    table_files_by_format: { csv: 3, markdown: 3, doc_ready: 3 },
    figure6: {
      n_count: data.paper.length, repetitions_each: [...new Set(data.paper.map((row) => row.repetitions))],
      minimum_mean_gas: data.scale.minimumMean, maximum_mean_gas: data.scale.maximumMean,
      absolute_mean_range_gas: data.scale.absoluteRange, relative_mean_range_percent: data.scale.relativeRangePercent,
      descriptive_slope_gas_per_guardian: data.scale.slope,
      y_domain: data.figure6.y_domain,
      y_span_to_mean_range_ratio: (data.figure6.y_domain[1] - data.figure6.y_domain[0]) / data.scale.absoluteRange,
      variation_not_visually_exaggerated: (data.figure6.y_domain[1] - data.figure6.y_domain[0]) / data.scale.absoluteRange >= 20,
    },
    figure7: {
      common_n: data.figure7.n,
      normalization: data.figure7.normalization,
      normalized_values: Object.fromEntries(data.figure7.series.map((row) => [row.mechanism, row.values])),
    },
    captions_valid: textStatus.figure_captions_valid && textStatus.table_captions_valid,
    overview_valid: textStatus.overview_valid,
    interpretation_valid: textStatus.interpretation_valid,
    figure_source_data_digest_valid: !errors.some((error) => error.includes("SVG source-data") || error.includes("figure manifest/source")),
    table_byte_value_validation: !errors.some((error) => error.includes("table byte/value") || error.includes("table manifest/source")),
    affirmative_exact_reproduction_claim_absent: !errors.some((error) => error.includes("forbidden")),
    absolute_superiority_claim_absent: !errors.some((error) => error.includes("forbidden")),
    errors,
  };
  if (writeRecord) writeJson(paths.validation, result);
  return result;
}

function finalizeManifestStatus(result) {
  const manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
  manifest.status = result.valid ? "VALID" : "INVALID";
  manifest.validation_status = result.status;
  if (manifest.pedin_external_baseline_extension) manifest.pedin_external_baseline_extension.status = result.status;
  writeJson(paths.manifest, manifest);
}

function consoleValidation(result) {
  if (!result.valid) {
    process.stdout.write(`[Pedin Publication Assets] INVALID\n${result.errors.map((error) => `- ${error}`).join("\n")}\n`);
    return;
  }
  process.stdout.write(
    `[Pedin Publication Assets] VALID\nLogical figures=2\nFigure renders=4\n` +
    `PNG=${result.figure_files_by_format.png} VALID\nSVG=${result.figure_files_by_format.svg} VALID\nPDF=${result.figure_files_by_format.pdf} VALID\n\n` +
    `Tables=3\nCSV=3 VALID\nMarkdown=3 VALID\nDoc-ready=3 VALID\n\n` +
    `Figure values=SOURCE STATISTICS MATCH\nTable values=SOURCE STATISTICS MATCH\n\n` +
    `Pedin Raw SHA=VALID\nMain Raw SHA=VALID\nRecovery Raw SHA=VALID\n\n` +
    `Existing publication figures=UNCHANGED\nExisting publication tables=UNCHANGED\n\nStatus=VALID\n`,
  );
}

function generatePedinPublicationAssets() {
  ensureDirectories();
  const snapshot = createOrLoadExistingSnapshot();
  const existingBefore = verifyExistingSnapshot(snapshot);
  if (!existingBefore.valid) throw new Error(existingBefore.errors.join("; "));
  const data = loadPublicationData();
  const rawBefore = { ...data.frozen.raw };
  const sourcesBefore = sourceFiles();
  const figures = createFigures(data);
  const tables = createTables(data);
  const textPaths = createTextAssets();
  const generatedPaths = extensionGeneratedPaths(snapshot,
    [...figures.generatedPaths, ...tables.generatedPaths], textPaths);
  updateManifest({ data, snapshot, figures, tables, generatedPaths });
  const rawAfter = loadPublicationData().frozen.raw;
  const sourcesAfter = sourceFiles();
  if (JSON.stringify(rawBefore) !== JSON.stringify(rawAfter) || JSON.stringify(sourcesBefore) !== JSON.stringify(sourcesAfter)) {
    throw new Error("Frozen publication sources changed during Pedin asset generation");
  }
  let validation = validatePedinPublicationAssets();
  finalizeManifestStatus(validation);
  validation = validatePedinPublicationAssets();
  if (!validation.valid) throw new Error(`Pedin publication extension validation failed: ${validation.errors.join("; ")}`);
  consoleValidation(validation);
  return { validation };
}

module.exports = {
  FIGURES, writeJson, ensureDirectories, createOrLoadExistingSnapshot, verifyExistingSnapshot,
  figurePaths, tablePaths, createFigures, createTables, createTextAssets,
  validatePedinPublicationAssets, consoleValidation, generatePedinPublicationAssets,
};
