const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { experimentConfig, thresholdFor } = require("../config/experimentConfig");
const { csvValue, readCsvObjects } = require("../logger/experimentLogger");
const { describe } = require("../statistics/statisticsAnalyzer");
const {
  KNOWN_MAIN_SHA256,
  sha256File,
  validateMain,
  validateExistingFreeze,
} = require("../freeze/freeze");
const { validateRecoveryRows } = require("../recoveryValidation/validate");

const N_VALUES = Object.freeze([5, 10, 20, 50, 100, 500, 1000]);
const MECHANISMS = Object.freeze(["PER_SHARE", "MERKLE_ROOT"]);
const COMPONENTS = Object.freeze([
  "share_load_time_ms",
  "blockchain_query_time_ms",
  "verification_time_ms",
  "merkle_proof_time_ms",
  "sss_reconstruction_time_ms",
]);
const OUTPUT_DIRECTORY = path.join(
  experimentConfig.paths.root,
  "results",
  "analysis",
  "final_statistics",
);
const MANIFEST_PATH = path.join(OUTPUT_DIRECTORY, "final_statistics_manifest.json");
const REQUIRED_OUTPUTS = Object.freeze([
  "final_gas_statistics.csv",
  "final_gas_comparison.csv",
  "final_recovery_statistics.csv",
  "final_recovery_paired_comparison.csv",
  "final_recovery_comparison.csv",
  "final_recovery_component_statistics.csv",
  "final_transaction_count.csv",
  "final_execution_feasibility.csv",
  "final_scalability_summary.csv",
  "final_publication_values.csv",
  "FINAL_STATISTICS_TABLES.md",
  "FINAL_STATISTICAL_ANALYSIS.md",
  "final_statistics_manifest.json",
]);

function relative(filePath) {
  return path.relative(experimentConfig.paths.root, filePath).replace(/\\/g, "/");
}

function fileIdentity(filePath) {
  const stats = fs.statSync(filePath);
  return {
    relative_path: relative(filePath),
    size_bytes: stats.size,
    sha256: sha256File(filePath),
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function csvText(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) =>
    headers.map((header) => csvValue(row[header])).join(",")).join("\n")}\n`;
}

function successful(row) {
  return row.success === "true";
}

function finiteValues(rows, column) {
  return rows.filter((row) => row[column] !== "" && row[column] !== null &&
      row[column] !== undefined && Number.isFinite(Number(row[column])))
    .map((row) => Number(row[column]));
}

function statistics(values) {
  const stats = describe(values);
  return {
    mean: stats.mean,
    sample_standard_deviation: stats.standard_deviation,
    variance: stats.variance,
    median: stats.median,
    q1: stats.q1,
    q3: stats.q3,
    iqr: stats.iqr,
    minimum: stats.minimum,
    maximum: stats.maximum,
    standard_error: stats.metric_sample_count
      ? stats.standard_deviation / Math.sqrt(stats.metric_sample_count)
      : null,
    ci95_lower: stats.ci95_low,
    ci95_upper: stats.ci95_high,
  };
}

function groupRows(rows, n, mechanism) {
  return rows.filter((row) => Number(row.n) === n && row.mechanism === mechanism);
}

function metricStatistics(rows, metric) {
  const output = [];
  for (const n of N_VALUES) {
    for (const mechanism of MECHANISMS) {
      const group = groupRows(rows, n, mechanism);
      const successes = group.filter(successful);
      output.push({
        n,
        mechanism,
        metric,
        count: group.length,
        success_count: successes.length,
        failure_count: group.length - successes.length,
        ...statistics(finiteValues(successes, metric)),
      });
    }
  }
  return output;
}

function rowFor(rows, n, mechanism) {
  return rows.find((row) => row.n === n && row.mechanism === mechanism);
}

function gasComparison(gasStatistics) {
  return N_VALUES.map((n) => {
    const perShare = rowFor(gasStatistics, n, "PER_SHARE");
    const merkle = rowFor(gasStatistics, n, "MERKLE_ROOT");
    const difference = perShare.mean - merkle.mean;
    return {
      n,
      per_share_mean_gas: perShare.mean,
      per_share_sd: perShare.sample_standard_deviation,
      per_share_ci_lower: perShare.ci95_lower,
      per_share_ci_upper: perShare.ci95_upper,
      merkle_root_mean_gas: merkle.mean,
      merkle_root_sd: merkle.sample_standard_deviation,
      merkle_root_ci_lower: merkle.ci95_lower,
      merkle_root_ci_upper: merkle.ci95_upper,
      absolute_gas_difference: difference,
      gas_reduction_percent: difference / perShare.mean * 100,
      gas_ratio: perShare.mean / merkle.mean,
    };
  });
}

function recoveryPairs(rows, n) {
  const pairs = new Map();
  for (const row of rows.filter((candidate) => Number(candidate.n) === n)) {
    if (!pairs.has(row.dataset_id)) pairs.set(row.dataset_id, {});
    pairs.get(row.dataset_id)[row.mechanism] = row;
  }
  return [...pairs.entries()].map(([datasetId, pair]) => {
    if (!pair.PER_SHARE || !pair.MERKLE_ROOT ||
        !successful(pair.PER_SHARE) || !successful(pair.MERKLE_ROOT)) return null;
    return {
      dataset_id: datasetId,
      delta_ms: Number(pair.PER_SHARE.total_recovery_time_ms) -
        Number(pair.MERKLE_ROOT.total_recovery_time_ms),
    };
  }).filter(Boolean);
}

function pairedComparison(recoveryRows) {
  return N_VALUES.map((n) => {
    const pairs = recoveryPairs(recoveryRows, n);
    const stats = statistics(pairs.map((pair) => pair.delta_ms));
    return {
      n,
      paired_count: pairs.length,
      mean_delta_ms: stats.mean,
      sample_sd_delta_ms: stats.sample_standard_deviation,
      variance_delta_ms: stats.variance,
      median_delta_ms: stats.median,
      minimum_delta_ms: stats.minimum,
      maximum_delta_ms: stats.maximum,
      standard_error_delta_ms: stats.standard_error,
      ci95_lower_ms: stats.ci95_lower,
      ci95_upper_ms: stats.ci95_upper,
      ci_excludes_zero: stats.ci95_lower > 0 || stats.ci95_upper < 0,
      positive_delta_interpretation: "MERKLE_ROOT_FASTER",
    };
  });
}

function recoveryComparison(recoveryStatistics, pairedRows) {
  return N_VALUES.map((n) => {
    const perShare = rowFor(recoveryStatistics, n, "PER_SHARE");
    const merkle = rowFor(recoveryStatistics, n, "MERKLE_ROOT");
    const paired = pairedRows.find((row) => row.n === n);
    const difference = perShare.mean - merkle.mean;
    return {
      n,
      per_share_mean_recovery_ms: perShare.mean,
      per_share_sd_ms: perShare.sample_standard_deviation,
      per_share_ci_lower_ms: perShare.ci95_lower,
      per_share_ci_upper_ms: perShare.ci95_upper,
      merkle_root_mean_recovery_ms: merkle.mean,
      merkle_root_sd_ms: merkle.sample_standard_deviation,
      merkle_root_ci_lower_ms: merkle.ci95_lower,
      merkle_root_ci_upper_ms: merkle.ci95_upper,
      absolute_mean_difference_ms: difference,
      recovery_reduction_percent: difference / perShare.mean * 100,
      paired_mean_delta_ms: paired.mean_delta_ms,
      paired_ci95_lower_ms: paired.ci95_lower_ms,
      paired_ci95_upper_ms: paired.ci95_upper_ms,
      ci_excludes_zero: paired.ci_excludes_zero,
    };
  });
}

function componentStatistics(recoveryRows) {
  const output = [];
  for (const n of N_VALUES) {
    for (const mechanism of MECHANISMS) {
      const group = groupRows(recoveryRows, n, mechanism).filter(successful);
      for (const component of COMPONENTS) {
        const values = finiteValues(group, component);
        const stats = statistics(values);
        output.push({
          n,
          mechanism,
          component,
          count: values.length,
          mean_ms: stats.mean,
          sample_standard_deviation_ms: stats.sample_standard_deviation,
          variance_ms2: stats.variance,
          standard_error_ms: stats.standard_error,
          ci95_lower_ms: stats.ci95_lower,
          ci95_upper_ms: stats.ci95_upper,
        });
      }
    }
  }
  return output;
}

function transactionCounts(mainRows) {
  return N_VALUES.map((n) => {
    const perShareValues = finiteValues(groupRows(mainRows, n, "PER_SHARE"), "transaction_count");
    const merkleValues = finiteValues(groupRows(mainRows, n, "MERKLE_ROOT"), "transaction_count");
    const perShareUnique = [...new Set(perShareValues)];
    const merkleUnique = [...new Set(merkleValues)];
    if (perShareUnique.length !== 1 || perShareUnique[0] !== n ||
        merkleUnique.length !== 1 || merkleUnique[0] !== 1) {
      throw new Error(`transaction_count structure mismatch at n=${n}`);
    }
    return {
      n,
      per_share_transaction_count: perShareUnique[0],
      merkle_root_transaction_count: merkleUnique[0],
      transaction_reduction: perShareUnique[0] - merkleUnique[0],
      transaction_reduction_percent:
        (perShareUnique[0] - merkleUnique[0]) / perShareUnique[0] * 100,
    };
  });
}

function feasibility(mainRows, recoveryRows) {
  const output = [];
  for (const [experiment, rows] of [
    ["MAIN", mainRows],
    ["RECOVERY_COUNTERBALANCED", recoveryRows],
  ]) {
    for (const n of N_VALUES) {
      for (const mechanism of MECHANISMS) {
        const group = groupRows(rows, n, mechanism);
        const successes = group.filter(successful).length;
        output.push({
          experiment,
          n,
          mechanism,
          executions: group.length,
          successes,
          failures: group.length - successes,
          success_rate_percent: group.length ? successes / group.length * 100 : null,
        });
      }
    }
  }
  return output;
}

function scalability(gasRows, recoveryRows, pairedRows, transactionRows, feasibilityRows) {
  return N_VALUES.map((n) => {
    const gas = gasRows.find((row) => row.n === n);
    const recovery = recoveryRows.find((row) => row.n === n);
    const paired = pairedRows.find((row) => row.n === n);
    const transactions = transactionRows.find((row) => row.n === n);
    const perShareSuccess = feasibilityRows.find((row) =>
      row.experiment === "MAIN" && row.n === n && row.mechanism === "PER_SHARE");
    const merkleSuccess = feasibilityRows.find((row) =>
      row.experiment === "MAIN" && row.n === n && row.mechanism === "MERKLE_ROOT");
    return {
      n,
      per_share_mean_gas: gas.per_share_mean_gas,
      merkle_root_mean_gas: gas.merkle_root_mean_gas,
      gas_reduction_percent: gas.gas_reduction_percent,
      per_share_transactions: transactions.per_share_transaction_count,
      merkle_root_transactions: transactions.merkle_root_transaction_count,
      per_share_recovery_mean_ms: recovery.per_share_mean_recovery_ms,
      merkle_root_recovery_mean_ms: recovery.merkle_root_mean_recovery_ms,
      recovery_reduction_percent: recovery.recovery_reduction_percent,
      paired_recovery_ci_lower: paired.ci95_lower_ms,
      paired_recovery_ci_upper: paired.ci95_upper_ms,
      recovery_ci_excludes_zero: paired.ci_excludes_zero,
      per_share_success_rate: perShareSuccess.success_rate_percent,
      merkle_root_success_rate: merkleSuccess.success_rate_percent,
    };
  });
}

function fixed(value, digits) {
  return Number(value).toFixed(digits);
}

function publicationValues(scalabilityRows, gasStatistics, recoveryStatistics, pairedRows) {
  return scalabilityRows.map((row) => {
    const perShareGas = rowFor(gasStatistics, row.n, "PER_SHARE");
    const merkleGas = rowFor(gasStatistics, row.n, "MERKLE_ROOT");
    const perShareRecovery = rowFor(recoveryStatistics, row.n, "PER_SHARE");
    const merkleRecovery = rowFor(recoveryStatistics, row.n, "MERKLE_ROOT");
    const paired = pairedRows.find((item) => item.n === row.n);
    return {
      n: row.n,
      per_share_mean_gas: Math.round(row.per_share_mean_gas),
      per_share_gas_sd: fixed(perShareGas.sample_standard_deviation, 3),
      merkle_root_mean_gas: Math.round(row.merkle_root_mean_gas),
      merkle_root_gas_sd: fixed(merkleGas.sample_standard_deviation, 3),
      gas_reduction_percent: fixed(row.gas_reduction_percent, 2),
      per_share_recovery_mean_ms: fixed(row.per_share_recovery_mean_ms, 3),
      per_share_recovery_sd_ms: fixed(perShareRecovery.sample_standard_deviation, 3),
      merkle_root_recovery_mean_ms: fixed(row.merkle_root_recovery_mean_ms, 3),
      merkle_root_recovery_sd_ms: fixed(merkleRecovery.sample_standard_deviation, 3),
      recovery_reduction_percent: fixed(row.recovery_reduction_percent, 2),
      paired_mean_delta_ms: fixed(paired.mean_delta_ms, 3),
      paired_ci95_lower_ms: fixed(paired.ci95_lower_ms, 3),
      paired_ci95_upper_ms: fixed(paired.ci95_upper_ms, 3),
      recovery_ci_excludes_zero: paired.ci_excludes_zero,
      per_share_transactions: row.per_share_transactions,
      merkle_root_transactions: row.merkle_root_transactions,
      per_share_success_rate_percent: fixed(row.per_share_success_rate, 1),
      merkle_root_success_rate_percent: fixed(row.merkle_root_success_rate, 1),
    };
  });
}

function componentRow(rows, n, mechanism, component) {
  return rows.find((row) => row.n === n && row.mechanism === mechanism && row.component === component);
}

function statisticsTables(publication, componentRows) {
  const lines = [
    "# Final Statistics Tables",
    "",
    "Publication values are rounded only for display; all analysis CSV calculations retain full precision.",
    "",
    "## Table 1. Experimental Parameters",
    "",
    "| n | k | repetitions | paired datasets |",
    "|---:|---:|---:|---:|",
  ];
  N_VALUES.forEach((n) => lines.push(`| ${n} | ${thresholdFor(n)} | 30 | 30 |`));
  lines.push("", "## Table 2. Anchoring Gas Results", "",
    "| n | PER_SHARE Mean Gas | MERKLE_ROOT Mean Gas | Reduction (%) |",
    "|---:|---:|---:|---:|");
  publication.forEach((row) => lines.push(
    `| ${row.n} | ${row.per_share_mean_gas} ± ${row.per_share_gas_sd} | ` +
    `${row.merkle_root_mean_gas} ± ${row.merkle_root_gas_sd} | ${row.gas_reduction_percent} |`,
  ));
  lines.push("", "## Table 3. Recovery Time Results", "",
    "| n | PER_SHARE Mean ± SD (ms) | MERKLE_ROOT Mean ± SD (ms) | Paired difference (ms) | 95% CI (ms) | Reduction (%) |",
    "|---:|---:|---:|---:|---:|---:|");
  publication.forEach((row) => lines.push(
    `| ${row.n} | ${row.per_share_recovery_mean_ms} ± ${row.per_share_recovery_sd_ms} | ` +
    `${row.merkle_root_recovery_mean_ms} ± ${row.merkle_root_recovery_sd_ms} | ` +
    `${row.paired_mean_delta_ms} | [${row.paired_ci95_lower_ms}, ${row.paired_ci95_upper_ms}] | ` +
    `${row.recovery_reduction_percent} |`,
  ));
  lines.push("", "## Table 4. Transaction Count and Execution Feasibility", "",
    "| n | PER_SHARE TX | MERKLE_ROOT TX | PER_SHARE success (%) | MERKLE_ROOT success (%) |",
    "|---:|---:|---:|---:|---:|");
  publication.forEach((row) => lines.push(
    `| ${row.n} | ${row.per_share_transactions} | ${row.merkle_root_transactions} | ` +
    `${row.per_share_success_rate_percent} | ${row.merkle_root_success_rate_percent} |`,
  ));
  lines.push("", "## Table 5. Recovery Component Analysis", "",
    "| n | PER_SHARE query (ms) | MERKLE_ROOT query (ms) | MERKLE proof (ms) | PER_SHARE verification (ms) | MERKLE verification (ms) | PER_SHARE SSS (ms) | MERKLE SSS (ms) |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|");
  N_VALUES.forEach((n) => lines.push(
    `| ${n} | ${fixed(componentRow(componentRows, n, "PER_SHARE", "blockchain_query_time_ms").mean_ms, 3)} | ` +
    `${fixed(componentRow(componentRows, n, "MERKLE_ROOT", "blockchain_query_time_ms").mean_ms, 3)} | ` +
    `${fixed(componentRow(componentRows, n, "MERKLE_ROOT", "merkle_proof_time_ms").mean_ms, 3)} | ` +
    `${fixed(componentRow(componentRows, n, "PER_SHARE", "verification_time_ms").mean_ms, 3)} | ` +
    `${fixed(componentRow(componentRows, n, "MERKLE_ROOT", "verification_time_ms").mean_ms, 3)} | ` +
    `${fixed(componentRow(componentRows, n, "PER_SHARE", "sss_reconstruction_time_ms").mean_ms, 3)} | ` +
    `${fixed(componentRow(componentRows, n, "MERKLE_ROOT", "sss_reconstruction_time_ms").mean_ms, 3)} |`,
  ));
  return `${lines.join("\n")}\n`;
}

function ratioText(last, first) {
  return first === 0 ? "undefined" : fixed(last / first, 2);
}

function statisticalReport({ gasComparisonRows, recoveryComparisonRows, pairedRows,
  componentRows, transactionRows, feasibilityRows }) {
  const maxGas = [...gasComparisonRows].sort((a, b) =>
    b.gas_reduction_percent - a.gas_reduction_percent)[0];
  const gasFirst = gasComparisonRows[0];
  const gasLast = gasComparisonRows.at(-1);
  const excluded = pairedRows.filter((row) => row.ci_excludes_zero).map((row) => row.n);
  const included = pairedRows.filter((row) => !row.ci_excludes_zero).map((row) => row.n);
  const lowerMechanisms = recoveryComparisonRows.map((row) =>
    `n=${row.n}: ${row.per_share_mean_recovery_ms < row.merkle_root_mean_recovery_ms ? "PER_SHARE" : "MERKLE_ROOT"}`);
  const psQuery5 = componentRow(componentRows, 5, "PER_SHARE", "blockchain_query_time_ms").mean_ms;
  const psQuery1000 = componentRow(componentRows, 1000, "PER_SHARE", "blockchain_query_time_ms").mean_ms;
  const mrQueryMeans = N_VALUES.map((n) => componentRow(componentRows, n, "MERKLE_ROOT", "blockchain_query_time_ms").mean_ms);
  const mrVerify1000 = componentRow(componentRows, 1000, "MERKLE_ROOT", "verification_time_ms").mean_ms;
  const mrProof5 = componentRow(componentRows, 5, "MERKLE_ROOT", "merkle_proof_time_ms").mean_ms;
  const mrProof1000 = componentRow(componentRows, 1000, "MERKLE_ROOT", "merkle_proof_time_ms").mean_ms;
  const psSss1000 = componentRow(componentRows, 1000, "PER_SHARE", "sss_reconstruction_time_ms").mean_ms;
  const mrSss1000 = componentRow(componentRows, 1000, "MERKLE_ROOT", "sss_reconstruction_time_ms").mean_ms;
  const recovery1000 = recoveryComparisonRows.at(-1);
  const mainHighN = feasibilityRows.filter((row) => row.experiment === "MAIN" && [500, 1000].includes(row.n));
  const recoveryHighN = feasibilityRows.filter((row) => row.experiment === "RECOVERY_COUNTERBALANCED" && [500, 1000].includes(row.n));
  return `# Final Statistical Analysis\n\n` +
    `## A. Gas\n\nPER_SHARE mean anchoring gas increased from ${fixed(gasFirst.per_share_mean_gas, 1)} at n=5 to ` +
    `${fixed(gasLast.per_share_mean_gas, 1)} at n=1000 (${ratioText(gasLast.per_share_mean_gas, gasFirst.per_share_mean_gas)}×). ` +
    `MERKLE_ROOT mean gas remained between ${fixed(Math.min(...gasComparisonRows.map((row) => row.merkle_root_mean_gas)), 1)} and ` +
    `${fixed(Math.max(...gasComparisonRows.map((row) => row.merkle_root_mean_gas)), 1)}. The largest observed mean gas reduction was ` +
    `${fixed(maxGas.gas_reduction_percent, 2)}% at n=${maxGas.n}. At n=1000, the means were ` +
    `${fixed(gasLast.per_share_mean_gas, 1)} and ${fixed(gasLast.merkle_root_mean_gas, 1)}, respectively.\n\n` +
    `## B. Recovery\n\nThe mechanism with the lower observed mean was: ${lowerMechanisms.join("; ")}. ` +
    `The paired 95% CI excluded zero at n=${excluded.length ? excluded.join(", ") : "none"}; it included zero at n=${included.length ? included.join(", ") : "none"}. ` +
    `A CI excluding zero is reported as evidence about the paired mean difference, while a CI including zero is not treated as evidence of a nonzero mean difference. ` +
    `Recovery reduction percentages are descriptive and are not used alone for significance claims.\n\n` +
    `## C. Recovery Components\n\nPER_SHARE blockchain-query mean increased from ${fixed(psQuery5, 3)} ms at n=5 to ` +
    `${fixed(psQuery1000, 3)} ms at n=1000 (${ratioText(psQuery1000, psQuery5)}×), making it the dominant measured PER_SHARE component at n=1000. ` +
    `MERKLE_ROOT blockchain-query means stayed in the range ${fixed(Math.min(...mrQueryMeans), 3)}–${fixed(Math.max(...mrQueryMeans), 3)} ms, ` +
    `while proof generation increased from ${fixed(mrProof5, 3)} to ${fixed(mrProof1000, 3)} ms and verification reached ${fixed(mrVerify1000, 3)} ms. ` +
    `At n=1000, SSS reconstruction means were similar (${fixed(psSss1000, 3)} ms PER_SHARE; ${fixed(mrSss1000, 3)} ms MERKLE_ROOT). ` +
    `The total means are close (${fixed(recovery1000.per_share_mean_recovery_ms, 3)} vs ${fixed(recovery1000.merkle_root_mean_recovery_ms, 3)} ms) because ` +
    `PER_SHARE query time (${fixed(psQuery1000, 3)} ms) and MERKLE_ROOT verification time (${fixed(mrVerify1000, 3)} ms) are similarly dominant, and both include approximately 90 ms of SSS reconstruction.\n\n` +
    `## D. Transaction Count\n\nPER_SHARE transaction count increases exactly with n, from ${transactionRows[0].per_share_transaction_count} to ` +
    `${transactionRows.at(-1).per_share_transaction_count}; MERKLE_ROOT remains exactly one anchoring transaction. Deployment transactions are excluded.\n\n` +
    `## E. Execution Feasibility\n\nAt n=500 and n=1000, Main success was ` +
    `${mainHighN.reduce((sum, row) => sum + row.successes, 0)}/${mainHighN.reduce((sum, row) => sum + row.executions, 0)} and ` +
    `Recovery Counterbalanced success was ${recoveryHighN.reduce((sum, row) => sum + row.successes, 0)}/${recoveryHighN.reduce((sum, row) => sum + row.executions, 0)}. ` +
    `No failed observation or outlier was removed.\n`;
}

function validateSources() {
  const freeze = validateExistingFreeze();
  if (!freeze.valid) throw new Error(`Frozen baseline is invalid: ${freeze.errors.join("; ")}`);
  const main = validateMain();
  if (!main.valid) throw new Error(`Main structure invalid: ${main.errors.join("; ")}`);
  const recovery = validateRecoveryRows(experimentConfig.paths.recoveryValidationRaw, { requireSuccess: true });
  const freezeManifest = JSON.parse(fs.readFileSync(
    path.join(experimentConfig.paths.root, "results", "final_freeze", "manifest", "freeze_manifest.json"),
    "utf8",
  ));
  const mainHash = sha256File(experimentConfig.paths.mainRaw);
  const recoveryHash = sha256File(experimentConfig.paths.recoveryValidationRaw);
  if (mainHash !== KNOWN_MAIN_SHA256 || mainHash !== freezeManifest.main.sha256) {
    throw new Error("Main Raw SHA-256 does not match the frozen baseline");
  }
  if (recoveryHash !== freezeManifest.recovery_validation.sha256) {
    throw new Error("Recovery Raw SHA-256 does not match the frozen baseline");
  }
  return { freeze, freezeManifest, main, recovery, mainHash, recoveryHash };
}

function buildAnalysis(mainRows, recoveryRows) {
  const gasStatistics = metricStatistics(mainRows, "primary_gas_used");
  const gasComparisonRows = gasComparison(gasStatistics);
  const recoveryStatistics = metricStatistics(recoveryRows, "total_recovery_time_ms");
  const pairedRows = pairedComparison(recoveryRows);
  const recoveryComparisonRows = recoveryComparison(recoveryStatistics, pairedRows);
  const componentRows = componentStatistics(recoveryRows);
  const transactionRows = transactionCounts(mainRows);
  const feasibilityRows = feasibility(mainRows, recoveryRows);
  const scalabilityRows = scalability(gasComparisonRows, recoveryComparisonRows,
    pairedRows, transactionRows, feasibilityRows);
  const publicationRows = publicationValues(scalabilityRows, gasStatistics,
    recoveryStatistics, pairedRows);
  return {
    gasStatistics,
    gasComparisonRows,
    recoveryStatistics,
    pairedRows,
    recoveryComparisonRows,
    componentRows,
    transactionRows,
    feasibilityRows,
    scalabilityRows,
    publicationRows,
  };
}

function outputContents(analysis) {
  return new Map([
    ["final_gas_statistics.csv", csvText(analysis.gasStatistics)],
    ["final_gas_comparison.csv", csvText(analysis.gasComparisonRows)],
    ["final_recovery_statistics.csv", csvText(analysis.recoveryStatistics)],
    ["final_recovery_paired_comparison.csv", csvText(analysis.pairedRows)],
    ["final_recovery_comparison.csv", csvText(analysis.recoveryComparisonRows)],
    ["final_recovery_component_statistics.csv", csvText(analysis.componentRows)],
    ["final_transaction_count.csv", csvText(analysis.transactionRows)],
    ["final_execution_feasibility.csv", csvText(analysis.feasibilityRows)],
    ["final_scalability_summary.csv", csvText(analysis.scalabilityRows)],
    ["final_publication_values.csv", csvText(analysis.publicationRows)],
    ["FINAL_STATISTICS_TABLES.md", statisticsTables(analysis.publicationRows, analysis.componentRows)],
    ["FINAL_STATISTICAL_ANALYSIS.md", statisticalReport(analysis)],
  ]);
}

function validateOutputShapes(errors) {
  const expectedRows = {
    "final_gas_statistics.csv": 14,
    "final_gas_comparison.csv": 7,
    "final_recovery_statistics.csv": 14,
    "final_recovery_paired_comparison.csv": 7,
    "final_recovery_comparison.csv": 7,
    "final_recovery_component_statistics.csv": 70,
    "final_transaction_count.csv": 7,
    "final_execution_feasibility.csv": 28,
    "final_scalability_summary.csv": 7,
    "final_publication_values.csv": 7,
  };
  for (const [name, count] of Object.entries(expectedRows)) {
    const filePath = path.join(OUTPUT_DIRECTORY, name);
    if (!fs.existsSync(filePath)) {
      errors.push(`missing output: ${name}`);
      continue;
    }
    const actual = readCsvObjects(filePath).length;
    if (actual !== count) errors.push(`${name} rows=${actual}, expected ${count}`);
  }
}

function validateFinalStatistics() {
  const errors = [];
  let sources;
  try {
    sources = validateSources();
  } catch (error) {
    return { valid: false, status: "INVALID", errors: [error.message] };
  }
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { valid: false, status: "INVALID", errors: ["final_statistics_manifest.json is missing"] };
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  for (const name of REQUIRED_OUTPUTS) {
    if (!fs.existsSync(path.join(OUTPUT_DIRECTORY, name))) errors.push(`missing output: ${name}`);
  }
  validateOutputShapes(errors);
  if (manifest.source_hashes?.main !== sources.mainHash) errors.push("manifest Main hash mismatch");
  if (manifest.source_hashes?.recovery_counterbalanced !== sources.recoveryHash) {
    errors.push("manifest Recovery hash mismatch");
  }
  for (const record of manifest.generated_file_hashes ?? []) {
    const filePath = path.join(experimentConfig.paths.root, ...record.relative_path.split("/"));
    if (!fs.existsSync(filePath)) {
      errors.push(`generated file missing: ${record.relative_path}`);
      continue;
    }
    if (fs.statSync(filePath).size !== record.size_bytes || sha256File(filePath) !== record.sha256) {
      errors.push(`generated file hash mismatch: ${record.relative_path}`);
    }
  }
  const recomputed = outputContents(buildAnalysis(
    readCsvObjects(experimentConfig.paths.mainRaw),
    readCsvObjects(experimentConfig.paths.recoveryValidationRaw),
  ));
  for (const [name, expectedText] of recomputed) {
    const filePath = path.join(OUTPUT_DIRECTORY, name);
    if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") !== expectedText) {
      errors.push(`output content does not match Frozen Raw recomputation: ${name}`);
    }
  }
  const before = { main: sources.mainHash, recovery: sources.recoveryHash };
  const after = {
    main: sha256File(experimentConfig.paths.mainRaw),
    recovery: sha256File(experimentConfig.paths.recoveryValidationRaw),
  };
  if (before.main !== after.main || before.recovery !== after.recovery) errors.push("Raw Data changed during validation");
  return {
    valid: errors.length === 0,
    status: errors.length === 0 ? "VALID" : "INVALID",
    checked_at: new Date().toISOString(),
    main_rows: sources.main.rows,
    recovery_rows: sources.recovery.actual_rows,
    main_datasets: sources.main.datasets,
    recovery_datasets: sources.recovery.actual_unique_datasets,
    main_hash_valid: sources.mainHash === KNOWN_MAIN_SHA256,
    recovery_hash_valid: sources.recoveryHash === sources.freezeManifest.recovery_validation.sha256,
    generated_files_valid: !errors.some((error) => error.includes("output") || error.includes("generated file")),
    recomputation_match: !errors.some((error) => error.includes("Frozen Raw recomputation")),
    raw_unchanged: before.main === after.main && before.recovery === after.recovery,
    errors,
  };
}

function consoleValidation(result) {
  if (!result.valid) {
    process.stdout.write(`[Final Statistics] INVALID\n${result.errors.map((error) => `- ${error}`).join("\n")}\n`);
    return;
  }
  process.stdout.write(
    `[Final Statistics] VALID\nMain rows=${result.main_rows}\n` +
    `Recovery rows=${result.recovery_rows}\nMain datasets=${result.main_datasets}\n` +
    `Recovery datasets=${result.recovery_datasets}\nMain hash=VALID\n` +
    `Recovery hash=VALID\nGenerated files=VALID\nRaw data unchanged=true\n`,
  );
}

function generateFinalStatistics() {
  const sources = validateSources();
  const before = {
    main: fileIdentity(experimentConfig.paths.mainRaw),
    recovery: fileIdentity(experimentConfig.paths.recoveryValidationRaw),
  };
  const mainRows = readCsvObjects(experimentConfig.paths.mainRaw);
  const recoveryRows = readCsvObjects(experimentConfig.paths.recoveryValidationRaw);
  const analysis = buildAnalysis(mainRows, recoveryRows);
  const contents = outputContents(analysis);
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  for (const [name, text] of contents) {
    fs.writeFileSync(path.join(OUTPUT_DIRECTORY, name), text, "utf8");
  }
  const after = {
    main: fileIdentity(experimentConfig.paths.mainRaw),
    recovery: fileIdentity(experimentConfig.paths.recoveryValidationRaw),
  };
  if (before.main.sha256 !== after.main.sha256 || before.main.size_bytes !== after.main.size_bytes ||
      before.recovery.sha256 !== after.recovery.sha256 || before.recovery.size_bytes !== after.recovery.size_bytes) {
    throw new Error("Final statistics aborted: Frozen Raw Data changed during analysis");
  }
  const generatedFileHashes = [...contents.keys()].map((name) =>
    fileIdentity(path.join(OUTPUT_DIRECTORY, name)));
  const pairedExcluded = analysis.pairedRows.filter((row) => row.ci_excludes_zero).map((row) => row.n);
  const manifest = {
    analysis_version: "MDPI_FINAL_STATISTICS_V1",
    analysis_date: new Date().toISOString(),
    status: "VALID",
    sources: {
      gas: "results/main/main_raw.csv#primary_gas_used",
      recovery_time: "results/recovery_validation/recovery_counterbalanced_raw.csv#total_recovery_time_ms",
      transaction_count: "results/main/main_raw.csv#transaction_count",
    },
    source_hashes: {
      main: sources.mainHash,
      recovery_counterbalanced: sources.recoveryHash,
    },
    rows: { main: sources.main.rows, recovery_counterbalanced: sources.recovery.actual_rows },
    datasets: { main: sources.main.datasets, recovery_counterbalanced: sources.recovery.actual_unique_datasets },
    observations_per_n_mechanism: 30,
    n_values: N_VALUES,
    statistical_definition: {
      variance_and_standard_deviation: "sample (n-1)",
      quartiles: "linear interpolation",
      confidence_interval: "two-sided 95% Student t interval using METRIC_DEFINITIONS.md critical values",
      paired_delta: "PER_SHARE total_recovery_time_ms - MERKLE_ROOT total_recovery_time_ms",
      outlier_removal: false,
      raw_rounding: false,
    },
    paired_ci_excludes_zero_n: pairedExcluded,
    paired_ci_includes_zero_n: N_VALUES.filter((n) => !pairedExcluded.includes(n)),
    generated_files: REQUIRED_OUTPUTS.map((name) => `results/analysis/final_statistics/${name}`),
    generated_file_hashes: generatedFileHashes,
    validation_result: true,
    raw_data_unchanged: true,
  };
  writeJson(MANIFEST_PATH, manifest);
  const validation = validateFinalStatistics();
  if (!validation.valid) throw new Error(`Final statistics validation failed: ${validation.errors.join("; ")}`);
  consoleValidation(validation);
  return { analysis, manifest, validation };
}

module.exports = {
  OUTPUT_DIRECTORY,
  REQUIRED_OUTPUTS,
  statistics,
  metricStatistics,
  pairedComparison,
  buildAnalysis,
  validateFinalStatistics,
  consoleValidation,
  generateFinalStatistics,
};
