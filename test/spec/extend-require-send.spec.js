"use strict";

const sinon = require("sinon");
const Pkg = require("../../package.json");

const Config = require("../../lib/config");
const logger = require("../../lib/logger");
const extendRequire = require("../../lib/extend-require");
const { asyncVerify, expectError } = require("run-verify");

describe("extend-require using process send event", function() {
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    delete process.send;
    delete process.env.NODE_ENV;
    extendRequire.reset();
    extendRequire.reset();
    sandbox.restore();
  });

  after(() => {
    delete require.cache[require.resolve("../../lib/extend-require")];
  });

  const mockConfig = {
    valid: true,
    version: Pkg.version,
    timestamp: Date.now(),
    context: "test/client",
    output: {
      path: "/",
      filename: "bundle.js",
      publicPath: "test/"
    },
    assets: {
      marked: {
        // "test/client/fonts/font.ttf": "1e2bf10d5113abdb2ca03d0d0f4f7dd1.ttf"
        "test/client/fonts/font.ttf": "1e2bf10d5113abdb2ca03d0d0f4f7mm1.ttf"
      },
      chunks: {
        main: "bundle.js"
      }
    },
    webpackDev: {
      skipSetEnv: false,
      url: "http://localhost:8080",
      addUrl: true
    },
    isWebpackDev: true,
    assetsFile: "/isomorphic-assets.json"
  };

  it("should not listen for events in production mode", () => {
    process.env.NODE_ENV = "production";
    process.send = () => {};
    sandbox.stub(extendRequire._instance, "waitingNotice").returns(false);
    return asyncVerify(
      expectError(next => extendRequire({}, next)),
      r => {
        expect(r).to.be.an("Error");
        expect(r.message).contains("config not found");
      }
    );
  });

  it("should listen for config event messages", () => {
    let handler;
    process.send = () => {};
    sandbox.stub(process, "on").callsFake((e, h) => {
      handler = h;
    });

    let logs = [];
    sandbox.stub(logger, "error").callsFake((...args) => {
      logs.push(args);
    });

    sandbox.stub(logger, "log").callsFake((...args) => {
      logs.push(args);
    });

    return asyncVerify(
      next => extendRequire({}, next),
      // re-entrant testing
      next => extendRequire({}, next),
      () => {
        expect(handler).to.be.a("function");
        handler({ name: Config.configName, config: "abc" });
        expect(logs[0].join(" ")).contains("SyntaxError");
        logs = [];
        handler({ name: Config.configName, config: JSON.stringify(mockConfig) });
        expect(logs[0].join(" ")).contains("config is now VALID");
        const invalidConfig = Object.assign({}, mockConfig, { valid: false });
        logs = [];
        handler({ name: Config.configName, config: JSON.stringify(invalidConfig) });
        expect(logs[0].join(" ")).contains("config is INVALID");
        logs = [];
        handler({ name: Config.configName, config: JSON.stringify(mockConfig) });
        expect(logs[0].join(" ")).contains("config is now VALID");
      },
      () => {
        sandbox
          .stub(extendRequire._instance, "loadAssets")
          .throws(new Error("not expecting loadAssets to be called"));
        handler({ name: "blah-blah-event" });
      }
    );
  });
});
