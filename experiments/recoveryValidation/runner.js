const path = require("path");
const { experimentConfig } = require("../config/experimentConfig");
const fs = require("fs");
const { loadDataset, datasetPath } = require("../datasets/datasetGenerator");
const { classifyFailure } = require("../logger/failureClassifier");
const {
  deployFreshContract,
  makeDatasetId,
  runnerFor,
} = require("../runners/experimentRunner");
const { requireReceiptGas } = require("../metrics/gasCollector");
const { buildSchedule } = require("./schedule");
const { appendRecoveryRow, completedKeys } = require("./logger");

function experimentId(n, repetition, mechanism) {
  return `recovery_validation_${mechanism}_n${n}_run${String(repetition).padStart(3, "0")}`;
}

function failureStage(error, fallback) {
  return error?.failureStage ?? fallback;
}

function baseRow({ dataset, environment, item }) {
  return {
    experiment_id: experimentId(item.n, item.repetition, item.mechanism),
    dataset_id: dataset.dataset_id,
    dataset_digest_sha256: dataset.dataset_digest_sha256,
    timestamp: new Date().toISOString(),
    n: dataset.n,
    k: dataset.k,
    repetition: item.repetition,
    mechanism: item.mechanism,
    execution_order: item.position === "FIRST" ? 1 : 2,
    sequence: item.sequence,
    position: item.position,
    success: false,
    share_generation_time_ms: dataset.share_generation_time_ms,
    block_gas_limit: environment.block_gas_limit,
    node_version: environment.node_version,
    hardhat_version: environment.hardhat_version,
    ethers_version: environment.ethers_version,
    solidity_version: environment.solidity_version,
  };
}

async function executeMechanism(hre, datasetId, mechanism) {
  const deployed = await deployFreshContract(hre);
  const deploymentGas = requireReceiptGas(deployed.deploymentReceipt);
  const result = await runnerFor(mechanism)({ contract: deployed.contract, datasetId });
  return { deploymentGas, result };
}

async function warmUp(hre, n) {
  const datasetId = makeDatasetId("main", n, 1);
  for (const mechanism of experimentConfig.mechanisms) {
    const completed = await executeMechanism(hre, datasetId, mechanism);
    if (!Number.isFinite(completed.result.totalRecoveryTimeMs)) {
      throw new Error(`warm-up failed for ${mechanism} n=${n}`);
    }
  }
  process.stdout.write(`[Recovery Validation] warm-up complete n=${n} (not recorded)\n`);
}

async function runRecoverySchedule(hre, {
  environment,
  rawPath = experimentConfig.paths.recoveryValidationRaw,
  nValues = experimentConfig.mainNValues,
  repetitions = experimentConfig.repetitions,
  useWarmUp = true,
} = {}) {
  if (!environment) throw new Error("recovery environment snapshot is required");
  const schedule = buildSchedule({ nValues, repetitions });
  const requiredDatasetIds = [...new Set(schedule.map(
    (item) => makeDatasetId("main", item.n, item.repetition),
  ))];
  const missingDatasets = requiredDatasetIds.filter(
    (datasetId) => !fs.existsSync(datasetPath(datasetId)),
  );
  if (missingDatasets.length) {
    throw new Error(`immutable Main datasets are missing: ${missingDatasets.join(", ")}`);
  }
  const existing = completedKeys(rawPath);
  let processed = 0;
  let currentN = null;
  for (const item of schedule) {
    if (item.n !== currentN) {
      currentN = item.n;
      if (useWarmUp) await warmUp(hre, item.n);
    }
    const datasetId = makeDatasetId("main", item.n, item.repetition);
    const key = `${datasetId}\u0000${item.mechanism}`;
    processed += 1;
    if (existing.has(key)) {
      process.stdout.write(`[Recovery Validation] progress=${processed}/${schedule.length} SKIP ${datasetId} ${item.mechanism}\n`);
      continue;
    }
    const dataset = loadDataset(datasetId).dataset;
    const row = baseRow({ dataset, environment, item });
    let stage = "reset_and_deployment";
    try {
      const deployed = await deployFreshContract(hre);
      const deploymentGas = requireReceiptGas(deployed.deploymentReceipt);
      row.deployment_gas = deploymentGas;
      stage = "anchoring_and_recovery";
      const result = await runnerFor(item.mechanism)({
        contract: deployed.contract,
        datasetId,
      });
      row.success = true;
      row.transaction_count = result.transactionCount;
      row.anchoring_gas = result.anchoringGas;
      row.primary_gas_used = result.anchoringGas;
      row.total_transaction_gas = deploymentGas + result.anchoringGas;
      row.merkle_tree_generation_time_ms = result.merkleTreeGenerationTimeMs;
      row.share_load_time_ms = result.shareLoadTimeMs;
      row.blockchain_query_time_ms = result.blockchainQueryTimeMs;
      row.verification_time_ms = result.verificationTimeMs;
      row.merkle_proof_time_ms = result.merkleProofTimeMs;
      row.sss_reconstruction_time_ms = result.sssReconstructionTimeMs;
      row.total_recovery_time_ms = result.totalRecoveryTimeMs;
    } catch (error) {
      row.success = false;
      row.failure_stage = failureStage(error, stage);
      row.error_type = classifyFailure(error);
      row.error_message = String(error?.message ?? error).replace(/[\r\n]+/g, " ");
      if (error?.partial) Object.assign(row, error.partial);
    }
    // CSV and console I/O occur only after the runner's recovery timer has ended.
    appendRecoveryRow(rawPath, row);
    existing.add(key);
    process.stdout.write(
      `[Recovery Validation]\nn=${item.n}\nrun=${item.repetition}/${repetitions}\n` +
      `dataset=${datasetId}\nsequence=${item.sequence}\n\n` +
      `${row.execution_order}/2 ${item.mechanism}\nposition=${item.position}\n` +
      `recovery_ms=${row.total_recovery_time_ms ?? "NA"}\n\n` +
      `progress=${processed}/${schedule.length}\n`,
    );
  }
  return { rawPath: path.resolve(rawPath), scheduled: schedule.length };
}

module.exports = { experimentId, executeMechanism, runRecoverySchedule };
