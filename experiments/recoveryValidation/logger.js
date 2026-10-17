const fs = require("fs");
const path = require("path");
const { csvValue, parseCsv, readCsvObjects } = require("../logger/experimentLogger");

const RECOVERY_COLUMNS = Object.freeze([
  "experiment_id", "dataset_id", "dataset_digest_sha256", "timestamp",
  "n", "k", "repetition", "mechanism", "execution_order", "sequence",
  "position", "success", "failure_stage", "error_type", "error_message",
  "transaction_count", "deployment_gas", "anchoring_gas", "primary_gas_used",
  "total_transaction_gas", "share_generation_time_ms",
  "merkle_tree_generation_time_ms", "share_load_time_ms",
  "blockchain_query_time_ms", "verification_time_ms", "merkle_proof_time_ms",
  "sss_reconstruction_time_ms", "total_recovery_time_ms", "block_gas_limit",
  "node_version", "hardhat_version", "ethers_version", "solidity_version",
]);

function assertHeader(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) return;
  const contents = fs.readFileSync(filePath, "utf8");
  const header = contents.split(/\r?\n/, 1)[0];
  if (header !== RECOVERY_COLUMNS.join(",")) {
    throw new Error(`recovery CSV schema mismatch: ${filePath}`);
  }
  if (!contents.endsWith("\n")) {
    throw new Error(`recovery CSV has an incomplete trailing row: ${filePath}`);
  }
  const malformed = parseCsv(contents).find(
    (row) => row.length !== RECOVERY_COLUMNS.length,
  );
  if (malformed) {
    throw new Error(`recovery CSV has a malformed row: ${filePath}`);
  }
}

function appendRecoveryRow(filePath, row) {
  require("../freeze/protection").assertNotFrozenRawDestination(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  assertHeader(filePath);
  const exists = fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  const prefix = exists ? "" : `${RECOVERY_COLUMNS.join(",")}\n`;
  const line = RECOVERY_COLUMNS.map((column) => csvValue(row[column])).join(",");
  fs.appendFileSync(filePath, `${prefix}${line}\n`, "utf8");
}

function completedKeys(filePath) {
  assertHeader(filePath);
  return new Set(readCsvObjects(filePath).map(
    (row) => `${row.dataset_id}\u0000${row.mechanism}`,
  ));
}

module.exports = { RECOVERY_COLUMNS, appendRecoveryRow, completedKeys };
