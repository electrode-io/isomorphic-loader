"use strict";

const configModName = require.resolve("../../lib/config");

describe("config", function () {
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

describe("changing NODE_ENV after initial load", function () {
  const clear = () => {
    delete require.cache[configModName];
    delete process.env.NODE_ENV;
  };

  it("start with NODE_ENV production ", function () {
    process.env.NODE_ENV = 'production';
    const Config = require(configModName);
    expect(Config.configFile).to.equal(".isomorphic-loader-config.json");

    it("change env to dev environment", function () {
      process.env.NODE_ENV = 'developement';
      expect(Config.configFile).to.equal(".isomorphic-loader-config.json");
      expect(Config.getCurrentConfigFile()).to.equal(".isomorphic-loader-config.dev.json")
    })

  })



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
