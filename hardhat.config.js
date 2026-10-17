require("@nomicfoundation/hardhat-ethers");

const { subtask } = require("hardhat/config");
const {
  TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD,
} = require("hardhat/builtin-tasks/task-names");

const SOLIDITY_VERSION = "0.8.24";
const BLOCK_GAS_LIMIT = 30_000_000;

// Use the pinned local solc-js package so compilation does not silently change
// when the remote compiler registry changes.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(
  async ({ solcVersion }, _hre, runSuper) => {
    if (solcVersion !== SOLIDITY_VERSION) {
      return runSuper();
    }
    return {
      compilerPath: require.resolve("solc/soljson.js"),
      isSolcJs: true,
      version: SOLIDITY_VERSION,
      longVersion: require("solc").version(),
    };
  },
);

module.exports = {
  solidity: {
    version: SOLIDITY_VERSION,
    settings: {
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      blockGasLimit: BLOCK_GAS_LIMIT,
    },
  },
  mocha: {
    timeout: 120_000,
  },
};
