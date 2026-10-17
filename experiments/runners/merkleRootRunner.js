const { loadDataset, reconstruct } = require("../datasets/datasetGenerator");
const { collectTransaction } = require("../metrics/gasCollector");
const { datasetKey } = require("../metrics/hash");
const { buildMerkleTree, proofFor } = require("../metrics/merkle");
const { elapsedMs, measureAsync, measureSync, nowNs } = require("../metrics/timer");
const { experimentError } = require("../logger/failureClassifier");

async function runMerkleRoot({ contract, datasetId }) {
  let stage = "dataset_load_for_anchoring";
  let rootReceipt = null;
  try {
    const anchoringDataset = loadDataset(datasetId).dataset;
    const treeBuild = measureSync(() => buildMerkleTree(anchoringDataset.shares));
    const key = datasetKey(datasetId);

    stage = "anchoring";
    rootReceipt = await collectTransaction(
      contract.anchorMerkleRoot(key, treeBuild.value.root),
    );

  stage = "recovery";
  const recoveryStart = nowNs();
  const loaded = loadDataset(datasetId);
  const query = await measureAsync(() => contract.getMerkleRoot(key));

  const proofGeneration = measureSync(() => {
    const proofs = [];
    for (let index = 0; index < loaded.dataset.k; index += 1) {
      proofs.push(proofFor(treeBuild.value.tree, treeBuild.value.leafHashes[index], index));
    }
    return proofs;
  });

  const verification = await measureAsync(async () => {
    const validShares = [];
    for (let index = 0; index < loaded.dataset.k; index += 1) {
      const valid = await contract.verifyMerkleProof(
        proofGeneration.value[index],
        query.value,
        treeBuild.value.leafHashes[index],
      );
      if (valid) validShares.push(loaded.dataset.shares[index]);
    }
    return validShares;
  });
  if (verification.value.length < loaded.dataset.k) {
    throw experimentError("MERKLE_VERIFICATION_FAILED", "fewer than k valid Merkle proofs");
  }

  const reconstruction = measureSync(() => reconstruct(verification.value));
  if (reconstruction.value !== loaded.dataset.secret) {
    throw experimentError("SSS_RECOVERY_FAILED", "reconstructed secret does not match");
  }

    return {
      stage,
      transactionCount: 1,
      anchoringGas: rootReceipt.gasUsed,
      transactionReceipts: [{ ...rootReceipt, operation: "anchorMerkleRoot" }],
      merkleTreeGenerationTimeMs: treeBuild.elapsedMs,
      shareLoadTimeMs: loaded.shareLoadTimeMs,
      blockchainQueryTimeMs: query.elapsedMs,
      verificationTimeMs: verification.elapsedMs,
      merkleProofTimeMs: proofGeneration.elapsedMs,
      sssReconstructionTimeMs: reconstruction.elapsedMs,
      totalRecoveryTimeMs: elapsedMs(recoveryStart),
    };
  } catch (error) {
    error.failureStage = stage;
    const anchoringGas = rootReceipt ? rootReceipt.gasUsed : 0n;
    error.partial = {
      transaction_count: rootReceipt ? 1 : 0,
      anchoring_gas: anchoringGas,
      primary_gas_used: anchoringGas,
    };
    error.transactionReceipts = rootReceipt
      ? [{ ...rootReceipt, operation: "anchorMerkleRoot" }]
      : [];
    throw error;
  }
}

module.exports = { runMerkleRoot };
