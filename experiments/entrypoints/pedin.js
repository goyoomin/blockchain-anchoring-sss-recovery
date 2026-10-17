const hre = require("hardhat");
const { experimentConfig } = require("../config/experimentConfig");
const { runSuite } = require("../runners/experimentRunner");
const { execute } = require("./_run");

execute(() => runSuite(hre, {
  scope: "pedin",
  nValues: experimentConfig.pedinNValues,
  repetitions: experimentConfig.pedinRepetitions,
  mechanisms: experimentConfig.pedinMechanisms,
  rawPath: experimentConfig.paths.pedinRaw,
  transactionDirectory: null,
}));
