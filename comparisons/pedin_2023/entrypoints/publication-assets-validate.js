const { validatePedinPublicationAssets, consoleValidation } = require("../publication/pedinPublicationAssets");

const result = validatePedinPublicationAssets();
consoleValidation(result);
if (!result.valid) process.exitCode = 1;
