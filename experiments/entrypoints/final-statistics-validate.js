const { execute } = require("./_run");
const {
  validateFinalStatistics,
  consoleValidation,
} = require("../finalStatistics/finalStatistics");

execute(async () => {
  const result = validateFinalStatistics();
  consoleValidation(result);
  if (!result.valid) throw new Error("Final statistics outputs are invalid");
});
