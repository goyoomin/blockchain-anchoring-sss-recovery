const fs = require("fs");
const path = require("path");

const RAW_COLUMNS = Object.freeze([
  "experiment_id",
  "dataset_id",
  "timestamp",
  "mechanism",
  "n",
  "k",
  "repetition",
  "attempt",
  "seed",
  "success",
  "failure_stage",
  "error_type",
  "error_message",
  "transaction_count",
  "deployment_gas",
  "anchoring_gas",
  "verification_gas",
  "recovery_gas",
  "primary_gas_used",
  "total_transaction_gas",
  "share_generation_time_ms",
  "merkle_tree_generation_time_ms",
  "share_load_time_ms",
  "blockchain_query_time_ms",
  "verification_time_ms",
  "merkle_proof_time_ms",
  "sss_reconstruction_time_ms",
  "total_recovery_time_ms",
  "block_gas_limit",
  "node_version",
  "hardhat_version",
  "ethers_version",
  "solidity_version",
]);

function csvValue(value) {
  if (value === undefined || value === null) return "";
  const text = typeof value === "bigint" ? value.toString() : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readCsvObjects(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function appendRawRow(filePath, row) {
  // Loaded lazily to avoid changing the pre-freeze experiment dependency graph.
  require("../freeze/protection").assertNotFrozenRawDestination(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const exists = fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  const line = RAW_COLUMNS.map((column) => csvValue(row[column])).join(",");
  const prefix = exists ? "" : `${RAW_COLUMNS.join(",")}\n`;
  fs.appendFileSync(filePath, `${prefix}${line}\n`, "utf8");
}

function appendTransactionLog(directory, experimentId, records) {
  if (!records || records.length === 0) return null;
  fs.mkdirSync(directory, { recursive: true });
  const safeId = experimentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const target = path.join(directory, `${safeId}.jsonl`);
  const payload = records
    .map((record) => JSON.stringify(record, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value))
    .join("\n");
  fs.writeFileSync(target, `${payload}\n`, { encoding: "utf8", flag: "wx" });
  return target;
}

function existingExperimentIds(filePath) {
  return new Set(readCsvObjects(filePath).map((row) => row.experiment_id));
}

module.exports = {
  RAW_COLUMNS,
  csvValue,
  parseCsv,
  readCsvObjects,
  appendRawRow,
  appendTransactionLog,
  existingExperimentIds,
};
