"use strict";

const configModName = require.resolve("../../lib/config");

describe("config", function() {
  const clear = () => {
    delete require.cache[configModName];
    delete process.env.NODE_ENV;
  };

  beforeEach(clear);
  afterEach(clear);

  it("should not have .dev in configFile for prod env", () => {
    process.env.NODE_ENV = "production";
    const Config = require(configModName);
    expect(Config.configFile).to.not.contain(".dev.");
  });

  it("should have .dev in configFile for non-prod env", () => {
    const Config = require(configModName);
    expect(Config.configFile).to.contain(".dev.");
  });
});
