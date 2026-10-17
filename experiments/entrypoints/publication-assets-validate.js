const { execute } = require("./_run");
const {
  validatePublicationAssets,
  consoleValidation,
} = require("../publicationAssets/publicationAssets");

execute(async () => {
  const result = validatePublicationAssets();
  consoleValidation(result);
  if (!result.valid) throw new Error("Publication assets are invalid");
});
