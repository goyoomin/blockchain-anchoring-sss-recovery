const { experimentConfig, thresholdFor } = require("../config/experimentConfig");
const { freezeEnvironment } = require("./environment");

async function runAudit(hre) {
  const environment = await freezeEnvironment(hre);
  const report = {
    baseline: "GREENFIELD_V1",
    intcom_compatibility: "NOT_CLAIMED_SOURCE_CODE_WAS_UNAVAILABLE",
    threshold_policy: `${experimentConfig.thresholdPolicy}: floor(n / 2) + 1`,
    threshold_examples: Object.fromEntries(
      experimentConfig.mainNValues.map((n) => [n, thresholdFor(n)]),
    ),
    primary_gas: "sum of anchoring transaction receipt.gasUsed only",
    recovery_time:
      "dataset load through chain query, integrity/proof verification, k-share selection and SSS reconstruction",
    per_share_transactions: "one anchorShare transaction per share",
    merkle:
      "input leaf order; keccak256 UTF-8 share leaves; sorted node pairs; unpaired odd node promoted",
    environment,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report;
}

module.exports = { runAudit };
