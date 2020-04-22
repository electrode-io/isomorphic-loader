"use strict";

/* eslint-disable max-nested-callbacks */

const fs = require("fs");
const Path = require("path");
const rimraf = require("rimraf");
const chai = require("chai");
const clone = require("clone");
const deepExtend = require("deep-extend");
const fetchUrl = require("fetch").fetchUrl;
const Pkg = require("../../package.json");
const Config = require("../../lib/config");
const xaa = require("xaa");
const { asyncVerify, runDefer, runFinally, runTimeout } = require("run-verify");

const expect = chai.expect;

const extendRequire = require("../../lib/extend-require");
const IsomorphicLoaderPlugin = require("../../lib/webpack-plugin");
const logger = require("../../lib/logger");

module.exports = function isomorphicDevSpec({
  title,
  tag,
  timeout,
  webpack,
  WebpackDevServer,
  webpackConfig
}) {
  describe(title, function() {
    this.timeout(timeout);

    webpackConfig.output.path = "/";

    Config.initialWaitingNoticeDelay = 0;

    const configFile = Path.resolve(Config.configFile);

    const defaultFontHash = "1e2bf10d5113abdb2ca03d0d0f4f7dd1.ttf";
    const changedFontHash = "1fb0e331c05a52d5eb847d6fc018320d.ttf";

    function writeFont(data) {
      // default font file md5 1e2bf10d5113abdb2ca03d0d0f4f7dd1
      fs.writeFileSync(
        Path.resolve("test/client/fonts/font.ttf"),
        data || "ttfttfttf\nfontfontfont"
      );
    }

    function cleanup() {
      delete process.send;
      try {
        rimraf.sync(Path.resolve("test/dist"));
        writeFont();
        rimraf.sync(configFile);
      } catch (e) {
        //
      }
    }

    let webpackDevServer;

    function start(config, devConfig, callback) {
      const compiler = webpack(config);
      webpackDevServer = new WebpackDevServer(compiler, deepExtend({}, devConfig));
      webpackDevServer.listen(8080, "localhost", function() {
        callback();
      });
    }

    const devConfig = {
      host: "localhost",
      port: 8080,
      publicPath: webpackConfig.output.publicPath,
      // outputPath: "/",
      filename: webpackConfig.output.filename,
      hot: false,
      contentBase: process.cwd(),
      quiet: true,
      stats: {
        cached: false,
        cachedAssets: false,
        colors: {
          level: 2,
          hasBasic: true,
          has256: true,
          has16m: false
        }
      }
    };

    function stopWebpackDevServer(callback) {
      if (webpackDevServer) {
        webpackDevServer.close();
        webpackDevServer.listeningApp.close(function() {
          webpackDevServer = undefined;
          setTimeout(callback, 200);
        });
      } else {
        callback();
      }
    }

    before(cleanup);

    const origLog = Object.assign({}, logger);
    let logs = [];

    beforeEach(function(done) {
      cleanup();
      Config.verbose = true;
      Config.reloadDelay = 10;
      logs = [];
      logger.log = function() {
        const msg = Array.prototype.slice.apply(arguments).join(" ");
        logs.push(msg);
      };
      logger.error = logger.log;
      done();
    });

    afterEach(function(done) {
      extendRequire.deactivate();
      cleanup();
      Object.assign(logger, origLog);
      stopWebpackDevServer(done);
    });

    const fontFile = "test/client/fonts/font.ttf";

    function verifyRemoteAssets(fontHash, callback) {
      fetchUrl("http://localhost:8080/test/isomorphic-assets.json", function(err, meta, body) {
        if (err) return callback(err);
        expect(meta.status).to.equal(200);
        const assets = JSON.parse(body.toString());
        expect(assets.marked[fontFile]).to.equal(fontHash);
        return callback();
      });
    }

    function verifyFontChange(callback) {
      const logIx = logs.length;
      writeFont("testtesttest"); // font.ttf md5 1fb0e331c05a52d5eb847d6fc018320d

      const startTime = Date.now();
      function check() {
        if (Date.now() - startTime > 5000) {
          callback(new Error("waiting for font change valid message timeout"));
        } else if (!logs.slice(logIx).find(x => x.indexOf("config is now VALID") >= 0)) {
          setTimeout(check, 500);
        } else {
          verifyRemoteAssets(changedFontHash, () => setTimeout(callback, 100));
        }
      }

      check();
    }

    function testWebpackDevServer(config, callback) {
      start(config, devConfig, err => {
        if (err) return callback(err);
        return extendRequire(err2 => {
          if (err2) return callback(err2);
          return verifyRemoteAssets(defaultFontHash, err3 => {
            if (err3) return callback(err3);
            return setTimeout(() => {
              verifyFontChange(callback);
            }, 25);
          });
        });
      });
    }

    function verifyRenameEvent(callback) {
      const logsIx = logs.length;

      const newName = Path.resolve(".iso-config.json");
      const renames = [
        { src: configFile, dst: newName },
        { src: newName, dst: configFile }
      ];

      const check = function() {
        const found = logs
          .slice(logsIx)
          .find(x => x.indexOf("unexpected config file watch event rename") > 0);
        const x = renames.shift();
        if (!x) {
          expect(found).to.be.a.string;
          return callback();
        }
        return fs.rename(x.src, x.dst, function(err) {
          expect(err).to.equal(null);
          setTimeout(check, 10);
        });
      };

      check();
    }

    function verifyBadConfig(callback) {
      let logsIx = logs.length;
      function check() {
        const found = logs.slice(logsIx).find(function(x) {
          return x.indexOf("extend require: file watcher load assets error") >= 0;
        });
        logsIx = logs.length;
        if (found) {
          callback();
        } else {
          setTimeout(check, 10);
        }
      }

      fs.writeFile(configFile, "bad", check);
    }

    function verifySkipReload(callback) {
      let logsIx = logs.length;
      function check() {
        const found = logs.slice(logsIx).find(function(x) {
          return x.indexOf("config is now VALID - skip reload. timestamp did not change") >= 0;
        });
        logsIx = logs.length;
        if (found) {
          callback();
        } else {
          setTimeout(check, 10);
        }
      }

      const isoConfig = JSON.parse(fs.readFileSync(configFile));
      isoConfig.timestamp -= 10000;
      fs.writeFileSync(configFile, JSON.stringify(isoConfig, null, 2));
      check();
    }

    it(`should have default log @${tag}`, function() {
      Object.assign(logger, origLog);
      logger.log("hello", "world", "from logger");
      logger.error("test logger.error");
    });

    it(`should start and watch for file change event @${tag}`, function() {
      return asyncVerify(
        next => testWebpackDevServer(clone(webpackConfig), next),
        next => verifyRenameEvent(next),
        runFinally(() => {
          extendRequire.deactivate();
          return new Promise(resolve => stopWebpackDevServer(resolve));
        })
      );
    });

    function testAddUrl(publicPath, skipSetEnv) {
      const wpConfig = clone(webpackConfig);
      wpConfig.output.publicPath = publicPath;
      wpConfig.plugins = [
        new IsomorphicLoaderPlugin({
          webpackDev: { url: "http://localhost:8080", addUrl: true, skipSetEnv }
        })
      ];
      return asyncVerify(
        next => testWebpackDevServer(wpConfig, next),
        () => {
          const ttf = "../client/fonts/font.ttf";
          const fontFullPath = require.resolve(ttf);
          delete require.cache[fontFullPath];
          const font = require(ttf);
          expect(font).to.equal(`http://localhost:8080/test/${changedFontHash}`);
          delete require.cache[fontFullPath];
          const env = skipSetEnv ? (!!process.env.WEBPACK_DEV).toString() : process.env.WEBPACK_DEV;
          expect(env).to.equal((!skipSetEnv).toString());
        },
        () => xaa.delay(50),
        next => verifySkipReload(next),
        runFinally(() => {
          extendRequire.deactivate();
          return new Promise(resolve => stopWebpackDevServer(resolve));
        })
      );
    }

    it(`should start and add webpack dev server URL @${tag}`, function() {
      delete process.env.WEBPACK_DEV;
      return testAddUrl("/test/", true);
    });

    it(`should start and add webpack dev server URL and / @${tag}`, function() {
      delete process.env.WEBPACK_DEV;
      return testAddUrl("test/", false);
    });

    it(`should use process.send @${tag}`, () => {
      const defer = runDefer();
      process.send = defer.resolve;

      const wpConfig = clone(webpackConfig);
      wpConfig.output.publicPath = "test/";
      wpConfig.plugins = [
        new IsomorphicLoaderPlugin({
          webpackDev: { url: "http://localhost:8080", addUrl: true, skipSetEnv: true }
        })
      ];

      return asyncVerify(
        runTimeout(3000),
        next => start(wpConfig, devConfig, next),
        defer.wait(),
        r => expect(r).has.property("name", "isomorphic-loader-config"),
        runFinally(() => new Promise(resolve => stopWebpackDevServer(resolve)))
      );
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
          "test/client/fonts/font.ttf": "1e2bf10d5113abdb2ca03d0d0f4f7dd1.ttf"
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

    const waitLog = (msg, defer) => {
      const logsIx = logs.length;
      const check = () => {
        if (logs.slice(logsIx).find(x => x.indexOf(msg) >= 0)) {
          defer.resolve();
        } else if (defer.pending()) {
          setTimeout(check, 10);
        }
      };
      check();
    };

    it(`should wait for valid config @${tag}`, () => {
      const config = clone(mockConfig);
      const defer = runDefer();
      return asyncVerify(
        next => fs.writeFile(configFile, JSON.stringify(config, null, 2), next),
        next => extendRequire({}, next),
        next => {
          expect(logs).contains(
            " > isomorphic-loader extend require: config is now VALID - webpack dev server mode < "
          );
          config.valid = false;
          waitLog("watching for valid change", defer);
          return fs.writeFile(configFile, JSON.stringify(config, null, 2), next);
        },
        defer.wait(1000),
        next => {
          defer.clear();
          config.valid = true;
          waitLog("config is now VALID - webpack dev server mode", defer);
          fs.writeFile(configFile, JSON.stringify(config, null, 2), next);
        },
        defer.wait(1000)
      );
    });

    it(`should handle invalid JSON in config file @${tag}`, () => {
      return asyncVerify(
        next => fs.writeFile(configFile, JSON.stringify(mockConfig, null, 2), next),
        next => extendRequire({}, next),
        next => verifyBadConfig(next)
      );
    });
  });
};
