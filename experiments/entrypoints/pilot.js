const hre = require("hardhat");
const { experimentConfig } = require("../config/experimentConfig");
const { runSuite } = require("../runners/experimentRunner");
const { execute } = require("./_run");

execute(() => runSuite(hre, {
  scope: "pilot",
  nValues: experimentConfig.pilotNValues,
  repetitions: experimentConfig.pilotRepetitions,
  mechanisms: experimentConfig.mechanisms,
  rawPath: experimentConfig.paths.pilotRaw,
  transactionDirectory: null,
}));
