const { generatePedinPublicationAssets } = require("../publication/pedinPublicationAssets");

try {
  generatePedinPublicationAssets();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
