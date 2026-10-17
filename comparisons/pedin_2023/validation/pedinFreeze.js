const fs = require("fs");
const path = require("path");
const { paths, ROOT } = require("../config/pedinConfig");
const { writeCsv, writeJson } = require("../metrics/pedinIo");
const { sha256File, frozenRawIntegrity } = require("../metrics/integrity");
const { validateFull } = require("./pedinValidation");

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const current = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(current) : [current];
  });
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function freezePedin() {
  const validation = validateFull();
  if (!validation.valid) throw new Error(`Pedin freeze refused: ${validation.errors.join("; ")}`);
  const requiredStatistics = [
    "pedin_paper_grid_statistics.csv", "pedin_common_grid_statistics.csv", "pedin_scalability_analysis.csv",
    "pedin_common_grid_comparison.csv", "pedin_normalized_scalability.csv", "pedin_execution_feasibility.csv",
    "PEDIN_BASELINE_ANALYSIS.md", "PEDIN_METHOD_FIDELITY.md",
  ].map((name) => path.join(paths.analysis, name));
  const missing = requiredStatistics.filter((filePath) => !fs.existsSync(filePath));
  if (missing.length) throw new Error(`Pedin freeze refused: run pedin-summary; missing ${missing.map(relative).join(", ")}`);
  const rawBefore = sha256File(paths.raw);
  const files = [
    paths.raw, paths.contract, paths.environment,
    ...listFiles(paths.datasets), ...requiredStatistics,
    ...listFiles(path.join(ROOT, "comparisons", "pedin_2023", "documentation")),
  ].sort((a, b) => relative(a).localeCompare(relative(b)));
  const identities = files.map((filePath) => {
    const stat = fs.statSync(filePath);
    return { relative_path: relative(filePath), size_bytes: stat.size, sha256: sha256File(filePath) };
  });
  fs.mkdirSync(paths.freeze, { recursive: true });
  writeCsv(path.join(paths.freeze, "file_hashes.csv"), identities);
  const datasetHashes = identities.filter((item) => item.relative_path.startsWith("results/pedin_baseline/datasets/"));
  writeCsv(path.join(paths.freeze, "dataset_hashes.csv"), datasetHashes);
  const integrity = frozenRawIntegrity();
  const manifest = {
    freeze_version: "PEDIN_PAPER_GUIDED_V1",
    status: "FROZEN",
    freeze_date: new Date().toISOString(),
    scope: "PAPER_GUIDED_MERKLE_SHA256_SETUP_ONLY",
    raw_file: relative(paths.raw),
    raw_sha256: rawBefore,
    rows: 510,
    paper_grid_rows: 390,
    common_grid_rows: 120,
    datasets: datasetHashes.length,
    contract_source_sha256: sha256File(paths.contract),
    environment_snapshot_sha256: sha256File(paths.environment),
    assumption_register_sha256: sha256File(path.join(ROOT, "comparisons", "pedin_2023", "documentation", "PEDIN_ASSUMPTION_REGISTER.md")),
    statistics: requiredStatistics.map((filePath) => ({ relative_path: relative(filePath), sha256: sha256File(filePath) })),
    frozen_primary_experiment_integrity: integrity,
    validation: validation.valid,
  };
  writeJson(path.join(paths.freeze, "pedin_freeze_manifest.json"), manifest);
  if (sha256File(paths.raw) !== rawBefore || !integrity.valid) throw new Error("Pedin freeze failed: raw integrity changed");
  process.stdout.write(`[Pedin Freeze] FROZEN\nrows=510\ndatasets=${datasetHashes.length}\nraw_sha256=${rawBefore}\n`);
  return manifest;
}

module.exports = { freezePedin };
