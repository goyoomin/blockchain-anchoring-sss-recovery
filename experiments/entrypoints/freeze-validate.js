const { execute } = require("./_run");
const { validateExistingFreeze, consoleValidation } = require("../freeze/freeze");

execute(async () => {
  const result = validateExistingFreeze();
  consoleValidation(result);
  if (!result.valid) throw new Error("MDPI final freeze is invalid");
});
