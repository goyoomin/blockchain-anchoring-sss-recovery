const { summarize } = require("../statistics/pedinStatistics");

try {
  summarize();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
