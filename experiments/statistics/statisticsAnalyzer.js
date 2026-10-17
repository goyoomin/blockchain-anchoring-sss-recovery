const fs = require("fs");
const path = require("path");
const { experimentConfig } = require("../config/experimentConfig");
const { csvValue, readCsvObjects } = require("../logger/experimentLogger");

function numeric(values) {
  return values.map(Number).filter(Number.isFinite);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function quantile(sortedValues, probability) {
  if (!sortedValues.length) return null;
  const position = (sortedValues.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
}

const T_975 = [
  null, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
  2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093,
  2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];

function describe(input) {
  const values = numeric(input).sort((a, b) => a - b);
  if (!values.length) {
    return {
      metric_sample_count: 0, mean: null, standard_deviation: null, median: null,
      variance: null, q1: null, q3: null, iqr: null, minimum: null, maximum: null,
      ci95_low: null, ci95_high: null,
    };
  }
  const average = mean(values);
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1)
    : 0;
  const standardDeviation = Math.sqrt(variance);
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const critical = values.length > 1
    ? (T_975[Math.min(values.length - 1, 30)] ?? 1.96)
    : null;
  const margin = critical === null ? null : critical * standardDeviation / Math.sqrt(values.length);
  return {
    metric_sample_count: values.length,
    mean: average,
    standard_deviation: standardDeviation,
    median: quantile(values, 0.5),
    variance,
    q1,
    q3,
    iqr: q3 - q1,
    minimum: values[0],
    maximum: values[values.length - 1],
    ci95_low: margin === null ? null : average - margin,
    ci95_high: margin === null ? null : average + margin,
  };
}

function groups(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.mechanism}\u0000${row.n}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return [...grouped.entries()]
    .map(([key, entries]) => {
      const [mechanism, n] = key.split("\u0000");
      return { mechanism, n: Number(n), rows: entries };
    })
    .sort((a, b) => a.n - b.n || a.mechanism.localeCompare(b.mechanism));
}

function successful(group) {
  return group.rows.filter((row) => row.success === "true");
}

function metricRows(rawRows, column) {
  return groups(rawRows).map((group) => {
    const successRows = successful(group);
    return {
      mechanism: group.mechanism,
      n: group.n,
      sample_count: group.rows.length,
      success_count: successRows.length,
      failure_count: group.rows.length - successRows.length,
      ...describe(successRows.map((row) => row[column])),
      per_share_mean: null,
      merkle_reduction_percent_vs_per_share: null,
    };
  });
}

function addDerivedMetrics(rows) {
  for (const row of rows) {
    row.per_share_mean = row.mean === null ? null : row.mean / row.n;
    if (row.mechanism === "MERKLE_ROOT" && row.mean !== null) {
      const baseline = rows.find((candidate) =>
        candidate.mechanism === "PER_SHARE" && candidate.n === row.n);
      if (baseline?.mean) {
        row.merkle_reduction_percent_vs_per_share =
          ((baseline.mean - row.mean) / baseline.mean) * 100;
      }
    }
  }
  return rows;
}

function feasibilityRows(rawRows) {
  return groups(rawRows).map((group) => {
    const successRows = successful(group);
    return {
      mechanism: group.mechanism,
      n: group.n,
      sample_count: group.rows.length,
      success_count: successRows.length,
      failure_count: group.rows.length - successRows.length,
      success_rate: group.rows.length ? successRows.length / group.rows.length : null,
      mean_transaction_count: mean(numeric(successRows.map((row) => row.transaction_count))),
      failure_types: [...new Set(
        group.rows.filter((row) => row.success !== "true").map((row) => row.error_type),
      )].filter(Boolean).sort().join("|"),
    };
  });
}

function writeCsv(filePath, rows) {
  require("../freeze/protection").assertNotFrozenRawDestination(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const output = headers.length
    ? `${headers.join(",")}\n${rows.map((row) =>
      headers.map((header) => csvValue(row[header])).join(",")).join("\n")}\n`
    : "";
  fs.writeFileSync(filePath, output, "utf8");
}

function analyze() {
  const rawRows = readCsvObjects(experimentConfig.paths.mainRaw);
  const gas = addDerivedMetrics(metricRows(rawRows, "primary_gas_used"));
  const recovery = addDerivedMetrics(metricRows(rawRows, "total_recovery_time_ms"));
  const feasibility = feasibilityRows(rawRows);
  writeCsv(path.join(experimentConfig.paths.summary, "gas_summary.csv"), gas);
  writeCsv(path.join(experimentConfig.paths.summary, "recovery_summary.csv"), recovery);
  writeCsv(path.join(experimentConfig.paths.summary, "feasibility_summary.csv"), feasibility);
  process.stdout.write(
    `Summary generated from ${rawRows.length} immutable raw rows in ${experimentConfig.paths.summary}\n`,
  );
  return { gas, recovery, feasibility };
}

if (require.main === module) analyze();

module.exports = {
  numeric,
  mean,
  quantile,
  describe,
  metricRows,
  feasibilityRows,
  writeCsv,
  analyze,
};
