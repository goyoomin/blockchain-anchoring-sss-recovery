const crypto = require("crypto");
const { nextPowerOfTwo } = require("../config/pedinConfig");

function sha256(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError("SHA-256 input must be a Buffer");
  return crypto.createHash("sha256").update(buffer).digest();
}

function leafForShare(encodedShare) {
  if (typeof encodedShare !== "string") throw new TypeError("encoded share must be a string");
  return sha256(Buffer.from(encodedShare, "utf8"));
}

function parentHash(left, right) {
  if (!Buffer.isBuffer(left) || left.length !== 32 || !Buffer.isBuffer(right) || right.length !== 32) {
    throw new TypeError("Merkle children must be raw 32-byte digests");
  }
  return sha256(Buffer.concat([left, right]));
}

function toHex(buffer) {
  return `0x${buffer.toString("hex")}`;
}

function fromHex(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new TypeError("expected a 0x-prefixed 32-byte hex digest");
  }
  return Buffer.from(value.slice(2), "hex");
}

function buildPedinMerkleTree(shares) {
  if (!Array.isArray(shares) || shares.length < 2) throw new RangeError("at least two shares are required");
  const actualLeaves = shares.map(leafForShare);
  const paddedCount = nextPowerOfTwo(actualLeaves.length);
  const paddedLeaves = actualLeaves.map((leaf) => Buffer.from(leaf));
  while (paddedLeaves.length < paddedCount) {
    paddedLeaves.push(Buffer.from(actualLeaves[actualLeaves.length - 1]));
  }
  const layers = [paddedLeaves];
  while (layers[layers.length - 1].length > 1) {
    const current = layers[layers.length - 1];
    const next = [];
    for (let index = 0; index < current.length; index += 2) {
      next.push(parentHash(current[index], current[index + 1]));
    }
    layers.push(next);
  }
  return {
    root: toHex(layers[layers.length - 1][0]),
    actual_leaf_count: actualLeaves.length,
    padded_leaf_count: paddedCount,
    padding_count: paddedCount - actualLeaves.length,
    padding_rule: "LAST_ACTUAL_LEAF_TO_NEXT_POWER_OF_TWO",
    actualLeaves,
    paddedLeaves,
    layers,
  };
}

function proofForActualLeaf(tree, actualIndex) {
  if (!Number.isInteger(actualIndex) || actualIndex < 0 || actualIndex >= tree.actual_leaf_count) {
    throw new RangeError("proof index must identify an actual, non-padding leaf");
  }
  let index = actualIndex;
  const siblings = [];
  for (let level = 0; level < tree.layers.length - 1; level += 1) {
    const siblingIndex = index ^ 1;
    siblings.push({
      sibling: toHex(tree.layers[level][siblingIndex]),
      orientation: siblingIndex < index ? "LEFT" : "RIGHT",
    });
    index = Math.floor(index / 2);
  }
  return { index_base: 0, original_share_index: actualIndex, siblings };
}

function verifyProof(encodedShare, proof, expectedRoot) {
  let current = leafForShare(encodedShare);
  let index = proof.original_share_index;
  for (const element of proof.siblings) {
    const sibling = fromHex(element.sibling);
    const expectedOrientation = index % 2 === 0 ? "RIGHT" : "LEFT";
    if (element.orientation !== expectedOrientation) return false;
    current = index % 2 === 0 ? parentHash(current, sibling) : parentHash(sibling, current);
    index = Math.floor(index / 2);
  }
  return toHex(current).toLowerCase() === expectedRoot.toLowerCase();
}

// Deliberately independent from verifyProof: it derives orientation only from the
// zero-based index and uses the Node crypto primitive directly at every step.
function referenceVerify(encodedShare, siblingHexes, zeroBasedIndex, expectedRoot) {
  let current = crypto.createHash("sha256").update(Buffer.from(encodedShare, "utf8")).digest();
  let index = zeroBasedIndex;
  for (const siblingHex of siblingHexes) {
    const sibling = fromHex(siblingHex);
    const payload = index % 2 === 0
      ? Buffer.concat([current, sibling])
      : Buffer.concat([sibling, current]);
    current = crypto.createHash("sha256").update(payload).digest();
    index = Math.floor(index / 2);
  }
  return toHex(current).toLowerCase() === expectedRoot.toLowerCase();
}

function validateAllActualProofs(shares, tree) {
  return shares.every((share, index) => {
    const proof = proofForActualLeaf(tree, index);
    return verifyProof(share, proof, tree.root) &&
      referenceVerify(share, proof.siblings.map((entry) => entry.sibling), index, tree.root);
  });
}

module.exports = {
  sha256,
  leafForShare,
  parentHash,
  toHex,
  fromHex,
  buildPedinMerkleTree,
  proofForActualLeaf,
  verifyProof,
  referenceVerify,
  validateAllActualProofs,
};
