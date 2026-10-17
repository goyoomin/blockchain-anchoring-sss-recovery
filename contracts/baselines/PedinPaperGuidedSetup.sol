// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

/// @notice Paper-guided minimal setup state transition based on Pedin et al.
/// @dev This is not the authors' original contract or an exact reproduction.
contract PedinPaperGuidedSetup {
    address public recoveryAddress;
    bytes32 public merkleRoot;

    function setup(address recoveryAddress_, bytes32 merkleRoot_) external {
        recoveryAddress = recoveryAddress_;
        merkleRoot = merkleRoot_;
    }
}
