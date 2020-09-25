const _checkCdnMapping = require("../../lib/extend-require")._checkCdnMapping;

describe("cdnMapping", () => {
    it("maps asset files to cdn addresses'", () => {
        const assetUrl = _checkCdnMapping({
            cdnUrlMappingFile: "test/client/cdnMapping.json"
        }, "index.js");
        expect(assetUrl).to.equal("http://cdn.localhost.com/index.js");

        const assetUrl2 = _checkCdnMapping({
            cdnUrlMappingFile: "test/client/cdnMapping.json"
        }, "index.js");
        expect(assetUrl2).to.equal("http://cdn.localhost.com/index.js");
    });

    it("or return original asset filename", () => {
        const assetUrl = _checkCdnMapping({
            cdnUrlMappingFile: "test/client/cdnMapping.json"
        }, "index2.js");
        expect(assetUrl).to.equal("index2.js");
    });
});
