const { analyzeRecoveryValidation } = require("../recoveryValidation/analyze");
const { execute } = require("./_run");

execute(async () => analyzeRecoveryValidation());
