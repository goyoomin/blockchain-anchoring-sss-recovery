const { getBytes, hexlify, keccak256 } = require("ethers");
const { MerkleTree } = require("merkletreejs");
const { hashShare } = require("./hash");

function keccakBuffer(value) {
  return Buffer.from(getBytes(keccak256(value)));
}

function buildMerkleTree(shares) {
  if (!Array.isArray(shares) || shares.length === 0) {
    throw new TypeError("shares must be a non-empty array");
  }
  const leafHashes = shares.map(hashShare);
  const leaves = leafHashes.map((leaf) => Buffer.from(getBytes(leaf)));
  const tree = new MerkleTree(leaves, keccakBuffer, {
    sortLeaves: false,
    sortPairs: true,
    duplicateOdd: false,
  });
  return {
    tree,
    leafHashes,
    root: hexlify(tree.getRoot()),
  };
}

function proofFor(tree, leafHash, index) {
  const leaf = Buffer.from(getBytes(leafHash));
  return tree.getProof(leaf, index).map(({ data }) => hexlify(data));
}

function verifyProof(tree, proof, leafHash, root) {
  return tree.verify(
    proof.map((item) => Buffer.from(getBytes(item))),
    Buffer.from(getBytes(leafHash)),
    Buffer.from(getBytes(root)),
  );
}

module.exports = { buildMerkleTree, proofFor, verifyProof, keccakBuffer };
