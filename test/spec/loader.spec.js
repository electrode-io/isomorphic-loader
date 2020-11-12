"use strict";

const isomorphicLoader = require("../../lib/isomorphic-loader");
const CSS_MODULE_MAPPINGS = Symbol.for("css-module-content-mapping");

describe("isomorphic-loader", function() {
  it("should return the content as such", () => {
    const boundFn = isomorphicLoader.bind({ _module: { userRequest: "" } });
    const content = boundFn("testData");
    expect(content).to.equal("testData");
  });

  it("should add content mapping for .(css|less|styl|sass|scss) files", () => {
    const boundFn = isomorphicLoader.bind({ _module: { userRequest: "test.css" } });
    const content = boundFn("testData");
    expect(content).to.equal("testData");
    expect(global[CSS_MODULE_MAPPINGS]["test.css"]).to.equal("testData");
  });

  it("should not add mapping for unsupported filetypes", () => {
    const boundFn = isomorphicLoader.bind({ _module: { userRequest: "foo.js" } });
    const content = boundFn("testData");
    expect(content).to.equal("testData");
    expect(global[CSS_MODULE_MAPPINGS]["foo.js"]).to.be.undefined;
  });
});
