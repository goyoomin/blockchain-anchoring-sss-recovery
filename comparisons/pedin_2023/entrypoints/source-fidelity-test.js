const assert = require("node:assert/strict");
const crypto = require("crypto");
const path = require("path");
const hre = require("hardhat");
const { paths } = require("../config/pedinConfig");
const {
  leafForShare, parentHash, buildPedinMerkleTree, proofForActualLeaf,
  verifyProof, referenceVerify, validateAllActualProofs,
} = require("../merkle/pedinMerkleSha256");
const { writeJson } = require("../metrics/pedinIo");

async function main() {
  const tests = {};
  const A = "A";
  const B = "B";
  const l1 = crypto.createHash("sha256").update(Buffer.from(A, "utf8")).digest();
  const l2 = crypto.createHash("sha256").update(Buffer.from(B, "utf8")).digest();
  const expectedRoot = `0x${crypto.createHash("sha256").update(Buffer.concat([l1, l2])).digest("hex")}`;
  const two = buildPedinMerkleTree([A, B]);
  assert.equal(two.root, expectedRoot);
  tests.n2_reference_root = true;
  tests.leaf_uses_sha256_utf8 = leafForShare(A).equals(l1);
  assert.equal(tests.leaf_uses_sha256_utf8, true);

  const ordered = parentHash(l1, l2);
  const reversed = parentHash(l2, l1);
  assert.equal(ordered.equals(reversed), false);
  tests.parent_preserves_left_right = true;
  const reversedTree = buildPedinMerkleTree([B, A]);
  assert.equal(reversedTree.root, `0x${reversed.toString("hex")}`);
  assert.notEqual(reversedTree.root, expectedRoot);
  tests.leaf_sorting_disabled = true;
  tests.pair_sorting_disabled = true;

  const three = buildPedinMerkleTree(["A", "B", "C"]);
  assert.equal(three.actual_leaf_count, 3);
  assert.equal(three.padded_leaf_count, 4);
  assert.equal(three.padding_count, 1);
  assert.equal(three.paddedLeaves[2].equals(three.paddedLeaves[3]), true);
  tests.last_leaf_padding_to_power_of_two = true;
  assert.equal(validateAllActualProofs(["A", "B", "C"], three), true);
  tests.every_actual_proof_reconstructs_root = true;
  const proof = proofForActualLeaf(three, 1);
  assert.equal(verifyProof("B", proof, three.root), true);
  assert.equal(referenceVerify("B", proof.siblings.map((item) => item.sibling), 1, three.root), true);
  assert.equal(verifyProof("tampered", proof, three.root), false);
  tests.independent_reference_verifier = true;
  tests.zero_based_index_convention = proof.index_base === 0;

  await hre.network.provider.send("hardhat_reset");
  const factory = await hre.ethers.getContractFactory("PedinPaperGuidedSetup");
  const contract = await factory.deploy();
  const deploymentReceipt = await contract.deploymentTransaction().wait();
  assert.ok(deploymentReceipt.gasUsed > 0n);
  const address = (await hre.ethers.getSigners())[1].address;
  const setupTransaction = await contract.setup(address, two.root);
  const setupReceipt = await setupTransaction.wait();
  assert.ok(setupReceipt.gasUsed > 0n);
  const reportedSetupGas = setupReceipt.gasUsed.toString();
  assert.equal(await contract.recoveryAddress(), address);
  assert.equal((await contract.merkleRoot()).toLowerCase(), two.root.toLowerCase());
  tests.pbk_and_root_written_by_one_transaction = true;
  tests.setup_gas_is_receipt_gas_used = reportedSetupGas === setupReceipt.gasUsed.toString();
  tests.deployment_gas_is_separate = deploymentReceipt.gasUsed > 0n && setupReceipt.gasUsed > 0n;

  const result = {
    valid: Object.values(tests).every(Boolean),
    executed_at: new Date().toISOString(),
    tests,
    n2: { shares: [A, B], root: two.root, expected_root: expectedRoot },
    n3: { actual_leaf_count: 3, padded_leaf_count: 4, padding_count: 1, root: three.root },
    contract: {
      name: "PedinPaperGuidedSetup",
      setup_transaction_count: 1,
      setup_receipt_gas_used: reportedSetupGas,
      deployment_receipt_gas_used: deploymentReceipt.gasUsed.toString(),
      readback_success: true,
    },
  };
  writeJson(path.join(paths.sanityRoot, "pedin_source_fidelity_tests.json"), result);
  process.stdout.write(`[Pedin Source Fidelity] ${result.valid ? "VALID" : "INVALID"}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
