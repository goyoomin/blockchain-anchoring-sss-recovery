// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal anchoring contract used by both mechanisms. The contract is
/// intentionally not gas-optimized so the frozen baseline remains transparent.
contract WalletRecoveryAnchors {
    mapping(bytes32 datasetKey => mapping(uint256 shareIndex => bytes32 shareHash))
        private shareAnchors;
    mapping(bytes32 datasetKey => bytes32 merkleRoot) private merkleRoots;

    event ShareAnchored(bytes32 indexed datasetKey, uint256 indexed shareIndex, bytes32 shareHash);
    event MerkleRootAnchored(bytes32 indexed datasetKey, bytes32 merkleRoot);

    function anchorShare(bytes32 datasetKey, uint256 shareIndex, bytes32 shareHash) external {
        require(shareHash != bytes32(0), "empty share hash");
        require(shareAnchors[datasetKey][shareIndex] == bytes32(0), "share already anchored");
        shareAnchors[datasetKey][shareIndex] = shareHash;
        emit ShareAnchored(datasetKey, shareIndex, shareHash);
    }

    function anchorMerkleRoot(bytes32 datasetKey, bytes32 merkleRoot) external {
        require(merkleRoot != bytes32(0), "empty Merkle root");
        require(merkleRoots[datasetKey] == bytes32(0), "root already anchored");
        merkleRoots[datasetKey] = merkleRoot;
        emit MerkleRootAnchored(datasetKey, merkleRoot);
    }

    function getShareAnchor(bytes32 datasetKey, uint256 shareIndex) external view returns (bytes32) {
        return shareAnchors[datasetKey][shareIndex];
    }

    function getMerkleRoot(bytes32 datasetKey) external view returns (bytes32) {
        return merkleRoots[datasetKey];
    }

    /// @dev Pair sorting must match experiments/metrics/merkle.js.
    function verifyMerkleProof(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) external pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 sibling = proof[i];
            computed = computed <= sibling
                ? keccak256(abi.encodePacked(computed, sibling))
                : keccak256(abi.encodePacked(sibling, computed));
        }
        return computed == root;
    }
}
