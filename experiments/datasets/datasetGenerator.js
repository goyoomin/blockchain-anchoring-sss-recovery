const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const secrets = require("secrets.js-grempe");
const { experimentConfig, thresholdFor } = require("../config/experimentConfig");
const { measureSync } = require("../metrics/timer");

function fieldBitsFor(n) {
  return Math.max(8, Math.ceil(Math.log2(n + 1)));
}

function digestDataset(dataset) {
  const stable = JSON.stringify({
    dataset_id: dataset.dataset_id,
    n: dataset.n,
    k: dataset.k,
    secret: dataset.secret,
    shares: dataset.shares,
  });
  return crypto.createHash("sha256").update(stable, "utf8").digest("hex");
}

function generateDataset({ datasetId, n, experimentSeed = null, runSeed = null }) {
  const k = thresholdFor(n);
  const fieldBits = fieldBitsFor(n);
  secrets.init(fieldBits, "nodeCryptoRandomBytes");
  const secret = crypto.randomBytes(32).toString("hex");
  const split = measureSync(() => secrets.share(secret, n, k));
  const dataset = {
    schema_version: 1,
    dataset_id: datasetId,
    created_at: new Date().toISOString(),
    n,
    k,
    threshold_policy: experimentConfig.thresholdPolicy,
    sss_library: "secrets.js-grempe",
    sss_field_bits: fieldBits,
    experiment_seed: experimentSeed,
    run_seed: runSeed,
    seed_controls_cryptographic_rng: false,
    secret,
    shares: split.value,
    share_generation_time_ms: split.elapsedMs,
  };
  dataset.dataset_digest_sha256 = digestDataset(dataset);
  return dataset;
}

function datasetPath(datasetId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(datasetId)) {
    throw new Error("datasetId contains unsafe path characters");
  }
  return path.join(experimentConfig.paths.datasets, `${datasetId}.json`);
}

function saveDataset(dataset) {
  fs.mkdirSync(experimentConfig.paths.datasets, { recursive: true });
  const target = datasetPath(dataset.dataset_id);
  if (fs.existsSync(target)) {
    const existing = loadDataset(dataset.dataset_id).dataset;
    if (existing.dataset_digest_sha256 !== dataset.dataset_digest_sha256) {
      throw new Error(`dataset collision: ${dataset.dataset_id}`);
    }
    return target;
  }
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(dataset, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  fs.renameSync(temporary, target);
  return target;
}

function loadDataset(datasetId) {
  const load = measureSync(() => {
    const parsed = JSON.parse(fs.readFileSync(datasetPath(datasetId), "utf8"));
    const actualDigest = digestDataset(parsed);
    if (actualDigest !== parsed.dataset_digest_sha256) {
      throw new Error(`dataset digest mismatch: ${datasetId}`);
    }
    if (parsed.shares.length !== parsed.n || thresholdFor(parsed.n) !== parsed.k) {
      throw new Error(`dataset invariant failed: ${datasetId}`);
    }
    return parsed;
  });
  return { dataset: load.value, shareLoadTimeMs: load.elapsedMs };
}

function ensureDataset(options) {
  const target = datasetPath(options.datasetId);
  if (!fs.existsSync(target)) {
    saveDataset(generateDataset(options));
  }
  return target;
}

function reconstruct(shares) {
  return secrets.combine(shares);
}

module.exports = {
  fieldBitsFor,
  generateDataset,
  saveDataset,
  loadDataset,
  ensureDataset,
  reconstruct,
  digestDataset,
  datasetPath,
};
