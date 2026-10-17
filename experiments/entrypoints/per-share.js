const hre = require("hardhat");
const { experimentConfig } = require("../config/experimentConfig");
const { runSuite } = require("../runners/experimentRunner");
const { execute } = require("./_run");

execute(() => runSuite(hre, {
  scope: "main",
  nValues: experimentConfig.mainNValues,
  repetitions: experimentConfig.repetitions,
  mechanisms: ["PER_SHARE"],
  rawPath: experimentConfig.paths.mainRaw,
  transactionDirectory: experimentConfig.paths.mainTransactions,
}));
