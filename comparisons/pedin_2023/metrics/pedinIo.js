const fs = require("fs");
const path = require("path");
const { csvValue, readCsvObjects } = require("../../../experiments/logger/experimentLogger");

const PEDIN_RAW_COLUMNS = Object.freeze([
  "experiment_id", "dataset_id", "grid_type", "n", "k", "repetition",
  "variant", "hash_algorithm", "share_encoding", "leaf_count_actual",
  "leaf_count_padded", "padding_count", "padding_rule",
  "setup_transaction_count", "setup_gas_used", "deployment_gas",
  "recovery_address", "merkle_root", "setup_success", "readback_success",
  "all_proofs_valid", "failure_stage", "error_type", "error_message",
  "environment_id", "dataset_digest_sha256", "timestamp",
]);

function appendPedinRow(filePath, row) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const exists = fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  if (exists) {
    const firstLine = fs.readFileSync(filePath, "utf8").split(/\r?\n/, 1)[0];
    if (firstLine !== PEDIN_RAW_COLUMNS.join(",")) throw new Error(`Pedin raw schema mismatch: ${filePath}`);
  }
  const prefix = exists ? "" : `${PEDIN_RAW_COLUMNS.join(",")}\n`;
  const line = PEDIN_RAW_COLUMNS.map((column) => csvValue(row[column])).join(",");
  fs.appendFileSync(filePath, `${prefix}${line}\n`, "utf8");
}

function writeCsv(filePath, rows, headers = rows.length ? Object.keys(rows[0]) : []) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const text = headers.length
    ? `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")).join("\n")}\n`
    : "";
  fs.writeFileSync(filePath, text, "utf8");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

module.exports = { PEDIN_RAW_COLUMNS, appendPedinRow, readCsvObjects, writeCsv, writeJson };
