"use strict";

const logger = require("../../lib/logger");
const xstdout = require("xstdout");
const extendRequire = require("../../lib/extend-require");

describe("logger", function() {
  after(() => {
    logger.setLevel();
  });

  it("should handle log info", () => {
    const intercept = xstdout.intercept(true);

    logger.log("blah");
    const a = intercept.stdout.join("").trim();
    intercept.stdout = [];
    logger.setLevel("error");
    logger.log("oops");
    const b = intercept.stdout.join("").trim();
    intercept.restore();
    expect(a).equal("blah");
    expect(b).equal("");
  });

  it("should handle log error", () => {
    const intercept = xstdout.intercept(true);

    logger.setLevel();
    logger.log("blah");
    logger.error("error");
    const a = intercept.stdout.join("").trim() + intercept.stderr.join("").trim();
    intercept.stdout.splice(0, intercept.stdout.length);
    intercept.stderr.splice(0, intercept.stderr.length);
    extendRequire.setLogLevel("error");
    logger.log("oops");
    logger.error("error");
    logger.setLevel("none");
    logger.error("none");
    const b = intercept.stdout.join("").trim() + intercept.stderr.join("").trim();
    intercept.restore();
    expect(a).equal("blaherror");
    expect(b).equal("error");
  });
});
