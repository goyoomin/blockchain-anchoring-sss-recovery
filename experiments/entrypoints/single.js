const path = require("path");
const hre = require("hardhat");
const { experimentConfig } = require("../config/experimentConfig");
const { runSuite } = require("../runners/experimentRunner");
const { execute } = require("./_run");

const n = Number.parseInt(process.env.EXPERIMENT_N ?? "5", 10);
const requestedMechanism = process.env.EXPERIMENT_MECHANISM;
const mechanisms = requestedMechanism
  ? [requestedMechanism]
  : experimentConfig.mechanisms;

execute(() => runSuite(hre, {
  scope: `single${n}`,
  nValues: [n],
  repetitions: 1,
  mechanisms,
  rawPath: path.join(experimentConfig.paths.root, "results", "pilot", "single_raw.csv"),
  transactionDirectory: null,
}));
