const fs = require("fs");
const crypto = require("crypto");
const { collectEnvironment } = require("../../../experiments/audit/environment");
const { paths } = require("../config/pedinConfig");
const { writeJson } = require("./pedinIo");

const COMPARED_FIELDS = Object.freeze([
  "os", "cpu", "cpu_cores", "ram_bytes", "node_version", "npm_version",
  "hardhat_version", "ethers_version", "solidity_version", "solidity_compiler_version",
  "optimizer_enabled", "optimizer_runs", "sss_library", "sss_library_version",
  "block_gas_limit", "chain_id",
]);

async function collectPedinEnvironment(hre) {
  const current = await collectEnvironment(hre);
  return {
    ...current,
    environment_role: "PEDIN_PAPER_GUIDED_BASELINE_UNDER_FROZEN_HARDHAT_CONFIGURATION",
    baseline_variant: "PEDIN_MERKLE_SHA256_PAPER_GUIDED",
    baseline_hash_algorithm: "SHA256",
    baseline_merkle_implementation: "PROJECT_LOCAL_ORDERED_LAST_LEAF_PADDING",
    share_encoding: "CANONICAL_LIBRARY_ENCODED_STRING_UTF8",
  };
}

function compareWithFrozen(current) {
  const frozen = JSON.parse(fs.readFileSync(paths.frozenEnvironment, "utf8"));
  const comparisons = COMPARED_FIELDS.map((field) => ({
    field,
    frozen: frozen[field] ?? null,
    pedin_baseline: current[field] ?? null,
    match: String(frozen[field]) === String(current[field]),
  }));
  const differences = comparisons.filter((item) => !item.match);
  return {
    environment_match: differences.length === 0,
    compared_fields: comparisons,
    differences,
    excluded_from_match_because_baseline_specific: ["hash_algorithm", "merkle_library", "merkle_library_version"],
    note: "SHA-256 and the custom Pedin Merkle implementation are baseline algorithm choices, not infrastructure mismatches.",
  };
}

async function captureEnvironment(hre) {
  const environment = await collectPedinEnvironment(hre);
  const comparison = compareWithFrozen(environment);
  const environmentId = crypto.createHash("sha256")
    .update(JSON.stringify(Object.fromEntries(COMPARED_FIELDS.map((field) => [field, environment[field]]))))
    .digest("hex");
  const snapshot = { captured_at: new Date().toISOString(), environment_id: environmentId, ...environment, comparison };
  if (fs.existsSync(paths.environment)) {
    const existing = JSON.parse(fs.readFileSync(paths.environment, "utf8"));
    if (existing.environment_id !== environmentId) throw new Error("Pedin environment differs from its existing snapshot");
    return existing;
  }
  writeJson(paths.environment, snapshot);
  return snapshot;
}

module.exports = { COMPARED_FIELDS, collectPedinEnvironment, compareWithFrozen, captureEnvironment };
