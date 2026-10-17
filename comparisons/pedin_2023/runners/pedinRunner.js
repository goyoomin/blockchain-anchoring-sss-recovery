const fs = require("fs");
const path = require("path");
const {
  PAPER_GRID, COMMON_COMPARISON_GRID, REPETITIONS, VARIANT, paths, thresholdFor,
} = require("../config/pedinConfig");
const { ensureDataset } = require("../datasets/pedinDataset");
const { buildPedinMerkleTree, validateAllActualProofs } = require("../merkle/pedinMerkleSha256");
const { appendPedinRow, readCsvObjects } = require("../metrics/pedinIo");
const { captureEnvironment } = require("../metrics/environment");
const { frozenRawIntegrity, verifySourceHashEntries } = require("../metrics/integrity");

function padRun(repetition) {
  return String(repetition).padStart(3, "0");
}

function gridSlug(gridType) {
  return gridType === "PAPER_GRID" ? "paper" : "common";
}

function datasetIdFor(gridType, n, repetition, sanity = false) {
  return `pedin_${sanity ? "sanity_" : ""}${gridSlug(gridType)}_n${n}_run${padRun(repetition)}`;
}

function experimentIdFor(gridType, n, repetition, sanity = false) {
  return `${datasetIdFor(gridType, n, repetition, sanity)}_${VARIANT}`;
}

function emptyRow({ gridType, n, repetition, sanity, environmentId }) {
  return {
    experiment_id: experimentIdFor(gridType, n, repetition, sanity),
    dataset_id: datasetIdFor(gridType, n, repetition, sanity),
    grid_type: gridType,
    n,
    k: thresholdFor(n),
    repetition,
    variant: VARIANT,
    hash_algorithm: "SHA256",
    share_encoding: "CANONICAL_LIBRARY_ENCODED_STRING_UTF8",
    leaf_count_actual: "",
    leaf_count_padded: "",
    padding_count: "",
    padding_rule: "LAST_ACTUAL_LEAF_TO_NEXT_POWER_OF_TWO",
    setup_transaction_count: 0,
    setup_gas_used: "",
    deployment_gas: "",
    recovery_address: "",
    merkle_root: "",
    setup_success: false,
    readback_success: false,
    all_proofs_valid: false,
    failure_stage: "",
    error_type: "",
    error_message: "",
    environment_id: environmentId,
    dataset_digest_sha256: "",
    timestamp: new Date().toISOString(),
  };
}

async function executeOne(hre, spec, environmentId) {
  const row = emptyRow({ ...spec, environmentId });
  let stage = "DATASET_GENERATION";
  try {
    const datasetDirectory = spec.sanity ? paths.sanityDatasets : paths.datasets;
    const dataset = ensureDataset({
      datasetId: row.dataset_id,
      gridType: spec.gridType,
      n: spec.n,
    }, datasetDirectory);
    row.dataset_digest_sha256 = dataset.dataset_digest_sha256;
    row.recovery_address = dataset.synthetic_recovery_address_pbk;

    stage = "NETWORK_RESET";
    await hre.network.provider.send("hardhat_reset");

    stage = "DEPLOYMENT";
    const factory = await hre.ethers.getContractFactory("PedinPaperGuidedSetup");
    const contract = await factory.deploy();
    const deploymentReceipt = await contract.deploymentTransaction().wait();
    if (!deploymentReceipt?.gasUsed || deploymentReceipt.gasUsed <= 0n) throw new Error("deployment receipt gasUsed missing");
    row.deployment_gas = deploymentReceipt.gasUsed.toString();

    stage = "MERKLE_BUILD";
    const tree = buildPedinMerkleTree(dataset.shares);
    row.leaf_count_actual = tree.actual_leaf_count;
    row.leaf_count_padded = tree.padded_leaf_count;
    row.padding_count = tree.padding_count;
    row.merkle_root = tree.root;
    if (tree.actual_leaf_count !== spec.n) throw new Error("actual leaf count mismatch");
    if (tree.paddedLeaves.slice(tree.actual_leaf_count).some((leaf) =>
      !leaf.equals(tree.actualLeaves[tree.actualLeaves.length - 1]))) {
      throw new Error("padding is not a duplication of the last actual leaf");
    }

    stage = "PROOF_VALIDATION";
    row.all_proofs_valid = validateAllActualProofs(dataset.shares, tree);
    if (!row.all_proofs_valid) throw new Error("one or more actual-share proofs failed");

    stage = "SETUP_TRANSACTION";
    const transaction = await contract.setup(dataset.synthetic_recovery_address_pbk, tree.root);
    row.setup_transaction_count = 1;

    stage = "RECEIPT";
    const receipt = await transaction.wait();
    if (!receipt?.gasUsed || receipt.gasUsed <= 0n) throw new Error("setup receipt gasUsed missing");
    if (Number(receipt.status) !== 1) throw new Error("setup transaction did not succeed");
    row.setup_gas_used = receipt.gasUsed.toString();
    row.setup_success = true;

    stage = "READBACK";
    const storedAddress = await contract.recoveryAddress();
    const storedRoot = await contract.merkleRoot();
    row.readback_success = storedAddress.toLowerCase() === dataset.synthetic_recovery_address_pbk.toLowerCase() &&
      storedRoot.toLowerCase() === tree.root.toLowerCase();
    if (!row.readback_success) throw new Error("PBK or Merkle root read-back mismatch");
  } catch (error) {
    row.failure_stage = stage;
    row.error_type = error?.code || error?.name || "ERROR";
    row.error_message = error?.message || String(error);
  }
  row.timestamp = new Date().toISOString();
  return row;
}

async function executeSchedule(hre, schedule, { sanity = false } = {}) {
  const rawPath = sanity ? paths.sanityRaw : paths.raw;
  const existingRows = readCsvObjects(rawPath);
  const existingIds = new Set(existingRows.map((row) => row.experiment_id));
  if (existingIds.size !== existingRows.length) throw new Error(`duplicate experiment IDs already exist in ${rawPath}`);
  const environment = await captureEnvironment(hre);
  const before = frozenRawIntegrity();
  if (!before.valid) throw new Error("Frozen Main or Recovery SHA-256 failed before Pedin execution");

  let completed = existingRows.length;
  const total = schedule.length;
  for (const spec of schedule) {
    const experimentId = experimentIdFor(spec.gridType, spec.n, spec.repetition, sanity);
    if (existingIds.has(experimentId)) continue;
    const row = await executeOne(hre, { ...spec, sanity }, environment.environment_id);
    appendPedinRow(rawPath, row);
    existingIds.add(experimentId);
    completed += 1;
    process.stdout.write(
      `[Pedin Baseline]\n` +
      `grid=${gridSlug(spec.gridType).toUpperCase()}\n` +
      `n=${spec.n}\nrun=${spec.repetition}/${sanity ? 1 : REPETITIONS}\n` +
      `dataset=${row.dataset_id}\nvariant=${VARIANT}\n` +
      `status=${row.setup_success && row.readback_success && row.all_proofs_valid ? "SUCCESS" : "FAILURE"}\n` +
      `setup_gas=${row.setup_gas_used || "NA"}\nprogress=${completed}/${total}\n`,
    );
  }
  const after = frozenRawIntegrity();
  if (!after.valid || before.main.sha256 !== after.main.sha256 || before.recovery.sha256 !== after.recovery.sha256) {
    throw new Error("Frozen Main or Recovery data changed during Pedin execution");
  }
  return { rawPath, rows: readCsvObjects(rawPath), environment, frozen_before: before, frozen_after: after };
}

function sanitySchedule() {
  return [
    { gridType: "PAPER_GRID", n: 2, repetition: 1 },
    { gridType: "PAPER_GRID", n: 16, repetition: 1 },
    { gridType: "PAPER_GRID", n: 192, repetition: 1 },
    { gridType: "COMMON_COMPARISON_GRID", n: 10, repetition: 1 },
  ];
}

function fullSchedule() {
  const output = [];
  for (const [gridType, values] of [["PAPER_GRID", PAPER_GRID], ["COMMON_COMPARISON_GRID", COMMON_COMPARISON_GRID]]) {
    for (const n of values) for (let repetition = 1; repetition <= REPETITIONS; repetition += 1) {
      output.push({ gridType, n, repetition });
    }
  }
  return output;
}

function assertReadyForFullExecution() {
  if (!fs.existsSync(paths.readyMarker)) throw new Error("Full execution is locked: run and validate pedin-sanity first");
  const marker = JSON.parse(fs.readFileSync(paths.readyMarker, "utf8"));
  if (marker.status !== "PEDIN BASELINE READY FOR FULL EXECUTION") throw new Error("Full execution readiness marker is not VALID");
  const sources = verifySourceHashEntries(marker.source_hashes);
  if (!sources.valid) throw new Error(`Full execution is locked: ${sources.errors.join("; ")}`);
  if (!frozenRawIntegrity().valid) throw new Error("Full execution is locked: frozen raw integrity failed");
  return marker;
}

async function runSanity(hre) {
  return executeSchedule(hre, sanitySchedule(), { sanity: true });
}

async function runFull(hre) {
  assertReadyForFullExecution();
  return executeSchedule(hre, fullSchedule(), { sanity: false });
}

module.exports = {
  datasetIdFor,
  experimentIdFor,
  executeOne,
  executeSchedule,
  sanitySchedule,
  fullSchedule,
  assertReadyForFullExecution,
  runSanity,
  runFull,
};
