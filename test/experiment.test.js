const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ethers } = require("hardhat");
const {
  generateDataset,
  reconstruct,
  saveDataset,
  loadDataset,
  datasetPath,
} = require("../experiments/datasets/datasetGenerator");
const { hashShare, datasetKey } = require("../experiments/metrics/hash");
const { buildMerkleTree, proofFor, verifyProof } = require("../experiments/metrics/merkle");
const { requireReceiptGas } = require("../experiments/metrics/gasCollector");
const {
  RAW_COLUMNS,
  appendRawRow,
  readCsvObjects,
  existingExperimentIds,
} = require("../experiments/logger/experimentLogger");
const { classifyFailure, experimentError } = require("../experiments/logger/failureClassifier");
const { scheduleFor, buildSchedule } = require("../experiments/recoveryValidation/schedule");
const { RECOVERY_COLUMNS, appendRecoveryRow } = require("../experiments/recoveryValidation/logger");
const { validateRecoveryRows } = require("../experiments/recoveryValidation/validate");
const {
  pairedT,
  wilcoxon,
  recoverySummary,
  pairedAnalysis,
  orderEffect,
  mainComparison,
} = require("../experiments/recoveryValidation/analyze");
const { experimentConfig } = require("../experiments/config/experimentConfig");

describe("greenfield experiment baseline", function () {
  it("splits into n shares and reconstructs the secret from k shares", function () {
    const dataset = generateDataset({ datasetId: "test_sss", n: 5 });
    assert.equal(dataset.shares.length, 5);
    assert.equal(dataset.k, 3);
    assert.equal(reconstruct(dataset.shares.slice(0, dataset.k)), dataset.secret);
  });

  it("supports n=1000 with an adequate Galois field", function () {
    const dataset = generateDataset({ datasetId: "test_sss_1000", n: 1000 });
    assert.equal(dataset.shares.length, 1000);
    assert.equal(dataset.sss_field_bits, 10);
    assert.equal(reconstruct(dataset.shares.slice(0, dataset.k)), dataset.secret);
  });

  it("verifies a per-share hash and rejects a tampered share", function () {
    const dataset = generateDataset({ datasetId: "test_hash", n: 5 });
    const anchor = hashShare(dataset.shares[0]);
    assert.equal(hashShare(dataset.shares[0]), anchor);
    assert.notEqual(hashShare(`${dataset.shares[0]}00`), anchor);
  });

  it("generates and verifies Merkle proofs and rejects tampering", function () {
    const dataset = generateDataset({ datasetId: "test_merkle", n: 5 });
    const built = buildMerkleTree(dataset.shares);
    for (let index = 0; index < dataset.n; index += 1) {
      const currentProof = proofFor(built.tree, built.leafHashes[index], index);
      assert.equal(
        verifyProof(built.tree, currentProof, built.leafHashes[index], built.root),
        true,
      );
    }
    const proof = proofFor(built.tree, built.leafHashes[2], 2);
    assert.equal(verifyProof(built.tree, proof, hashShare("tampered"), built.root), false);
  });

  it("anchors shares and a Merkle root and reads gas from receipts", async function () {
    const factory = await ethers.getContractFactory("WalletRecoveryAnchors");
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    const dataset = generateDataset({ datasetId: "test_contract", n: 5 });
    const key = datasetKey(dataset.dataset_id);
    const leaf = hashShare(dataset.shares[0]);
    const shareReceipt = await (await contract.anchorShare(key, 0, leaf)).wait();
    assert.ok(requireReceiptGas(shareReceipt) > 0n);
    assert.equal(await contract.getShareAnchor(key, 0), leaf);

    const built = buildMerkleTree(dataset.shares);
    const rootReceipt = await (await contract.anchorMerkleRoot(key, built.root)).wait();
    assert.ok(requireReceiptGas(rootReceipt) > 0n);
    const proof = proofFor(built.tree, built.leafHashes[0], 0);
    assert.equal(await contract.verifyMerkleProof(proof, built.root, built.leafHashes[0]), true);
  });

  it("persists one dataset for paired mechanisms", function () {
    const id = `test_pair_${process.pid}_${Date.now()}`;
    const target = datasetPath(id);
    try {
      const generated = generateDataset({ datasetId: id, n: 5 });
      saveDataset(generated);
      const first = loadDataset(id).dataset;
      const second = loadDataset(id).dataset;
      assert.equal(first.dataset_digest_sha256, second.dataset_digest_sha256);
      assert.deepEqual(first.shares, second.shares);
    } finally {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
  });

  it("writes schema-stable CSV and supports resume discovery", function () {
    const directory = fs.mkdtempSync(path.join(process.cwd(), "results", "test-logger-"));
    const target = path.join(directory, "raw.csv");
    try {
      appendRawRow(target, {
        experiment_id: "main_PER_SHARE_n5_run001_a1",
        dataset_id: "main_n5_run001",
        success: true,
        error_message: 'quoted, "message"',
      });
      const rows = readCsvObjects(target);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].error_message, 'quoted, "message"');
      assert.deepEqual(Object.keys(rows[0]), [...RAW_COLUMNS]);
      assert.equal(existingExperimentIds(target).has("main_PER_SHARE_n5_run001_a1"), true);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("classifies and preserves explicit experiment failure types", function () {
    assert.equal(
      classifyFailure(experimentError("MERKLE_VERIFICATION_FAILED", "bad proof")),
      "MERKLE_VERIFICATION_FAILED",
    );
    assert.equal(classifyFailure(new Error("transaction ran out of gas")), "OUT_OF_GAS");
    assert.equal(classifyFailure(new Error("unrecognized failure")), "UNKNOWN");
  });

  it("builds an exact deterministic counterbalanced recovery schedule", function () {
    assert.deepEqual(scheduleFor(1), {
      sequence: "PER_SHARE_FIRST",
      mechanisms: ["PER_SHARE", "MERKLE_ROOT"],
    });
    assert.deepEqual(scheduleFor(2), {
      sequence: "MERKLE_ROOT_FIRST",
      mechanisms: ["MERKLE_ROOT", "PER_SHARE"],
    });
    const schedule = buildSchedule({ nValues: [5], repetitions: 30 });
    assert.equal(schedule.length, 60);
    for (const mechanism of ["PER_SHARE", "MERKLE_ROOT"]) {
      assert.equal(schedule.filter((row) => row.mechanism === mechanism && row.position === "FIRST").length, 15);
      assert.equal(schedule.filter((row) => row.mechanism === mechanism && row.position === "SECOND").length, 15);
    }
  });

  it("computes paired sensitivity diagnostics without removing observations", function () {
    const values = [1, 2, 3, 4, 5];
    const t = pairedT(values);
    const w = wilcoxon(values);
    assert.equal(t.degrees_freedom, 4);
    assert.ok(t.statistic > 0);
    assert.ok(t.p_value >= 0 && t.p_value <= 1);
    assert.equal(w.count, values.length);
    assert.ok(w.p_value >= 0 && w.p_value <= 1);
  });

  it("validates the complete 420-row counterbalanced design against Main datasets", function () {
    const directory = fs.mkdtempSync(path.join(process.cwd(), "results", "test-recovery-"));
    const target = path.join(directory, "raw.csv");
    try {
      const mainRows = readCsvObjects(experimentConfig.paths.mainRaw);
      const counterbalanced = mainRows.map((row) => {
        const repetition = Number(row.repetition);
        const schedule = scheduleFor(repetition);
        const dataset = loadDataset(row.dataset_id).dataset;
        const position = schedule.mechanisms[0] === row.mechanism ? "FIRST" : "SECOND";
        return {
          ...row,
          dataset_digest_sha256: dataset.dataset_digest_sha256,
          execution_order: position === "FIRST" ? 1 : 2,
          sequence: schedule.sequence,
          position,
        };
      });
      counterbalanced.forEach((row) => appendRecoveryRow(target, row));
      assert.deepEqual(Object.keys(readCsvObjects(target)[0]), [...RECOVERY_COLUMNS]);
      const validation = validateRecoveryRows(target);
      assert.equal(validation.actual_rows, 420);
      assert.equal(validation.actual_unique_datasets, 210);
      assert.equal(recoverySummary(counterbalanced).length, 14);
      assert.equal(pairedAnalysis(counterbalanced).length, 7);
      assert.equal(orderEffect(counterbalanced).length, 21);
      assert.equal(mainComparison(mainRows, counterbalanced).length, 14);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
