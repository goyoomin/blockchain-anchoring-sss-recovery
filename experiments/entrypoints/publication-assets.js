const { execute } = require("./_run");
const { generatePublicationAssets } = require("../publicationAssets/publicationAssets");

execute(async () => generatePublicationAssets());
