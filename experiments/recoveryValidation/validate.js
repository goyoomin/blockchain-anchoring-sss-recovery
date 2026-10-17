const { experimentConfig, thresholdFor } = require("../config/experimentConfig");
const { loadDataset } = require("../datasets/datasetGenerator");
const { readCsvObjects } = require("../logger/experimentLogger");
const { RECOVERY_COLUMNS } = require("./logger");
const { scheduleFor } = require("./schedule");

function validationError(message) {
  const error = new Error(message);
  error.name = "RecoveryValidationError";
  return error;
}

function validateRecoveryRows(rawPath = experimentConfig.paths.recoveryValidationRaw, {
  nValues = experimentConfig.mainNValues,
  repetitions = experimentConfig.repetitions,
  requireSuccess = true,
} = {}) {
  const rows = readCsvObjects(rawPath);
  const expectedDatasets = nValues.length * repetitions;
  const expectedRows = expectedDatasets * 2;
  const errors = [];
  if (rows.length !== expectedRows) errors.push(`row count ${rows.length}, expected ${expectedRows}`);
  if (rows.length && Object.keys(rows[0]).join(",") !== RECOVERY_COLUMNS.join(",")) {
    errors.push("raw CSV columns do not match the recovery-validation schema");
  }

  const rowKeys = new Set();
  const byDataset = new Map();
  for (const row of rows) {
    const key = `${row.dataset_id}\u0000${row.mechanism}`;
    if (rowKeys.has(key)) errors.push(`duplicate dataset/mechanism: ${row.dataset_id} ${row.mechanism}`);
    rowKeys.add(key);
    if (!byDataset.has(row.dataset_id)) byDataset.set(row.dataset_id, []);
    byDataset.get(row.dataset_id).push(row);
  }
  if (byDataset.size !== expectedDatasets) {
    errors.push(`unique dataset count ${byDataset.size}, expected ${expectedDatasets}`);
  }

  for (const n of nValues) {
    const datasetsForN = [...byDataset.values()].filter(
      (pair) => Number(pair[0]?.n) === n,
    );
    if (datasetsForN.length !== repetitions) {
      errors.push(`n=${n} has ${datasetsForN.length} datasets, expected ${repetitions}`);
    }
    const sequenceCounts = { PER_SHARE_FIRST: 0, MERKLE_ROOT_FIRST: 0 };
    const positions = {
      PER_SHARE: { FIRST: 0, SECOND: 0 },
      MERKLE_ROOT: { FIRST: 0, SECOND: 0 },
    };
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      const datasetId = `main_n${n}_run${String(repetition).padStart(3, "0")}`;
      const pair = byDataset.get(datasetId) ?? [];
      if (pair.length !== 2) {
        errors.push(`${datasetId} has ${pair.length} mechanism rows, expected 2`);
        continue;
      }
      const mechanisms = pair.map((row) => row.mechanism).sort().join("|");
      if (mechanisms !== "MERKLE_ROOT|PER_SHARE") {
        errors.push(`${datasetId} mechanism pair is ${mechanisms}`);
      }
      const expected = scheduleFor(repetition);
      const sequences = new Set(pair.map((row) => row.sequence));
      const digests = new Set(pair.map((row) => row.dataset_digest_sha256));
      if (sequences.size !== 1 || !sequences.has(expected.sequence)) {
        errors.push(`${datasetId} sequence does not match deterministic schedule`);
      } else {
        sequenceCounts[expected.sequence] += 1;
      }
      if (digests.size !== 1) errors.push(`${datasetId} pair has different dataset digests`);
      let actual;
      try {
        actual = loadDataset(datasetId).dataset;
      } catch (error) {
        errors.push(`${datasetId} cannot be validated: ${error.message}`);
      }
      if (actual && [...digests][0] !== actual.dataset_digest_sha256) {
        errors.push(`${datasetId} raw digest does not match immutable dataset file`);
      }
      for (const row of pair) {
        const expectedPosition = expected.mechanisms.indexOf(row.mechanism) === 0 ? "FIRST" : "SECOND";
        if (row.position !== expectedPosition || Number(row.execution_order) !== (expectedPosition === "FIRST" ? 1 : 2)) {
          errors.push(`${datasetId} ${row.mechanism} has invalid position/order`);
        }
        if (Number(row.n) !== n || Number(row.k) !== thresholdFor(n) || Number(row.repetition) !== repetition) {
          errors.push(`${datasetId} ${row.mechanism} has inconsistent n/k/repetition`);
        }
        if (positions[row.mechanism]?.[row.position] !== undefined) {
          positions[row.mechanism][row.position] += 1;
        }
      }
    }
    const firstTarget = Math.ceil(repetitions / 2);
    const secondTarget = Math.floor(repetitions / 2);
    if (sequenceCounts.PER_SHARE_FIRST !== firstTarget || sequenceCounts.MERKLE_ROOT_FIRST !== secondTarget) {
      errors.push(`n=${n} sequence balance is ${sequenceCounts.PER_SHARE_FIRST}:${sequenceCounts.MERKLE_ROOT_FIRST}, expected ${firstTarget}:${secondTarget}`);
    }
    for (const mechanism of experimentConfig.mechanisms) {
      if (positions[mechanism].FIRST !== firstTarget || positions[mechanism].SECOND !== secondTarget) {
        errors.push(`n=${n} ${mechanism} position balance is ${positions[mechanism].FIRST}:${positions[mechanism].SECOND}`);
      }
    }
  }

  const failures = rows.filter((row) => row.success !== "true");
  if (requireSuccess && failures.length) errors.push(`${failures.length} measurement rows failed`);
  const result = {
    valid: errors.length === 0,
    raw_path: rawPath,
    expected_rows: expectedRows,
    actual_rows: rows.length,
    expected_unique_datasets: expectedDatasets,
    actual_unique_datasets: byDataset.size,
    successful_rows: rows.length - failures.length,
    failed_rows: failures.length,
    errors,
  };
  if (errors.length) throw validationError(`Recovery validation failed:\n- ${errors.join("\n- ")}`);
  return result;
}

module.exports = { validateRecoveryRows };
