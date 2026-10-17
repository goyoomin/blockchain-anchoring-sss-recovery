const { keccak256, toUtf8Bytes } = require("ethers");

function hashShare(share) {
  if (typeof share !== "string" || share.length === 0) {
    throw new TypeError("share must be a non-empty encoded string");
  }
  return keccak256(toUtf8Bytes(share));
}

function datasetKey(datasetId) {
  return keccak256(toUtf8Bytes(datasetId));
}

module.exports = { hashShare, datasetKey };
