const { validateFull, printValidation } = require("../validation/pedinValidation");

const result = validateFull();
printValidation(result);
if (!result.valid) process.exitCode = 1;
