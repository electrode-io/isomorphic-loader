"use strict";

const Config = require("../../lib/config");
const lockConfig = require("../../lib/lock-config");

describe("Lock config", function() {
  let saveConfig;
  this.timeout(10000);

  before(() => {
    saveConfig = Object.assign({}, Config);
  });

  afterEach(() => {
    Object.assign(Config, saveConfig);
  });

  it("should fail if lockfile path is not writable", done => {
    Config.lockFile = "/.test.lock";
    Config.lockFileRetries = 1;
    Config.lockFileStale = 500;
    lockConfig.lock(
      "test",
      () => done(new Error("expected failure")),
      err => {
        expect(err).to.exist;
        done();
      }
    );
  });
});
