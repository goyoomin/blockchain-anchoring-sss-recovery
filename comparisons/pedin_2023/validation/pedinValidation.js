const fs = require("fs");
const path = require("path");
const {
  PAPER_GRID, COMMON_COMPARISON_GRID, REPETITIONS, VARIANT, paths, thresholdFor, nextPowerOfTwo,
} = require("../config/pedinConfig");
const { loadDataset } = require("../datasets/pedinDataset");
const { buildPedinMerkleTree, validateAllActualProofs } = require("../merkle/pedinMerkleSha256");
const { PEDIN_RAW_COLUMNS, readCsvObjects, writeJson } = require("../metrics/pedinIo");
const { frozenRawIntegrity, sourceHashEntries } = require("../metrics/integrity");
const { validateExistingFreeze } = require("../../../experiments/freeze/freeze");

function truth(value) {
  return String(value).toLowerCase() === "true";
}

function validateRows(rows, { sanity = false } = {}) {
  const errors = [];
  const expected = sanity ? [
    ["PAPER_GRID", 2], ["PAPER_GRID", 16], ["PAPER_GRID", 192], ["COMMON_COMPARISON_GRID", 10],
  ] : [
    ...PAPER_GRID.map((n) => ["PAPER_GRID", n]),
    ...COMMON_COMPARISON_GRID.map((n) => ["COMMON_COMPARISON_GRID", n]),
  ];
  const expectedRows = sanity ? 4 : 510;
  if (rows.length !== expectedRows) errors.push(`rows=${rows.length}, expected ${expectedRows}`);
  if (rows.length && Object.keys(rows[0]).join(",") !== PEDIN_RAW_COLUMNS.join(",")) errors.push("raw schema mismatch");
  const ids = new Set();
  const datasets = new Set();
  for (const row of rows) {
    if (ids.has(row.experiment_id)) errors.push(`duplicate experiment_id: ${row.experiment_id}`);
    ids.add(row.experiment_id);
    if (datasets.has(row.dataset_id)) errors.push(`duplicate dataset_id: ${row.dataset_id}`);
    datasets.add(row.dataset_id);
    const n = Number(row.n);
    if (Number(row.k) !== thresholdFor(n)) errors.push(`${row.dataset_id}: k mismatch`);
    if (row.variant !== VARIANT) errors.push(`${row.dataset_id}: variant mismatch`);
    if (row.hash_algorithm !== "SHA256") errors.push(`${row.dataset_id}: hash algorithm mismatch`);
    if (row.share_encoding !== "CANONICAL_LIBRARY_ENCODED_STRING_UTF8") errors.push(`${row.dataset_id}: share encoding mismatch`);
    if (Number(row.leaf_count_actual) !== n) errors.push(`${row.dataset_id}: actual leaf count mismatch`);
    if (Number(row.leaf_count_padded) !== nextPowerOfTwo(n)) errors.push(`${row.dataset_id}: padded leaf count mismatch`);
    if (Number(row.padding_count) !== nextPowerOfTwo(n) - n) errors.push(`${row.dataset_id}: padding count mismatch`);
    if (row.padding_rule !== "LAST_ACTUAL_LEAF_TO_NEXT_POWER_OF_TWO") errors.push(`${row.dataset_id}: padding rule mismatch`);
    if (Number(row.setup_transaction_count) !== 1) errors.push(`${row.dataset_id}: setup transaction count mismatch`);
    if (!(Number(row.setup_gas_used) > 0)) errors.push(`${row.dataset_id}: setup receipt gas missing`);
    if (!(Number(row.deployment_gas) > 0)) errors.push(`${row.dataset_id}: deployment receipt gas missing`);
    if (!truth(row.setup_success)) errors.push(`${row.dataset_id}: setup failed`);
    if (!truth(row.readback_success)) errors.push(`${row.dataset_id}: read-back failed`);
    if (!truth(row.all_proofs_valid)) errors.push(`${row.dataset_id}: proof validation failed`);
    if (!/^0x[0-9a-fA-F]{64}$/.test(row.merkle_root)) errors.push(`${row.dataset_id}: root is not bytes32`);
    if (row.failure_stage || row.error_type || row.error_message) errors.push(`${row.dataset_id}: failure fields are non-empty`);
    try {
      const directory = sanity ? paths.sanityDatasets : paths.datasets;
      const dataset = loadDataset(row.dataset_id, directory);
      if (dataset.dataset_digest_sha256 !== row.dataset_digest_sha256) errors.push(`${row.dataset_id}: raw/dataset digest mismatch`);
      const tree = buildPedinMerkleTree(dataset.shares);
      if (tree.root.toLowerCase() !== row.merkle_root.toLowerCase()) errors.push(`${row.dataset_id}: recorded root mismatch`);
      if (!validateAllActualProofs(dataset.shares, tree)) errors.push(`${row.dataset_id}: independent proof revalidation failed`);
    } catch (error) {
      errors.push(`${row.dataset_id}: dataset validation error: ${error.message}`);
    }
  }
  for (const [gridType, n] of expected) {
    const condition = rows.filter((row) => row.grid_type === gridType && Number(row.n) === n);
    const count = sanity ? 1 : REPETITIONS;
    if (condition.length !== count) errors.push(`${gridType} n=${n}: rows=${condition.length}, expected ${count}`);
    const reps = condition.map((row) => Number(row.repetition)).sort((a, b) => a - b);
    const expectedReps = Array.from({ length: count }, (_, index) => index + 1);
    if (reps.join(",") !== expectedReps.join(",")) errors.push(`${gridType} n=${n}: repetition set mismatch`);
  }
  const actualConditions = [...new Set(rows.map((row) => `${row.grid_type}:${row.n}`))].sort();
  const expectedConditions = expected.map(([grid, n]) => `${grid}:${n}`).sort();
  if (actualConditions.join("|") !== expectedConditions.join("|")) errors.push("grid conditions differ from the locked design");
  return {
    valid: errors.length === 0,
    expected_rows: expectedRows,
    actual_rows: rows.length,
    unique_dataset_ids: datasets.size,
    success_count: rows.filter((row) => truth(row.setup_success) && truth(row.readback_success) && truth(row.all_proofs_valid)).length,
    failure_count: rows.filter((row) => !(truth(row.setup_success) && truth(row.readback_success) && truth(row.all_proofs_valid))).length,
    errors,
  };
}

function validateInfrastructure() {
  const errors = [];
  const integrity = frozenRawIntegrity();
  if (!integrity.valid) errors.push("Frozen Main/Recovery SHA-256 mismatch");
  const frozen = validateExistingFreeze();
  if (!frozen.valid) errors.push(...frozen.errors.map((error) => `Frozen validation: ${error}`));
  let environment = null;
  if (!fs.existsSync(paths.environment)) errors.push("Pedin environment snapshot is missing");
  else {
    environment = JSON.parse(fs.readFileSync(paths.environment, "utf8"));
    if (environment.comparison?.environment_match !== true) errors.push("Pedin environment does not match frozen infrastructure");
  }
  return { valid: errors.length === 0, integrity, frozen_validation: frozen, environment, errors };
}

function validateSanity({ createReadyMarker = true } = {}) {
  const rows = readCsvObjects(paths.sanityRaw);
  const data = validateRows(rows, { sanity: true });
  const infrastructure = validateInfrastructure();
  const errors = [...data.errors, ...infrastructure.errors];
  const byN = Object.fromEntries(rows.map((row) => [row.n, {
    grid_type: row.grid_type,
    actual_leaf_count: Number(row.leaf_count_actual),
    padded_leaf_count: Number(row.leaf_count_padded),
    padding_count: Number(row.padding_count),
    all_proofs_valid: truth(row.all_proofs_valid),
    readback_success: truth(row.readback_success),
    setup_gas_used: Number(row.setup_gas_used),
    deployment_gas: Number(row.deployment_gas),
  }]));
  if (byN[192] && (byN[192].actual_leaf_count !== 192 || byN[192].padded_leaf_count !== 256 || byN[192].padding_count !== 64)) {
    errors.push("n=192 must have actual=192, padded=256, padding=64");
  }
  const testReportPath = path.join(paths.sanityRoot, "pedin_source_fidelity_tests.json");
  let testReport = null;
  if (!fs.existsSync(testReportPath)) errors.push("source-fidelity test report is missing; run pedin-test first");
  else {
    testReport = JSON.parse(fs.readFileSync(testReportPath, "utf8"));
    if (testReport.valid !== true) errors.push("source-fidelity tests are not valid");
  }
  const result = {
    valid: errors.length === 0,
    status: errors.length === 0 ? "PEDIN BASELINE READY FOR FULL EXECUTION" : "PEDIN SANITY INVALID",
    validated_at: new Date().toISOString(),
    data,
    conditions: byN,
    n2_reference_root_valid: testReport?.tests?.n2_reference_root === true,
    n192_padding_valid: byN[192]?.actual_leaf_count === 192 && byN[192]?.padded_leaf_count === 256 && byN[192]?.padding_count === 64,
    environment_match: infrastructure.environment?.comparison?.environment_match === true,
    frozen_integrity: infrastructure.integrity,
    frozen_validation: infrastructure.frozen_validation,
    source_fidelity_tests: testReport,
    errors,
  };
  writeJson(paths.sanityValidation, result);
  if (result.valid && createReadyMarker) {
    writeJson(paths.readyMarker, {
      status: result.status,
      created_at: result.validated_at,
      sanity_validation: path.relative(paths.root, paths.sanityValidation).replace(/\\/g, "/"),
      source_hashes: sourceHashEntries(),
      frozen_main_sha256: infrastructure.integrity.main.sha256,
      frozen_recovery_sha256: infrastructure.integrity.recovery.sha256,
      expected_full_rows: 510,
    });
  }
  return result;
}

function validateFull() {
  const data = validateRows(readCsvObjects(paths.raw), { sanity: false });
  const infrastructure = validateInfrastructure();
  const errors = [...data.errors, ...infrastructure.errors];
  const result = {
    valid: errors.length === 0,
    status: errors.length === 0 ? "VALID" : "INVALID",
    validated_at: new Date().toISOString(),
    paper_grid_rows: readCsvObjects(paths.raw).filter((row) => row.grid_type === "PAPER_GRID").length,
    common_grid_rows: readCsvObjects(paths.raw).filter((row) => row.grid_type === "COMMON_COMPARISON_GRID").length,
    total_rows: data.actual_rows,
    data,
    environment_match: infrastructure.environment?.comparison?.environment_match === true,
    frozen_integrity: infrastructure.integrity,
    errors,
  };
  writeJson(path.join(paths.resultRoot, "pedin_validation.json"), result);
  return result;
}

function printValidation(result, label = "Pedin Baseline") {
  if (!result.valid) {
    process.stdout.write(`[${label}] INVALID\n${result.errors.map((error) => `- ${error}`).join("\n")}\n`);
    return;
  }
  process.stdout.write(
    `[${label}] VALID\nrows=${result.data?.actual_rows ?? result.total_rows}\n` +
    `datasets=${result.data?.unique_dataset_ids ?? ""}\n` +
    `environment=VALID\nfrozen_main=VALID\nfrozen_recovery=VALID\n`,
  );
}

module.exports = { truth, validateRows, validateInfrastructure, validateSanity, validateFull, printValidation };
