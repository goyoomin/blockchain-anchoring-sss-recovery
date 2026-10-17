const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const secrets = require("secrets.js-grempe");
const { Wallet } = require("ethers");
const { paths, thresholdFor } = require("../config/pedinConfig");

function fieldBitsFor(n) {
  return Math.max(8, Math.ceil(Math.log2(n + 1)));
}

function stableDatasetPayload(dataset) {
  return {
    schema_version: dataset.schema_version,
    dataset_id: dataset.dataset_id,
    grid_type: dataset.grid_type,
    n: dataset.n,
    k: dataset.k,
    synthetic_recovery_secret: dataset.synthetic_recovery_secret,
    synthetic_recovery_address_pbk: dataset.synthetic_recovery_address_pbk,
    shares: dataset.shares,
    sss: dataset.sss,
    provenance: dataset.provenance,
  };
}

function digestDataset(dataset) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(stableDatasetPayload(dataset)), "utf8")
    .digest("hex");
}

function generateDataset({ datasetId, gridType, n }) {
  const k = thresholdFor(n);
  const wallet = Wallet.createRandom();
  const secretHex = wallet.privateKey.slice(2);
  const fieldBits = fieldBitsFor(n);
  secrets.init(fieldBits, "nodeCryptoRandomBytes");
  const shares = secrets.share(secretHex, n, k);
  const dataset = {
    schema_version: 1,
    dataset_id: datasetId,
    grid_type: gridType,
    n,
    k,
    synthetic_recovery_secret: wallet.privateKey,
    synthetic_recovery_address_pbk: wallet.address,
    shares,
    sss: {
      scheme: "SHAMIR_SECRET_SHARING",
      library: "secrets.js-grempe",
      library_version: "2.0.0",
      field_bits: fieldBits,
      threshold_policy: "K_EQUALS_N_OVER_2_PLUS_1_FOR_EVEN_N",
      share_serialization: "CANONICAL_LIBRARY_ENCODED_STRING_UTF8",
    },
    generated_at: new Date().toISOString(),
    synthetic_research_key: true,
    provenance: {
      baseline: "PEDIN_2023_PAPER_GUIDED_MERKLE_SHA256_SETUP",
      source: "independently generated for this controlled experiment",
      real_user_wallet: false,
      reused_from_frozen_main: false,
    },
  };
  dataset.dataset_digest_sha256 = digestDataset(dataset);
  return dataset;
}

function safeDatasetPath(datasetId, directory = paths.datasets) {
  if (!/^[a-zA-Z0-9_-]+$/.test(datasetId)) throw new Error("unsafe dataset ID");
  return path.join(directory, `${datasetId}.json`);
}

function validateDataset(dataset) {
  const errors = [];
  if (dataset.dataset_digest_sha256 !== digestDataset(dataset)) errors.push("dataset digest mismatch");
  if (dataset.k !== thresholdFor(dataset.n)) errors.push("threshold mismatch");
  if (!Array.isArray(dataset.shares) || dataset.shares.length !== dataset.n) errors.push("share count mismatch");
  if (!dataset.synthetic_research_key || dataset.provenance?.real_user_wallet !== false) errors.push("synthetic-key provenance missing");
  if (!/^0x[0-9a-fA-F]{64}$/.test(dataset.synthetic_recovery_secret || "")) errors.push("synthetic secret format invalid");
  if (new Wallet(dataset.synthetic_recovery_secret).address !== dataset.synthetic_recovery_address_pbk) errors.push("PBK does not derive from secret");
  secrets.init(dataset.sss.field_bits, "nodeCryptoRandomBytes");
  const reconstructed = secrets.combine(dataset.shares.slice(0, dataset.k));
  if (reconstructed.toLowerCase() !== dataset.synthetic_recovery_secret.slice(2).toLowerCase()) errors.push("SSS reconstruction mismatch");
  return { valid: errors.length === 0, errors };
}

function saveDataset(dataset, directory = paths.datasets) {
  fs.mkdirSync(directory, { recursive: true });
  const target = safeDatasetPath(dataset.dataset_id, directory);
  if (fs.existsSync(target)) {
    const existing = loadDataset(dataset.dataset_id, directory);
    if (existing.dataset_digest_sha256 !== dataset.dataset_digest_sha256) throw new Error(`dataset collision: ${dataset.dataset_id}`);
    return target;
  }
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(dataset, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  fs.renameSync(temporary, target);
  return target;
}

function loadDataset(datasetId, directory = paths.datasets) {
  const dataset = JSON.parse(fs.readFileSync(safeDatasetPath(datasetId, directory), "utf8"));
  const validation = validateDataset(dataset);
  if (!validation.valid) throw new Error(`${datasetId}: ${validation.errors.join("; ")}`);
  return dataset;
}

function ensureDataset(options, directory = paths.datasets) {
  const target = safeDatasetPath(options.datasetId, directory);
  if (!fs.existsSync(target)) saveDataset(generateDataset(options), directory);
  return loadDataset(options.datasetId, directory);
}

module.exports = {
  fieldBitsFor,
  digestDataset,
  generateDataset,
  validateDataset,
  saveDataset,
  loadDataset,
  ensureDataset,
  safeDatasetPath,
};
