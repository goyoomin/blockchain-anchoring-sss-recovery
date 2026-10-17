const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { experimentConfig, thresholdFor } = require("../config/experimentConfig");
const { digestDataset } = require("../datasets/datasetGenerator");
const { csvValue, readCsvObjects } = require("../logger/experimentLogger");
const { validateRecoveryRows } = require("../recoveryValidation/validate");

const ROOT = experimentConfig.paths.root;
const FREEZE_ROOT = path.join(ROOT, "results", "final_freeze");
const MANIFEST_DIRECTORY = path.join(FREEZE_ROOT, "manifest");
const SNAPSHOT_DIRECTORY = path.join(FREEZE_ROOT, "snapshots");
const DOCUMENTATION_DIRECTORY = path.join(FREEZE_ROOT, "documentation");
const KNOWN_MAIN_SHA256 = "a81e49c2a3a2730a5157aa39352c0ff28a00fe283fde630db89ef47827dfaf5d";
const N_VALUES = Object.freeze([5, 10, 20, 50, 100, 500, 1000]);
const ENVIRONMENT_FIELDS = Object.freeze([
  "os", "cpu", "ram_bytes", "node_version", "npm_version", "hardhat_version",
  "ethers_version", "solidity_version", "solidity_compiler_version",
  "optimizer_enabled", "optimizer_runs", "sss_library", "sss_library_version",
  "merkle_library", "merkle_library_version", "hash_algorithm",
  "block_gas_limit", "chain_id",
]);

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function absolute(relativePath) {
  return path.join(ROOT, ...relativePath.split("/"));
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function identity(filePath) {
  const stats = fs.statSync(filePath);
  return {
    relative_path: relative(filePath),
    size_bytes: stats.size,
    sha256: sha256File(filePath),
    modified_time: stats.mtime.toISOString(),
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeCsv(filePath, headers, rows) {
  const text = `${headers.join(",")}\n${rows.map((row) =>
    headers.map((header) => csvValue(row[header])).join(",")).join("\n")}\n`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const current = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(current));
    else if (entry.isFile()) output.push(current);
  }
  return output;
}

function requireCondition(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validateMain() {
  const rows = readCsvObjects(experimentConfig.paths.mainRaw);
  const errors = [];
  const datasetGroups = new Map();
  const conditionCounts = new Map();
  for (const row of rows) {
    if (!datasetGroups.has(row.dataset_id)) datasetGroups.set(row.dataset_id, []);
    datasetGroups.get(row.dataset_id).push(row);
    const condition = `${row.n}\u0000${row.mechanism}`;
    conditionCounts.set(condition, (conditionCounts.get(condition) ?? 0) + 1);
  }
  requireCondition(rows.length === 420, `Main rows=${rows.length}, expected 420`, errors);
  requireCondition(datasetGroups.size === 210, `Main datasets=${datasetGroups.size}, expected 210`, errors);
  requireCondition(
    [...new Set(rows.map((row) => Number(row.n)))].sort((a, b) => a - b).join(",") === N_VALUES.join(","),
    "Main n values do not match the frozen seven-condition design",
    errors,
  );
  requireCondition(
    [...new Set(rows.map((row) => row.mechanism))].sort().join(",") === "MERKLE_ROOT,PER_SHARE",
    "Main mechanisms are not exactly PER_SHARE and MERKLE_ROOT",
    errors,
  );
  for (const [datasetId, pair] of datasetGroups) {
    const mechanisms = pair.map((row) => row.mechanism).sort().join(",");
    requireCondition(pair.length === 2 && mechanisms === "MERKLE_ROOT,PER_SHARE",
      `${datasetId} does not contain one row per mechanism`, errors);
  }
  for (const n of N_VALUES) {
    for (const mechanism of experimentConfig.mechanisms) {
      requireCondition(conditionCounts.get(`${n}\u0000${mechanism}`) === 30,
        `Main n=${n} ${mechanism} does not contain 30 rows`, errors);
    }
    const repetitions = new Set(rows.filter((row) => Number(row.n) === n).map((row) => Number(row.repetition)));
    requireCondition(repetitions.size === 30 && [...repetitions].every((value) => value >= 1 && value <= 30),
      `Main n=${n} repetitions are not exactly 1..30`, errors);
  }
  for (const row of rows.filter((candidate) => candidate.success === "true")) {
    const expectedTransactions = row.mechanism === "PER_SHARE" ? Number(row.n) : 1;
    requireCondition(Number(row.transaction_count) === expectedTransactions,
      `Main ${row.experiment_id} transaction_count is inconsistent`, errors);
  }
  const successes = rows.filter((row) => row.success === "true").length;
  return {
    valid: errors.length === 0,
    rows: rows.length,
    datasets: datasetGroups.size,
    successes,
    failures: rows.length - successes,
    mechanisms: [...new Set(rows.map((row) => row.mechanism))].sort(),
    n_values: [...new Set(rows.map((row) => Number(row.n)))].sort((a, b) => a - b),
    errors,
  };
}

function expectedDatasetIds() {
  const ids = [];
  for (const n of N_VALUES) {
    for (let repetition = 1; repetition <= 30; repetition += 1) {
      ids.push(`main_n${n}_run${String(repetition).padStart(3, "0")}`);
    }
  }
  return ids;
}

function validateDatasets() {
  const errors = [];
  const rows = [];
  const expectedIds = expectedDatasetIds();
  const actualMainFiles = fs.readdirSync(experimentConfig.paths.datasets)
    .filter((name) => /^main_n(?:5|10|20|50|100|500|1000)_run\d{3}\.json$/.test(name));
  requireCondition(actualMainFiles.length === 210,
    `Main dataset file count=${actualMainFiles.length}, expected 210`, errors);
  for (const datasetId of expectedIds) {
    const filePath = path.join(experimentConfig.paths.datasets, `${datasetId}.json`);
    if (!fs.existsSync(filePath)) {
      errors.push(`missing dataset: ${relative(filePath)}`);
      continue;
    }
    let dataset;
    try {
      dataset = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      errors.push(`${datasetId} is not valid JSON: ${error.message}`);
      continue;
    }
    const expectedN = Number(datasetId.match(/^main_n(\d+)_run/)[1]);
    const expectedK = thresholdFor(expectedN);
    requireCondition(dataset.dataset_id === datasetId, `${datasetId} internal ID mismatch`, errors);
    requireCondition(dataset.n === expectedN, `${datasetId} n=${dataset.n}, expected ${expectedN}`, errors);
    requireCondition(dataset.k === expectedK, `${datasetId} k=${dataset.k}, expected ${expectedK}`, errors);
    requireCondition(Array.isArray(dataset.shares) && dataset.shares.length === expectedN,
      `${datasetId} share count mismatch`, errors);
    requireCondition(digestDataset(dataset) === dataset.dataset_digest_sha256,
      `${datasetId} internal digest mismatch`, errors);
    const file = identity(filePath);
    rows.push({
      dataset_id: datasetId,
      n: dataset.n,
      k: dataset.k,
      relative_path: file.relative_path,
      size_bytes: file.size_bytes,
      sha256: file.sha256,
    });
  }
  return { valid: errors.length === 0 && rows.length === 210, count: rows.length, rows, errors };
}

function compareEnvironments(mainPath, recoveryPath) {
  const main = JSON.parse(fs.readFileSync(mainPath, "utf8"));
  const recovery = JSON.parse(fs.readFileSync(recoveryPath, "utf8"));
  const comparisons = ENVIRONMENT_FIELDS.map((field) => ({
    field,
    main: main[field] ?? null,
    recovery_validation: recovery[field] ?? null,
    match: String(main[field]) === String(recovery[field]),
  }));
  const differences = comparisons.filter((item) => !item.match);
  return {
    compared_at: new Date().toISOString(),
    main_environment: relative(mainPath),
    recovery_validation_environment: relative(recoveryPath),
    environment_match: differences.length === 0,
    compared_fields: comparisons,
    differences,
  };
}

function readGitMetadata() {
  const gitMarker = path.join(ROOT, ".git");
  if (!fs.existsSync(gitMarker)) {
    return { repository: false, git_commit: null, git_branch: null, git_status_clean: null, status_entries: [] };
  }
  try {
    const commit = childProcess.execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8", windowsHide: true }).trim();
    const branch = childProcess.execFileSync("git", ["branch", "--show-current"], { cwd: ROOT, encoding: "utf8", windowsHide: true }).trim() || null;
    const statusEntries = childProcess.execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8", windowsHide: true })
      .split(/\r?\n/).filter(Boolean);
    return { repository: true, git_commit: commit, git_branch: branch,
      git_status_clean: statusEntries.length === 0, status_entries: statusEntries };
  } catch (error) {
    return { repository: true, git_commit: null, git_branch: null, git_status_clean: null,
      status_entries: [], error: `Git metadata unavailable: ${error.message}` };
  }
}

function auxiliaryCounts() {
  const candidates = [
    ["pilot", path.join(ROOT, "results", "pilot", "pilot_raw.csv")],
    ["single", path.join(ROOT, "results", "pilot", "single_raw.csv")],
    ["recovery_sanity", experimentConfig.paths.recoveryValidationSanityRaw],
    ["pedin", path.join(ROOT, "results", "pedin", "pedin_raw.csv")],
  ];
  return Object.fromEntries(candidates.filter(([, filePath]) => fs.existsSync(filePath))
    .map(([name, filePath]) => [name, {
      raw_file: relative(filePath),
      rows: readCsvObjects(filePath).length,
      included_in_primary_840: false,
    }]));
}

function categoryFor(filePath) {
  const rel = relative(filePath);
  if (rel === "results/main/main_raw.csv") return "MAIN_RAW";
  if (rel.startsWith("results/main/")) return "MAIN_AUXILIARY";
  if (rel === "results/recovery_validation/recovery_counterbalanced_raw.csv") return "RECOVERY_RAW";
  if (rel.startsWith("results/recovery_validation/") && /summary|analysis|effect|report|main_vs/.test(rel)) return "RECOVERY_SUMMARY";
  if (rel.startsWith("results/recovery_validation/")) return "RECOVERY_AUXILIARY";
  if (rel === "results/environment.json") return "ENVIRONMENT";
  if (rel.startsWith("results/datasets/")) return "DATASET";
  if (rel.startsWith("results/final_freeze/snapshots/")) return "ENVIRONMENT_SNAPSHOT";
  if (rel.startsWith("results/final_freeze/documentation/") || rel.endsWith(".md")) return "DOCUMENTATION";
  if (["hardhat.config.js", "package.json", "package-lock.json"].includes(rel)) return "CONFIG";
  return "SOURCE";
}

function discoverFreezeInputs() {
  const files = new Set();
  const add = (filePath) => { if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) files.add(path.resolve(filePath)); };
  listFiles(path.join(ROOT, "results", "main")).forEach(add);
  listFiles(path.join(ROOT, "results", "recovery_validation")).forEach(add);
  add(experimentConfig.paths.environment);
  expectedDatasetIds().forEach((id) => add(path.join(experimentConfig.paths.datasets, `${id}.json`)));
  ["METRIC_DEFINITIONS.md", "EXPERIMENT_AUDIT.md", "EXPERIMENT_PROTOCOL.md", "EXPERIMENT_COMMANDS.md"].forEach((name) => add(path.join(ROOT, name)));
  listFiles(path.join(ROOT, "contracts")).forEach(add);
  listFiles(path.join(ROOT, "experiments")).filter((filePath) => filePath.endsWith(".js")).forEach(add);
  ["hardhat.config.js", "package.json", "package-lock.json"].forEach((name) => add(path.join(ROOT, name)));
  listFiles(SNAPSHOT_DIRECTORY).forEach(add);
  listFiles(DOCUMENTATION_DIRECTORY).forEach(add);
  return [...files].sort((a, b) => relative(a).localeCompare(relative(b)));
}

function finalMetricDocumentation(main, recovery) {
  return `# Final Metric Selection\n\n` +
    `## Gas Used\n\nThe final gas results are read from \`results/main/main_raw.csv\`. ` +
    `The primary metric is **Cumulative Anchoring Gas Used**. For PER_SHARE it is the sum of receipt \`gasUsed\` for the n \`anchorShare\` transactions. ` +
    `For MERKLE_ROOT it is the receipt \`gasUsed\` of one \`anchorMerkleRoot\` transaction. Deployment gas is excluded from the primary metric.\n\n` +
    `## Recovery Time\n\nThe final Recovery Time results are read from ` +
    `\`results/recovery_validation/recovery_counterbalanced_raw.csv\` and its frozen summary. ` +
    `Main Recovery Time values are not used in the final figures or tables. The counterbalanced source is selected because the 15:15 design removes systematic execution-order sensitivity and is the more strictly controlled recovery result.\n\n` +
    `## Transaction Count\n\nTransaction count follows the Main design: PER_SHARE = n and MERKLE_ROOT = 1. Contract deployment transactions are excluded.\n\n` +
    `## Success Rate\n\nSuccess rates are calculated from actual Raw Data: Main ${main.successes}/${main.rows} ` +
    `(${(100 * main.successes / main.rows).toFixed(2)}%) and Recovery Counterbalanced ${recovery.successful_rows}/${recovery.actual_rows} ` +
    `(${(100 * recovery.successful_rows / recovery.actual_rows).toFixed(2)}%). No success rate is assumed or hardcoded.\n`;
}

function datasetDocumentation() {
  return `# Final Dataset Definition\n\nThe Hardhat Main Evaluation uses n = 5, 10, 20, 50, 100, 500, and 1000. ` +
    `Each share size has 30 independent datasets. Each dataset is used unchanged by both PER_SHARE and MERKLE_ROOT.\n\n` +
    `This yields 210 datasets and 420 Main mechanism executions. The Recovery Counterbalanced Validation reuses the same 210 datasets for 420 additional mechanism executions. ` +
    `The frozen primary Hardhat total is therefore **840 mechanism executions**. Pilot, single, and sanity executions are auxiliary and excluded from 840.\n\n` +
    `The threshold is k = floor(n/2) + 1: 3, 6, 11, 26, 51, 251, and 501 respectively. ` +
    `The dataset manifest discloses only IDs, n, k, paths, sizes, and SHA-256 hashes; it does not reproduce secrets or shares.\n`;
}

function freezeDocumentation({ freezeTime, main, recovery, mainIdentity, recoveryIdentity, datasets, environment }) {
  return `# Final Experiment Freeze\n\n## Freeze Date\n\n${freezeTime}\n\n` +
    `## Purpose\n\nFreeze the completed Hardhat experiment baseline for the MDPI manuscript with reproducible file-level integrity evidence.\n\n` +
    `## Experiment A — Main\n\n${main.rows} mechanism executions across ${main.datasets} datasets. Successes: ${main.successes}; failures: ${main.failures}.\n\n` +
    `## Experiment B — Recovery Counterbalanced Validation\n\n${recovery.actual_rows} mechanism executions across ${recovery.actual_unique_datasets} paired datasets. ` +
    `Successes: ${recovery.successful_rows}; failures: ${recovery.failed_rows}.\n\n` +
    `## Total\n\n840 primary Hardhat mechanism executions. Pilot and sanity executions are excluded.\n\n` +
    `## Final Data Sources\n\n- Gas and transaction count: Main Experiment.\n- Recovery Time: Recovery Counterbalanced Validation.\n\n` +
    `## Integrity\n\n- Main SHA-256: \`${mainIdentity.sha256}\`\n- Recovery Raw SHA-256: \`${recoveryIdentity.sha256}\`\n` +
    `- Main datasets verified: ${datasets.count}/210\n- Environment match: ${environment.environment_match}\n` +
    `- Main failures: ${main.failures}\n- Recovery failures: ${recovery.failed_rows}\n- Freeze validation: VALID\n\n` +
    `## Rule\n\nAfter this freeze, analysis and figure/table generation must read the Raw Data without modifying it. ` +
    `Outputs belong in separate analysis, figures, or tables directories. The two primary Raw CSV destinations are protected by the experiment logger while status is FROZEN.\n`;
}

function makeCounts(main, recovery) {
  return {
    main_experiment: { datasets: main.datasets, mechanism_executions: main.rows,
      successes: main.successes, failures: main.failures },
    recovery_counterbalanced_validation: {
      datasets: recovery.actual_unique_datasets,
      mechanism_executions: recovery.actual_rows,
      successes: recovery.successful_rows,
      failures: recovery.failed_rows,
    },
    total_primary_hardhat_mechanism_executions: main.rows + recovery.actual_rows,
    auxiliary_experiments: auxiliaryCounts(),
  };
}

function requireExistingFreezeFiles(errors) {
  const required = [
    "manifest/freeze_manifest.json", "manifest/file_hashes.csv",
    "manifest/dataset_manifest.csv", "manifest/environment_comparison.json",
    "manifest/experiment_counts.json", "manifest/freeze_validation.json",
    "snapshots/environment_main.json", "snapshots/environment_recovery_validation.json",
    "documentation/FINAL_EXPERIMENT_FREEZE.md",
    "documentation/FINAL_DATASET_DEFINITION.md",
    "documentation/FINAL_METRIC_SELECTION.md",
  ];
  required.forEach((name) => requireCondition(fs.existsSync(path.join(FREEZE_ROOT, ...name.split("/"))),
    `missing freeze file: results/final_freeze/${name}`, errors));
}

function validateExistingFreeze() {
  const errors = [];
  requireExistingFreezeFiles(errors);
  if (errors.length) return { valid: false, errors };
  const manifestPath = path.join(MANIFEST_DIRECTORY, "freeze_manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const hashRows = readCsvObjects(path.join(MANIFEST_DIRECTORY, "file_hashes.csv"));
  const datasetRows = readCsvObjects(path.join(MANIFEST_DIRECTORY, "dataset_manifest.csv"));
  const environment = JSON.parse(fs.readFileSync(path.join(MANIFEST_DIRECTORY, "environment_comparison.json"), "utf8"));
  for (const row of hashRows) {
    const filePath = absolute(row.relative_path);
    if (!fs.existsSync(filePath)) {
      errors.push(`manifest target missing: ${row.relative_path}`);
      continue;
    }
    requireCondition(fs.statSync(filePath).size === Number(row.size_bytes),
      `size changed: ${row.relative_path}`, errors);
    requireCondition(sha256File(filePath) === row.sha256,
      `SHA-256 changed: ${row.relative_path}`, errors);
  }
  const main = validateMain();
  main.errors.forEach((message) => errors.push(message));
  let recovery;
  try {
    recovery = validateRecoveryRows(experimentConfig.paths.recoveryValidationRaw, { requireSuccess: true });
  } catch (error) {
    errors.push(error.message);
    recovery = { actual_rows: readCsvObjects(experimentConfig.paths.recoveryValidationRaw).length,
      actual_unique_datasets: null, successful_rows: null, failed_rows: null };
  }
  const datasets = validateDatasets();
  datasets.errors.forEach((message) => errors.push(message));
  requireCondition(datasetRows.length === 210, `frozen dataset manifest rows=${datasetRows.length}`, errors);
  if (datasetRows.length === 210 && datasets.rows.length === 210) {
    const frozen = new Map(datasetRows.map((row) => [row.dataset_id, row]));
    for (const current of datasets.rows) {
      const row = frozen.get(current.dataset_id);
      requireCondition(row && row.sha256 === current.sha256 && Number(row.size_bytes) === current.size_bytes,
        `dataset manifest mismatch: ${current.dataset_id}`, errors);
    }
  }
  const mainHash = sha256File(experimentConfig.paths.mainRaw);
  const recoveryHash = sha256File(experimentConfig.paths.recoveryValidationRaw);
  requireCondition(mainHash === KNOWN_MAIN_SHA256, "Main Raw does not match the known pre-freeze SHA-256", errors);
  requireCondition(mainHash === manifest.main.sha256, "Main Raw does not match freeze_manifest.json", errors);
  requireCondition(recoveryHash === manifest.recovery_validation.sha256,
    "Recovery Raw does not match freeze_manifest.json", errors);
  requireCondition(environment.environment_match === true, "frozen environment comparison is not a match", errors);
  requireCondition(manifest.status === "FROZEN", `freeze status is ${manifest.status}`, errors);
  requireCondition(manifest.total_primary_mechanism_executions === 840,
    "primary mechanism execution total is not 840", errors);
  return {
    valid: errors.length === 0,
    checked_at: new Date().toISOString(),
    status: errors.length === 0 ? "FROZEN" : "INVALID",
    main_rows: main.rows,
    recovery_rows: recovery.actual_rows,
    datasets: datasets.count,
    primary_mechanism_executions: main.rows + recovery.actual_rows,
    main_hash_valid: mainHash === KNOWN_MAIN_SHA256 && mainHash === manifest.main.sha256,
    recovery_hash_valid: recoveryHash === manifest.recovery_validation.sha256,
    dataset_hashes_valid: datasets.valid && datasetRows.length === 210 &&
      !errors.some((message) => message.startsWith("dataset manifest mismatch")),
    environment_valid: environment.environment_match === true,
    manifest_file_count: hashRows.length,
    errors,
  };
}

function consoleValidation(result) {
  if (!result.valid) {
    process.stdout.write(`[MDPI Freeze] INVALID\n${result.errors.map((error) => `- ${error}`).join("\n")}\n`);
    return;
  }
  process.stdout.write(
    `[MDPI Freeze] VALID\n` +
    `Main rows=${result.main_rows}\nRecovery rows=${result.recovery_rows}\n` +
    `Datasets=${result.datasets}\nPrimary mechanism executions=${result.primary_mechanism_executions}\n` +
    `Main hash=VALID\nRecovery hash=VALID\nDataset hashes=VALID\n` +
    `Environment=VALID\nStatus=FROZEN\n`,
  );
}

function createFreeze() {
  const freezeTime = new Date().toISOString();
  const rawBefore = {
    main: identity(experimentConfig.paths.mainRaw),
    recovery: identity(experimentConfig.paths.recoveryValidationRaw),
  };
  if (rawBefore.main.sha256 !== KNOWN_MAIN_SHA256) {
    throw new Error(`Freeze refused: Main SHA-256 is ${rawBefore.main.sha256}, expected ${KNOWN_MAIN_SHA256}`);
  }
  const main = validateMain();
  if (!main.valid) throw new Error(`Freeze refused: ${main.errors.join("; ")}`);
  const recovery = validateRecoveryRows(experimentConfig.paths.recoveryValidationRaw, { requireSuccess: true });
  const datasets = validateDatasets();
  if (!datasets.valid) throw new Error(`Freeze refused: ${datasets.errors.join("; ")}`);

  fs.mkdirSync(MANIFEST_DIRECTORY, { recursive: true });
  fs.mkdirSync(SNAPSHOT_DIRECTORY, { recursive: true });
  fs.mkdirSync(DOCUMENTATION_DIRECTORY, { recursive: true });
  const mainEnvironmentPath = experimentConfig.paths.environment;
  const recoveryEnvironmentPath = path.join(experimentConfig.paths.recoveryValidation, "environment.json");
  const mainSnapshot = path.join(SNAPSHOT_DIRECTORY, "environment_main.json");
  const recoverySnapshot = path.join(SNAPSHOT_DIRECTORY, "environment_recovery_validation.json");
  fs.copyFileSync(mainEnvironmentPath, mainSnapshot);
  fs.copyFileSync(recoveryEnvironmentPath, recoverySnapshot);
  if (sha256File(mainEnvironmentPath) !== sha256File(mainSnapshot) ||
      sha256File(recoveryEnvironmentPath) !== sha256File(recoverySnapshot)) {
    throw new Error("Freeze refused: environment snapshot copy hash mismatch");
  }
  const environment = compareEnvironments(mainEnvironmentPath, recoveryEnvironmentPath);
  const git = readGitMetadata();
  const counts = makeCounts(main, recovery);
  writeJson(path.join(MANIFEST_DIRECTORY, "environment_comparison.json"), environment);
  writeJson(path.join(MANIFEST_DIRECTORY, "experiment_counts.json"), counts);
  writeCsv(path.join(MANIFEST_DIRECTORY, "dataset_manifest.csv"),
    ["dataset_id", "n", "k", "relative_path", "size_bytes", "sha256"], datasets.rows);
  fs.writeFileSync(path.join(DOCUMENTATION_DIRECTORY, "FINAL_METRIC_SELECTION.md"),
    finalMetricDocumentation(main, recovery), "utf8");
  fs.writeFileSync(path.join(DOCUMENTATION_DIRECTORY, "FINAL_DATASET_DEFINITION.md"),
    datasetDocumentation(), "utf8");
  fs.writeFileSync(path.join(DOCUMENTATION_DIRECTORY, "FINAL_EXPERIMENT_FREEZE.md"),
    freezeDocumentation({ freezeTime, main, recovery, mainIdentity: rawBefore.main,
      recoveryIdentity: rawBefore.recovery, datasets, environment }), "utf8");

  const hashRows = discoverFreezeInputs().map((filePath) => ({
    category: categoryFor(filePath),
    ...identity(filePath),
  }));
  writeCsv(path.join(MANIFEST_DIRECTORY, "file_hashes.csv"),
    ["category", "relative_path", "size_bytes", "sha256", "modified_time"], hashRows);
  const manifest = {
    freeze_version: "MDPI_HARDHAT_V1",
    freeze_date: freezeTime,
    status: "FROZEN",
    source_of_truth_policy: "Original Raw Data and Main dataset paths remain authoritative; no Raw Data copies were created.",
    main: { rows: main.rows, datasets: main.datasets,
      raw_file: relative(experimentConfig.paths.mainRaw), sha256: rawBefore.main.sha256,
      matches_previous_sha256: rawBefore.main.sha256 === KNOWN_MAIN_SHA256,
      successes: main.successes, failures: main.failures },
    recovery_validation: { rows: recovery.actual_rows, datasets: recovery.actual_unique_datasets,
      raw_file: relative(experimentConfig.paths.recoveryValidationRaw), sha256: rawBefore.recovery.sha256,
      successes: recovery.successful_rows, failures: recovery.failed_rows },
    total_primary_mechanism_executions: counts.total_primary_hardhat_mechanism_executions,
    final_metric_sources: { gas: "MAIN", recovery_time: "RECOVERY_COUNTERBALANCED",
      transaction_count: "MAIN", success_rate: "ACTUAL_RAW_SUCCESS_FAILURE" },
    environment_match: environment.environment_match,
    datasets_verified: datasets.valid,
    freeze_validation: true,
    hashed_file_count: hashRows.length,
    git,
  };
  writeJson(path.join(MANIFEST_DIRECTORY, "freeze_manifest.json"), manifest);
  writeJson(path.join(MANIFEST_DIRECTORY, "freeze_validation.json"), {
    valid: true, checked_at: freezeTime, status: "PENDING_FINAL_READ_ONLY_CHECK", errors: [],
  });

  const rawAfter = {
    main: identity(experimentConfig.paths.mainRaw),
    recovery: identity(experimentConfig.paths.recoveryValidationRaw),
  };
  if (rawBefore.main.sha256 !== rawAfter.main.sha256 || rawBefore.main.size_bytes !== rawAfter.main.size_bytes ||
      rawBefore.recovery.sha256 !== rawAfter.recovery.sha256 || rawBefore.recovery.size_bytes !== rawAfter.recovery.size_bytes) {
    manifest.status = "FREEZE_FAILED";
    manifest.freeze_validation = false;
    writeJson(path.join(MANIFEST_DIRECTORY, "freeze_manifest.json"), manifest);
    throw new Error("Freeze failed: a primary Raw Data file changed during freeze generation");
  }
  const validation = validateExistingFreeze();
  writeJson(path.join(MANIFEST_DIRECTORY, "freeze_validation.json"), validation);
  if (!validation.valid) {
    manifest.status = "FREEZE_FAILED";
    manifest.freeze_validation = false;
    writeJson(path.join(MANIFEST_DIRECTORY, "freeze_manifest.json"), manifest);
    throw new Error(`Freeze validation failed: ${validation.errors.join("; ")}`);
  }
  consoleValidation(validation);
  return { manifest, validation };
}

module.exports = {
  FREEZE_ROOT,
  KNOWN_MAIN_SHA256,
  sha256File,
  validateMain,
  validateDatasets,
  compareEnvironments,
  validateExistingFreeze,
  consoleValidation,
  createFreeze,
};
