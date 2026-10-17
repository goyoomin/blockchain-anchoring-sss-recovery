const { loadDataset, reconstruct } = require("../datasets/datasetGenerator");
const { collectTransaction, sumGas } = require("../metrics/gasCollector");
const { datasetKey, hashShare } = require("../metrics/hash");
const { elapsedMs, measureAsync, measureSync, nowNs } = require("../metrics/timer");
const { experimentError } = require("../logger/failureClassifier");

async function runPerShare({ contract, datasetId }) {
  let stage = "dataset_load_for_anchoring";
  const receipts = [];
  try {
    const anchoringDataset = loadDataset(datasetId).dataset;
    const key = datasetKey(datasetId);
    const shareHashes = anchoringDataset.shares.map(hashShare);

    stage = "anchoring";
    for (let index = 0; index < shareHashes.length; index += 1) {
      const receipt = await collectTransaction(
        contract.anchorShare(key, index, shareHashes[index]),
      );
      receipts.push({ ...receipt, operation: "anchorShare", shareIndex: index });
    }

    stage = "recovery";
    const recoveryStart = nowNs();
    const loaded = loadDataset(datasetId);

  const query = await measureAsync(async () => {
    const anchors = [];
    for (let index = 0; index < loaded.dataset.n; index += 1) {
      anchors.push(await contract.getShareAnchor(key, index));
    }
    return anchors;
  });

  const verification = measureSync(() => {
    const valid = [];
    for (let index = 0; index < loaded.dataset.shares.length; index += 1) {
      if (hashShare(loaded.dataset.shares[index]) === query.value[index]) {
        valid.push(loaded.dataset.shares[index]);
      }
    }
    return valid;
  });
  if (verification.value.length < loaded.dataset.k) {
    throw experimentError("SSS_RECOVERY_FAILED", "fewer than k valid per-share anchors");
  }

  const reconstruction = measureSync(() =>
    reconstruct(verification.value.slice(0, loaded.dataset.k)));
  if (reconstruction.value !== loaded.dataset.secret) {
    throw experimentError("SSS_RECOVERY_FAILED", "reconstructed secret does not match");
  }

    return {
      stage,
      transactionCount: receipts.length,
      anchoringGas: sumGas(receipts),
      transactionReceipts: receipts,
      merkleTreeGenerationTimeMs: null,
      shareLoadTimeMs: loaded.shareLoadTimeMs,
      blockchainQueryTimeMs: query.elapsedMs,
      verificationTimeMs: verification.elapsedMs,
      merkleProofTimeMs: null,
      sssReconstructionTimeMs: reconstruction.elapsedMs,
      totalRecoveryTimeMs: elapsedMs(recoveryStart),
    };
  } catch (error) {
    error.failureStage = stage;
    const anchoringGas = sumGas(receipts);
    error.partial = {
      transaction_count: receipts.length,
      anchoring_gas: anchoringGas,
      primary_gas_used: anchoringGas,
    };
    error.transactionReceipts = receipts;
    throw error;
  }
}

module.exports = { runPerShare };
