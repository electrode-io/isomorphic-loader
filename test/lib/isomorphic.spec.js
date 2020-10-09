"use strict";

/* eslint-disable  */

const Fs = require("fs");
const Path = require("path");
const clone = require("clone");
const chai = require("chai");
const rimraf = require("rimraf");
const Config = require("../../lib/config");
const _ = require("lodash");
const expect = chai.expect;
const { extendRequire, setXRequire, getXRequire } = require("../..");
const { asyncVerify, expectError, runFinally } = require("run-verify");
const Pkg = require("../../package.json");

const logger = require("../../lib/logger");

module.exports = function isomorphicExtend({ tag, webpack, webpackConfig }) {
  const SAVE_CONFIG = clone(Config);

  Config.defaultStartDelay = 0;

  function cleanup() {
    try {
      rimraf.sync(Path.resolve("test/dist"));
    } catch (e) {
      //
    }
  }

  function generate(config, callback) {
    if (!callback) {
      callback = config;
      config = webpackConfig;
    }
    const compiler = webpack(config);
    compiler.run(function(err, stats) {
      stats.toString();
      callback(err);
    });
  }

  before(cleanup);

  after(() => {
    Object.assign(Config, SAVE_CONFIG);
  });

  const origLog = Object.assign({}, logger);
  let logs = [];

  beforeEach(function() {
    cleanup();
    logs = [];
    logger.log = function() {
      logs.push(Array.prototype.slice.apply(arguments).join(" "));
    };
    logger.error = logger.log;
  });

  afterEach(function() {
    cleanup();
    Object.assign(logger, origLog);
  });

  it(`should generate assets file @${tag}`, function() {
    function verify() {
      const isomorphicConfig = JSON.parse(
        Fs.readFileSync(Path.resolve("test/dist/isomorphic-assets.json"))
      );
      const expected = {
        valid: true,
        version: Pkg.version,
        timestamp: 0,
        context: "test/client",
        output: {
          path: "test/dist",
          filename: "bundle.js",
          publicPath: "/test/"
        },
        assets: {
          marked: {
            "test/client/images/smiley.jpg": "2029f1bb8dd109eb06f59157de62b529.jpg",
            "test/client/images/smiley2.jpg": "2029f1bb8dd109eb06f59157de62b529.jpg",
            "test/client/images/smiley.svg": "47869791f9dd9ef1be6e258e1a766ab8.svg",
            "test/client/images/smiley.png": "f958aee9742689b14418e8efef2b4032.png",
            "test/client/data/foo.bin": "71f74d0894d9ce89e22c678f0d8778b2.bin",
            "test/client/fonts/font.ttf": "1fb0e331c05a52d5eb847d6fc018320d.ttf"
          },
          chunks: {
            main: "bundle.js"
          }
        }
      };

      isomorphicConfig.timestamp = 0;
      expect(isomorphicConfig).to.deep.equal(expected);
    }

    return asyncVerify(
      next => generate(next),
      () => verify()
    );
  });

  function verifyRequireAssets(publicPath) {
    publicPath = publicPath === undefined ? "/test/" : publicPath;

    const smiley = require("../client/images/smiley.jpg");
    const smiley2 = require("../client/images/smiley2.jpg");
    const smileyFull = require(Path.resolve("test/client/images/smiley.jpg"));
    const smileyPng = require("../client/images/smiley.png");
    const smileySvg = require("../client/images/smiley.svg");
    const fooBin = require("file-loader!isomorphic!../client/data/foo.bin");
    const expectedUrl = publicPath + "2029f1bb8dd109eb06f59157de62b529.jpg";

    expect(smiley).to.equal(expectedUrl);
    expect(smiley2).to.equal(expectedUrl);
    expect(smileyFull).to.equal(expectedUrl);
    expect(smileyPng).to.equal(publicPath + "f958aee9742689b14418e8efef2b4032.png");
    expect(smileySvg).to.equal(publicPath + "47869791f9dd9ef1be6e258e1a766ab8.svg");
    expect(fooBin).to.equal(publicPath + "71f74d0894d9ce89e22c678f0d8778b2.bin");

    try {
      require("bad_module");
      chai.assert(false, "expect exception");
    } catch (e) {
      expect(e).to.be.ok;
    }

    try {
      require("../client/images/smiley");
      chai.assert(false, "expect exception");
    } catch (e) {
      expect(e).to.be.ok;
    }
  }

  const testIsomorphicOutputFile = Path.resolve("test/dist/isomorphic-assets.json");

  it(`should load isomorphic config and extend require @${tag}`, function() {
    let isomorphicRequire;
    return asyncVerify(
      next => generate(next),
      () => {
        isomorphicRequire = extendRequire();
        isomorphicRequire.loadAssets([testIsomorphicOutputFile]);
        expect(isomorphicRequire.isWebpackDev()).to.equal(false);
        verifyRequireAssets();
      },
      runFinally(() => {
        isomorphicRequire && isomorphicRequire.reset();
      })
    );
  });

  it(`should call processConfig @${tag}`, function() {
    const sampleConfig = {
      valid: true,
      version: Pkg.version,
      timestamp: 0,
      context: "test/client",
      output: {
        path: "test/dist",
        filename: "bundle.js",
        publicPath: "/test/"
      },
      assets: {}
    };
    let isomorphicRequire;
    let testConfig;
    return asyncVerify(
      () => {
        isomorphicRequire = extendRequire(
          {
            processConfig: config => {
              return (testConfig = config);
            }
          },
          sampleConfig
        );
        expect(testConfig).to.deep.equal(sampleConfig);
      },

      runFinally(() => {
        isomorphicRequire && isomorphicRequire.reset();
      })
    );
  });

  it(`should default publicPath to "" @${tag}`, function() {
    const config = _.merge({}, webpackConfig);
    delete config.output.publicPath;
    return asyncVerify(
      next => {
        generate(config, next);
      },
      () => {
        const isomorphicConfig = JSON.parse(Fs.readFileSync(testIsomorphicOutputFile));
        expect(isomorphicConfig.output)
          .to.have.property("publicPath")
          .equal("");
      }
    );
  });

  it(`should fail if config version and package version mismatch @${tag}`, function() {
    const sampleConfig = {
      valid: true,
      version: "3.0.0",
      timestamp: 0,
      context: "test/client",
      output: {
        path: "test/dist",
        filename: "bundle.js",
        publicPath: "/test/"
      },
      assets: {}
    };

    return asyncVerify(
      expectError(() => {
        extendRequire({}, sampleConfig);
      }),
      error => {
        expect(error.message).contains("is different from config version 3.0.0");
      }
    );
  });

  it(`should help maintain a global extend require intance`, () => {
    setXRequire("blah");
    expect(getXRequire()).equal("blah");
  });
};
