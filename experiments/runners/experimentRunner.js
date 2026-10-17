const { experimentConfig } = require("../config/experimentConfig");
const {
  ensureDataset,
  loadDataset,
} = require("../datasets/datasetGenerator");
const { freezeEnvironment } = require("../audit/environment");
const { requireReceiptGas } = require("../metrics/gasCollector");
const {
  appendRawRow,
  appendTransactionLog,
  existingExperimentIds,
} = require("../logger/experimentLogger");
const { classifyFailure } = require("../logger/failureClassifier");
const { runPerShare } = require("./perShareRunner");
const { runMerkleRoot } = require("./merkleRootRunner");

function paddedRepetition(repetition) {
  return String(repetition).padStart(3, "0");
}

function makeDatasetId(scope, n, repetition) {
  return `${scope}_n${n}_run${paddedRepetition(repetition)}`;
}

function makeExperimentId(scope, mechanism, n, repetition, attempt) {
  return `${scope}_${mechanism}_n${n}_run${paddedRepetition(repetition)}_a${attempt}`;
}

function runnerFor(mechanism) {
  if (mechanism === "PER_SHARE" || mechanism === "PEDIN_INDIVIDUAL_HASH") {
    return runPerShare;
  }
  if (mechanism === "MERKLE_ROOT" || mechanism === "PEDIN_MERKLE_TREE") {
    return runMerkleRoot;
  }
  throw new Error(`unsupported mechanism: ${mechanism}`);
}

function failureStage(error, errorType) {
  if (error?.failureStage) return error.failureStage;
  if (errorType === "MERKLE_VERIFICATION_FAILED") return "verification";
  if (errorType === "SSS_RECOVERY_FAILED") return "recovery";
  if (["OUT_OF_GAS", "BLOCK_GAS_LIMIT", "CONTRACT_REVERT"].includes(errorType)) {
    return "anchoring";
  }
  return "unknown";
}

function blankRow({ experimentId, dataset, mechanism, repetition, attempt, environment }) {
  return {
    experiment_id: experimentId,
    dataset_id: dataset.dataset_id,
    timestamp: new Date().toISOString(),
    mechanism,
    n: dataset.n,
    k: dataset.k,
    repetition,
    attempt,
    seed: dataset.run_seed,
    success: false,
    failure_stage: null,
    error_type: null,
    error_message: null,
    transaction_count: null,
    deployment_gas: null,
    anchoring_gas: null,
    verification_gas: null,
    recovery_gas: null,
    primary_gas_used: null,
    total_transaction_gas: null,
    share_generation_time_ms: dataset.share_generation_time_ms,
    merkle_tree_generation_time_ms: null,
    share_load_time_ms: null,
    blockchain_query_time_ms: null,
    verification_time_ms: null,
    merkle_proof_time_ms: null,
    sss_reconstruction_time_ms: null,
    total_recovery_time_ms: null,
    block_gas_limit: environment.block_gas_limit,
    node_version: environment.node_version,
    hardhat_version: environment.hardhat_version,
    ethers_version: environment.ethers_version,
    solidity_version: environment.solidity_version,
  };
}

async function deployFreshContract(hre) {
  await hre.network.provider.request({ method: "hardhat_reset", params: [] });
  const factory = await hre.ethers.getContractFactory("WalletRecoveryAnchors");
  const contract = await factory.deploy();
  const deploymentTransaction = contract.deploymentTransaction();
  const deploymentReceipt = await deploymentTransaction.wait();
  await contract.waitForDeployment();
  return { contract, deploymentReceipt };
}

async function runSuite(hre, options) {
  const {
    scope,
    nValues,
    repetitions,
    mechanisms,
    rawPath,
    transactionDirectory = null,
  } = options;
  const attempt = Number.parseInt(process.env.EXPERIMENT_ATTEMPT ?? "1", 10);
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error("EXPERIMENT_ATTEMPT must be a positive integer");
  }
  const environment = await freezeEnvironment(hre);
  const existing = existingExperimentIds(rawPath);
  const total = nValues.length * repetitions * mechanisms.length;
  let position = 0;

  for (const n of nValues) {
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      const datasetId = makeDatasetId(scope, n, repetition);
      ensureDataset({
        datasetId,
        n,
        experimentSeed: process.env.EXPERIMENT_SEED ?? "greenfield-v1",
        runSeed: `${process.env.EXPERIMENT_SEED ?? "greenfield-v1"}:${datasetId}`,
      });
      const dataset = loadDataset(datasetId).dataset;

      for (const mechanism of mechanisms) {
        position += 1;
        const experimentId = makeExperimentId(scope, mechanism, n, repetition, attempt);
        if (existing.has(experimentId)) {
          process.stdout.write(`[MDPI Experiment] ${position}/${total} SKIP ${experimentId}\n`);
          continue;
        }

        const row = blankRow({
          experimentId,
          dataset,
          mechanism,
          repetition,
          attempt,
          environment,
        });
        let deploymentGas = null;
        let stage = "reset_and_deployment";
        try {
          const deployed = await deployFreshContract(hre);
          deploymentGas = requireReceiptGas(deployed.deploymentReceipt);
          row.deployment_gas = deploymentGas;
          stage = "anchoring";
          const result = await runnerFor(mechanism)({
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
          if (transactionDirectory) {
            appendTransactionLog(transactionDirectory, experimentId, result.transactionReceipts);
          }
        } catch (error) {
          const type = classifyFailure(error);
          row.success = false;
          row.failure_stage = stage === "anchoring" ? failureStage(error, type) : stage;
          row.error_type = type;
          row.error_message = String(error?.message ?? error).replace(/[\r\n]+/g, " ");
          if (error?.partial) {
            Object.assign(row, error.partial);
            if (deploymentGas !== null && row.anchoring_gas !== null) {
              row.total_transaction_gas = deploymentGas + BigInt(row.anchoring_gas);
            }
          }
          if (transactionDirectory && error?.transactionReceipts?.length) {
            appendTransactionLog(transactionDirectory, experimentId, error.transactionReceipts);
          }
        }

        // Logging and progress output deliberately occur after all recovery timers end.
        appendRawRow(rawPath, row);
        existing.add(experimentId);
        process.stdout.write(
          `[MDPI Experiment] ${position}/${total} ${mechanism} n=${n} ` +
          `run=${repetition}/${repetitions} dataset=${datasetId} ` +
          `status=${row.success ? "SUCCESS" : "FAILED"} ` +
          `gas=${row.primary_gas_used ?? "NA"} ` +
          `recovery_ms=${row.total_recovery_time_ms ?? "NA"}\n`,
        );
      }
    }
  }
}

module.exports = {
  runSuite,
  makeDatasetId,
  makeExperimentId,
  deployFreshContract,
  runnerFor,
};
