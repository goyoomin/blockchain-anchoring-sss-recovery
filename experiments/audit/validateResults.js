const { experimentConfig } = require("../config/experimentConfig");
const { loadDataset, reconstruct } = require("../datasets/datasetGenerator");
const { readCsvObjects } = require("../logger/experimentLogger");

function expectedMechanisms(scope) {
  return scope === "pedin"
    ? experimentConfig.pedinMechanisms
    : experimentConfig.mechanisms;
}

function rawPathFor(scope) {
  if (scope === "pilot") return experimentConfig.paths.pilotRaw;
  if (scope === "main") return experimentConfig.paths.mainRaw;
  if (scope === "pedin") return experimentConfig.paths.pedinRaw;
  throw new Error("RESULTS_SCOPE must be pilot, main, or pedin");
}

function validateRows(rows, scope) {
  const errors = [];
  const datasets = new Map();
  const mechanisms = expectedMechanisms(scope);

  for (const row of rows) {
    if (!row.dataset_id.startsWith(`${scope}_`)) {
      errors.push(`${row.experiment_id}: wrong scope`);
    }
    if (!datasets.has(row.dataset_id)) datasets.set(row.dataset_id, []);
    datasets.get(row.dataset_id).push(row);
    if (row.success === "true") {
      const expectedCount = row.mechanism.includes("INDIVIDUAL_HASH") || row.mechanism === "PER_SHARE"
        ? Number(row.n)
        : 1;
      if (Number(row.transaction_count) !== expectedCount) {
        errors.push(`${row.experiment_id}: transaction_count=${row.transaction_count}, expected ${expectedCount}`);
      }
      if (!(Number(row.primary_gas_used) > 0)) {
        errors.push(`${row.experiment_id}: primary gas is not a positive receipt value`);
      }
      if (!(Number(row.total_recovery_time_ms) >= 0)) {
        errors.push(`${row.experiment_id}: recovery time is invalid`);
      }
    }
  }

  for (const [datasetId, pairedRows] of datasets) {
    const found = new Set(pairedRows.map((row) => row.mechanism));
    for (const mechanism of mechanisms) {
      if (!found.has(mechanism)) errors.push(`${datasetId}: missing ${mechanism}`);
    }
    const { dataset } = loadDataset(datasetId);
    if (reconstruct(dataset.shares.slice(0, dataset.k)) !== dataset.secret) {
      errors.push(`${datasetId}: SSS reconstruction failed during validation`);
    }
    for (const row of pairedRows) {
      if (Number(row.n) !== dataset.n || Number(row.k) !== dataset.k) {
        errors.push(`${datasetId}: raw n/k differs from the paired dataset`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    row_count: rows.length,
    dataset_count: datasets.size,
    success_count: rows.filter((row) => row.success === "true").length,
    failure_count: rows.filter((row) => row.success !== "true").length,
    errors,
  };
}

function main() {
  const scope = process.env.RESULTS_SCOPE ?? "pilot";
  const report = validateRows(readCsvObjects(rawPathFor(scope)), scope);
  process.stdout.write(`${JSON.stringify({ scope, ...report }, null, 2)}\n`);
  if (!report.valid) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { validateRows, rawPathFor };
