const { experimentConfig } = require("../config/experimentConfig");
const { validateRecoveryRows } = require("../recoveryValidation/validate");
const { execute } = require("./_run");

execute(async () => {
  const result = validateRecoveryRows(experimentConfig.paths.recoveryValidationRaw, {
    requireSuccess: true,
  });
  process.stdout.write(
    `[Recovery Validation] VALID rows=${result.actual_rows} ` +
    `datasets=${result.actual_unique_datasets} failures=${result.failed_rows}\n`,
  );
});
