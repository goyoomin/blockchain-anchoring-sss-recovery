const fs = require("fs");
const path = require("path");
const { experimentConfig } = require("../config/experimentConfig");
const { readCsvObjects } = require("../logger/experimentLogger");
const { describe, mean, numeric, writeCsv } = require("../statistics/statisticsAnalyzer");
const { validateRecoveryRows } = require("./validate");
const { fileIdentity } = require("./integrity");

function successful(row) {
  return row.success === "true" && row.total_recovery_time_ms !== "" &&
    row.total_recovery_time_ms !== null && row.total_recovery_time_ms !== undefined &&
    Number.isFinite(Number(row.total_recovery_time_ms));
}

function tCritical95(df) {
  const table = [null, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
    2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093,
    2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
  if (df > 30) return 1.96;
  return table[Math.max(1, Math.floor(df))] ?? 1.96;
}

function logGamma(z) {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  let x = 0.9999999999998099;
  const shifted = z - 1;
  coefficients.forEach((coefficient, index) => { x += coefficient / (shifted + index + 1); });
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaFraction(a, b, x) {
  const maxIterations = 200;
  const epsilon = 3e-12;
  const tiny = 1e-30;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x / qap);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? front * betaFraction(a, b, x) / a
    : 1 - front * betaFraction(b, a, 1 - x) / b;
}

function twoSidedTPValue(t, df) {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return null;
  return regularizedBeta(df / (df + t * t), df / 2, 0.5);
}

function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const density = 0.3989422804014327 * Math.exp(-x * x / 2);
  const tail = density * t * (0.319381530 + t * (-0.356563782 + t *
    (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - tail : tail;
}

function pairedT(values) {
  const stats = describe(values);
  if (stats.metric_sample_count < 2 || stats.standard_deviation === 0) {
    return { statistic: null, degrees_freedom: Math.max(0, stats.metric_sample_count - 1), p_value: null };
  }
  const statistic = stats.mean / (stats.standard_deviation / Math.sqrt(stats.metric_sample_count));
  return {
    statistic,
    degrees_freedom: stats.metric_sample_count - 1,
    p_value: twoSidedTPValue(statistic, stats.metric_sample_count - 1),
  };
}

function wilcoxon(values) {
  const nonzero = values.filter((value) => Number.isFinite(value) && value !== 0)
    .map((value) => ({ value, absolute: Math.abs(value) }))
    .sort((a, b) => a.absolute - b.absolute);
  let tieCorrection = 0;
  for (let start = 0; start < nonzero.length;) {
    let end = start + 1;
    while (end < nonzero.length && nonzero[end].absolute === nonzero[start].absolute) end += 1;
    const rank = ((start + 1) + end) / 2;
    for (let index = start; index < end; index += 1) nonzero[index].rank = rank;
    const size = end - start;
    tieCorrection += size ** 3 - size;
    start = end;
  }
  const wPlus = nonzero.filter((item) => item.value > 0).reduce((sum, item) => sum + item.rank, 0);
  const wMinus = nonzero.filter((item) => item.value < 0).reduce((sum, item) => sum + item.rank, 0);
  const count = nonzero.length;
  const expected = count * (count + 1) / 4;
  const variance = (count * (count + 1) * (2 * count + 1) - tieCorrection / 2) / 24;
  const z = variance > 0 ? (Math.abs(wPlus - expected) - 0.5) / Math.sqrt(variance) : null;
  return { count, w_plus: wPlus, w_minus: wMinus, z, p_value: z === null ? null : 2 * (1 - normalCdf(Math.abs(z))) };
}

function pairedValues(rows, n) {
  const pairs = new Map();
  rows.filter((row) => Number(row.n) === n).forEach((row) => {
    if (!pairs.has(row.dataset_id)) pairs.set(row.dataset_id, {});
    pairs.get(row.dataset_id)[row.mechanism] = row;
  });
  return [...pairs.entries()].map(([datasetId, pair]) => {
    const valid = successful(pair.PER_SHARE ?? {}) && successful(pair.MERKLE_ROOT ?? {});
    return {
      datasetId,
      sequence: pair.PER_SHARE?.sequence ?? pair.MERKLE_ROOT?.sequence,
      valid,
      delta: valid
        ? Number(pair.PER_SHARE.total_recovery_time_ms) - Number(pair.MERKLE_ROOT.total_recovery_time_ms)
        : null,
    };
  });
}

function recoverySummary(rows) {
  const output = [];
  for (const n of experimentConfig.mainNValues) {
    for (const mechanism of experimentConfig.mechanisms) {
      const group = rows.filter((row) => Number(row.n) === n && row.mechanism === mechanism);
      const values = group.filter(successful).map((row) => row.total_recovery_time_ms);
      const stats = describe(values);
      output.push({ n, mechanism, count: group.length, success_count: values.length,
        failure_count: group.length - values.length, mean: stats.mean,
        sample_standard_deviation: stats.standard_deviation, median: stats.median,
        variance: stats.variance, q1: stats.q1, q3: stats.q3, iqr: stats.iqr,
        minimum: stats.minimum, maximum: stats.maximum,
        ci95_low: stats.ci95_low, ci95_high: stats.ci95_high });
    }
  }
  return output;
}

function pairedAnalysis(rows) {
  return experimentConfig.mainNValues.map((n) => {
    const pairs = pairedValues(rows, n);
    const deltas = pairs.filter((pair) => pair.valid).map((pair) => pair.delta);
    const stats = describe(deltas);
    const t = pairedT(deltas);
    const w = wilcoxon(deltas);
    return { n, pair_count: deltas.length, failed_or_incomplete_pair_count: pairs.length - deltas.length,
      mean_paired_difference_ms: stats.mean, median_paired_difference_ms: stats.median,
      sample_sd_paired_difference_ms: stats.standard_deviation,
      variance_paired_difference_ms: stats.variance, ci95_low_ms: stats.ci95_low,
      ci95_high_ms: stats.ci95_high, minimum_ms: stats.minimum, maximum_ms: stats.maximum,
      paired_t_statistic: t.statistic, paired_t_degrees_freedom: t.degrees_freedom,
      paired_t_p_value: t.p_value, wilcoxon_nonzero_count: w.count,
      wilcoxon_w_plus: w.w_plus, wilcoxon_w_minus: w.w_minus,
      wilcoxon_normal_z: w.z, wilcoxon_two_sided_p_value: w.p_value };
  });
}

function independentComparison(groupA, groupB) {
  const a = describe(groupA);
  const b = describe(groupB);
  if (!a.metric_sample_count || !b.metric_sample_count) return { difference: null, ciLow: null, ciHigh: null, pValue: null };
  const termA = a.variance / a.metric_sample_count;
  const termB = b.variance / b.metric_sample_count;
  const standardError = Math.sqrt(termA + termB);
  const dfDenominator = (termA ** 2 / Math.max(1, a.metric_sample_count - 1)) +
    (termB ** 2 / Math.max(1, b.metric_sample_count - 1));
  const df = dfDenominator ? ((termA + termB) ** 2) / dfDenominator : null;
  const difference = a.mean - b.mean;
  const critical = df ? tCritical95(df) : null;
  const margin = critical === null ? null : critical * standardError;
  const statistic = standardError > 0 ? difference / standardError : null;
  return { difference, ciLow: margin === null ? null : difference - margin,
    ciHigh: margin === null ? null : difference + margin,
    pValue: statistic === null ? null : twoSidedTPValue(statistic, df), df };
}

function orderEffect(rows) {
  const output = [];
  for (const n of experimentConfig.mainNValues) {
    for (const mechanism of experimentConfig.mechanisms) {
      const mechanismRows = rows.filter((row) => Number(row.n) === n && row.mechanism === mechanism && successful(row));
      const first = numeric(mechanismRows.filter((row) => row.position === "FIRST").map((row) => row.total_recovery_time_ms));
      const second = numeric(mechanismRows.filter((row) => row.position === "SECOND").map((row) => row.total_recovery_time_ms));
      const a = describe(first); const b = describe(second); const comparison = independentComparison(first, second);
      output.push({ analysis_type: "POSITION", n, mechanism, group_a: "FIRST", group_b: "SECOND",
        group_a_count: a.metric_sample_count, group_a_mean_ms: a.mean, group_a_sd_ms: a.standard_deviation,
        group_a_median_ms: a.median, group_a_ci95_low_ms: a.ci95_low, group_a_ci95_high_ms: a.ci95_high,
        group_b_count: b.metric_sample_count, group_b_mean_ms: b.mean, group_b_sd_ms: b.standard_deviation,
        group_b_median_ms: b.median, group_b_ci95_low_ms: b.ci95_low, group_b_ci95_high_ms: b.ci95_high,
        difference_a_minus_b_ms: comparison.difference, difference_ci95_low_ms: comparison.ciLow,
        difference_ci95_high_ms: comparison.ciHigh, welch_t_p_value: comparison.pValue });
    }
    const pairs = pairedValues(rows, n).filter((pair) => pair.valid);
    const perFirst = pairs.filter((pair) => pair.sequence === "PER_SHARE_FIRST").map((pair) => pair.delta);
    const merkleFirst = pairs.filter((pair) => pair.sequence === "MERKLE_ROOT_FIRST").map((pair) => pair.delta);
    const a = describe(perFirst); const b = describe(merkleFirst); const comparison = independentComparison(perFirst, merkleFirst);
    output.push({ analysis_type: "SEQUENCE_DELTA", n, mechanism: "PAIRED_DELTA",
      group_a: "PER_SHARE_FIRST", group_b: "MERKLE_ROOT_FIRST",
      group_a_count: a.metric_sample_count, group_a_mean_ms: a.mean, group_a_sd_ms: a.standard_deviation,
      group_a_median_ms: a.median, group_a_ci95_low_ms: a.ci95_low, group_a_ci95_high_ms: a.ci95_high,
      group_b_count: b.metric_sample_count, group_b_mean_ms: b.mean, group_b_sd_ms: b.standard_deviation,
      group_b_median_ms: b.median, group_b_ci95_low_ms: b.ci95_low, group_b_ci95_high_ms: b.ci95_high,
      difference_a_minus_b_ms: comparison.difference, difference_ci95_low_ms: comparison.ciLow,
      difference_ci95_high_ms: comparison.ciHigh, welch_t_p_value: comparison.pValue });
  }
  return output;
}

function mainComparison(mainRows, validationRows) {
  const output = [];
  for (const n of experimentConfig.mainNValues) {
    for (const mechanism of experimentConfig.mechanisms) {
      const original = numeric(mainRows.filter((row) => Number(row.n) === n && row.mechanism === mechanism && successful(row))
        .map((row) => row.total_recovery_time_ms));
      const counterbalanced = numeric(validationRows.filter((row) => Number(row.n) === n && row.mechanism === mechanism && successful(row))
        .map((row) => row.total_recovery_time_ms));
      const originalMean = mean(original); const counterbalancedMean = mean(counterbalanced);
      const comparison = independentComparison(original, counterbalanced);
      output.push({ n, mechanism, original_main_mean_ms: originalMean,
        counterbalanced_mean_ms: counterbalancedMean,
        absolute_difference_ms: originalMean === null || counterbalancedMean === null ? null : Math.abs(originalMean - counterbalancedMean),
        relative_difference_percent: originalMean ? Math.abs(originalMean - counterbalancedMean) / originalMean * 100 : null,
        main_minus_counterbalanced_ms: comparison.difference,
        difference_ci95_low_ms: comparison.ciLow, difference_ci95_high_ms: comparison.ciHigh,
        welch_t_p_value: comparison.pValue });
    }
  }
  return output;
}

function fmt(value, digits = 4) {
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? "NA" : Number(value).toFixed(digits);
}

function interpretationCase(orderRows, comparisonRows, mainRows, validationRows) {
  const excludesZero = (row) => Number.isFinite(Number(row.difference_ci95_low_ms)) &&
    Number.isFinite(Number(row.difference_ci95_high_ms)) &&
    (Number(row.difference_ci95_low_ms) > 0 || Number(row.difference_ci95_high_ms) < 0);
  const orderDetected = orderRows.some(excludesZero);
  const mainDifferenceDetected = comparisonRows.some(excludesZero);
  const directionsMatch = experimentConfig.mainNValues.every((n) => {
    const mainDelta = mean(pairedValues(mainRows, n).filter((pair) => pair.valid).map((pair) => pair.delta));
    const validationDelta = mean(pairedValues(validationRows, n).filter((pair) => pair.valid).map((pair) => pair.delta));
    return mainDelta === null || validationDelta === null || Math.sign(mainDelta) === Math.sign(validationDelta);
  });
  if (!orderDetected && !mainDifferenceDetected) return { caseName: "Case A", orderDetected, mainDifferenceDetected, directionsMatch };
  if (orderDetected && directionsMatch) return { caseName: "Case B", orderDetected, mainDifferenceDetected, directionsMatch };
  return { caseName: "Case C", orderDetected, mainDifferenceDetected, directionsMatch };
}

function reportMarkdown({ validation, summary, paired, order, comparison, mainRows, validationRows }) {
  const environmentPath = path.join(experimentConfig.paths.recoveryValidation, "environment.json");
  const integrityPath = path.join(experimentConfig.paths.recoveryValidation, "main_data_integrity.json");
  const environment = JSON.parse(fs.readFileSync(environmentPath, "utf8"));
  const integrity = JSON.parse(fs.readFileSync(integrityPath, "utf8"));
  const decision = interpretationCase(order, comparison, mainRows, validationRows);
  const lines = ["# Recovery Validation Report", "", "## Experiment Design", "",
    "This experiment tests execution-order sensitivity using the 210 immutable Main datasets.",
    "Recovery timing uses the unchanged `METRIC_DEFINITIONS.md` boundary and `process.hrtime.bigint()`.",
    "Odd repetitions use PER_SHARE_FIRST; even repetitions use MERKLE_ROOT_FIRST. Each mechanism runs after a Hardhat reset and fresh deployment.",
    "One unrecorded dry warm-up per mechanism and n is performed before primary measurements.", "",
    "## Data Integrity", "",
    `- Expected/actual rows: ${validation.expected_rows}/${validation.actual_rows}`,
    `- Expected/actual paired datasets: ${validation.expected_unique_datasets}/${validation.actual_unique_datasets}`,
    `- Successful/failed rows: ${validation.successful_rows}/${validation.failed_rows}`,
    `- Main raw SHA-256 unchanged: ${integrity.unchanged}`,
    `- Environment match: ${environment.environment_match}`,
    `- Environment differences: ${environment.differences.length ? environment.differences.map((x) => x.field).join(", ") : "none"}`, "",
    "## Recovery Summary", "", "| n | PER_SHARE mean ± SD (ms) | MERKLE_ROOT mean ± SD (ms) | paired delta mean [95% CI] (ms) |", "|---:|---:|---:|---:|"];
  for (const n of experimentConfig.mainNValues) {
    const ps = summary.find((row) => row.n === n && row.mechanism === "PER_SHARE");
    const mr = summary.find((row) => row.n === n && row.mechanism === "MERKLE_ROOT");
    const pair = paired.find((row) => row.n === n);
    lines.push(`| ${n} | ${fmt(ps.mean)} ± ${fmt(ps.sample_standard_deviation)} | ${fmt(mr.mean)} ± ${fmt(mr.sample_standard_deviation)} | ${fmt(pair.mean_paired_difference_ms)} [${fmt(pair.ci95_low_ms)}, ${fmt(pair.ci95_high_ms)}] |`);
  }
  lines.push("", "Positive paired delta means MERKLE_ROOT was faster; negative means PER_SHARE was faster.", "",
    "## Order Effect", "", "| n | mechanism/comparison | group A mean | group B mean | A-B [95% CI] (ms) |", "|---:|---|---:|---:|---:|");
  order.forEach((row) => lines.push(`| ${row.n} | ${row.mechanism}: ${row.group_a} vs ${row.group_b} | ${fmt(row.group_a_mean_ms)} | ${fmt(row.group_b_mean_ms)} | ${fmt(row.difference_a_minus_b_ms)} [${fmt(row.difference_ci95_low_ms)}, ${fmt(row.difference_ci95_high_ms)}] |`));
  lines.push("", "## Main vs Counterbalanced", "", "| n | mechanism | Main mean | Counterbalanced mean | absolute difference | relative difference |", "|---:|---|---:|---:|---:|---:|");
  comparison.forEach((row) => lines.push(`| ${row.n} | ${row.mechanism} | ${fmt(row.original_main_mean_ms)} | ${fmt(row.counterbalanced_mean_ms)} | ${fmt(row.absolute_difference_ms)} | ${fmt(row.relative_difference_percent, 2)}% |`));
  lines.push("", "## Interpretation", "",
    `**${decision.caseName}** was selected by a prespecified CI-based descriptive rule: an effect is flagged when its 95% CI excludes zero.`,
    `Order-effect signal detected: ${decision.orderDetected}. Main/counterbalanced mean-difference signal detected: ${decision.mainDifferenceDetected}. Mechanism-direction agreement across n: ${decision.directionsMatch}.`, "");
  if (decision.caseName === "Case A") lines.push("The observed data strengthen the robustness of the original Recovery Time conclusion.");
  if (decision.caseName === "Case B") lines.push("Some order sensitivity is present, but the overall mechanism direction is retained; use the counterbalanced estimates as the primary Recovery Time results.");
  if (decision.caseName === "Case C") lines.push("Order sensitivity or divergence from Main is material under the CI rule; use the counterbalanced estimates as the final Recovery Time results rather than the original Main recovery estimates.");
  lines.push("", "P-values are sensitivity diagnostics only; paired differences and confidence intervals are primary. No automatic outlier removal was applied.", "");
  return lines.join("\n");
}

function analyzeRecoveryValidation() {
  const integrityPath = path.join(experimentConfig.paths.recoveryValidation, "main_data_integrity.json");
  const integrity = JSON.parse(fs.readFileSync(integrityPath, "utf8"));
  const currentMain = fileIdentity(experimentConfig.paths.mainRaw);
  if (integrity.unchanged !== true || integrity.after_sha256 !== currentMain.sha256 ||
      Number(integrity.after_size_bytes) !== currentMain.size_bytes) {
    throw new Error("Main raw integrity is not confirmed for Recovery Validation");
  }
  const validation = validateRecoveryRows(experimentConfig.paths.recoveryValidationRaw, { requireSuccess: false });
  const rows = readCsvObjects(experimentConfig.paths.recoveryValidationRaw);
  const mainRows = readCsvObjects(experimentConfig.paths.mainRaw);
  const summary = recoverySummary(rows);
  const paired = pairedAnalysis(rows);
  const order = orderEffect(rows);
  const comparison = mainComparison(mainRows, rows);
  const directory = experimentConfig.paths.recoveryValidation;
  writeCsv(path.join(directory, "recovery_counterbalanced_summary.csv"), summary);
  writeCsv(path.join(directory, "recovery_paired_analysis.csv"), paired);
  writeCsv(path.join(directory, "recovery_order_effect.csv"), order);
  writeCsv(path.join(directory, "main_vs_counterbalanced.csv"), comparison);
  fs.writeFileSync(path.join(directory, "recovery_validation_report.md"),
    `${reportMarkdown({ validation, summary, paired, order, comparison, mainRows, validationRows: rows })}\n`, "utf8");
  process.stdout.write(`Recovery validation summary generated in ${directory}\n`);
  return { validation, summary, paired, order, comparison };
}

module.exports = { pairedT, wilcoxon, pairedValues, recoverySummary, pairedAnalysis,
  orderEffect, mainComparison, analyzeRecoveryValidation };
