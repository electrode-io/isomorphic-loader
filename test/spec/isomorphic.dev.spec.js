"use strict";

/* eslint-disable max-nested-callbacks */

var fs = require("fs");
var Path = require("path");
var rimraf = require("rimraf");
var chai = require("chai");
var clone = require("clone");
var deepExtend = require("deep-extend");
var fetchUrl = require("fetch").fetchUrl;

var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");
var webpackConfig = clone(require("../webpack.config"));
var Config = require("../../lib/config");

var expect = chai.expect;

var extendRequire = require("../../lib/extend-require");
var IsomorphicLoaderPlugin = require("../../lib/webpack-plugin");
var logger = require("../../lib/logger");

webpackConfig.output.path = "/";

describe("isomorphic extend with webpack-dev-server", function() {
  this.timeout(4000);
  Config.initialWaitingNoticeDelay = 0;

  var configFile = Path.resolve(Config.configFile);

  function writeFont(data) {
    fs.writeFileSync(Path.resolve("test/client/fonts/font.ttf"), data || "ttfttfttf\nfontfontfont");
  }

  function cleanup() {
    writeFont();
    rimraf.sync(configFile);
  }

  var webpackDevServer;

  function start(config, devConfig, callback) {
    var compiler = webpack(config);
    webpackDevServer = new WebpackDevServer(compiler, deepExtend({}, devConfig));
    webpackDevServer.listen(8080, "localhost", function() {
      callback();
    });
  }

  var devConfig = {
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

  function stop(callback) {
    if (webpackDevServer) {
      webpackDevServer.close();
      webpackDevServer.listeningApp.close(function() {
        webpackDevServer = undefined;
        callback();
      });
    }
  }

  before(cleanup);

  var origLog = logger.log;
  var logs = [];
  beforeEach(function() {
    Config.verbose = true;
    Config.reloadDelay = 10;
    logs = [];
    logger.log = function() {
      logs.push(Array.prototype.slice.apply(arguments).join(" "));
    };
  });

  afterEach(function() {
    extendRequire.deactivate();
    cleanup();
    logger.log = origLog;
  });

  function verifyRemoteAssets(fontHash, callback) {
    fetchUrl("http://localhost:8080/test/isomorphic-assets.json", function(err, meta, body) {
      expect(meta.status).to.equal(200);
      var assets = JSON.parse(body.toString());
      expect(assets.marked["test/client/fonts/font.ttf"]).to.equal(fontHash);
      callback();
    });
  }

  function verifyFontChange(callback) {
    writeFont("testtesttest");

    function check() {
      if (
        !logs.find(function(x) {
          // console.log("checking", x);
          return x.indexOf("config is now VALID") >= 0;
        })
      ) {
        setTimeout(check, 500);
      } else {
        // console.log("found");
        verifyRemoteAssets("1e2bf10d5113abdb2ca03d0d0f4f7dd1.ttf", callback);
      }
    }

    setTimeout(check, 500);
  }

  function test(config, callback) {
    start(config, devConfig, function() {
      extendRequire(function() {
        verifyRemoteAssets("1e2bf10d5113abdb2ca03d0d0f4f7dd1.ttf", function() {
          setTimeout(function() {
            verifyFontChange(callback);
          }, 25);
        });
      });
    });
  }

  function verifyRenameEvent(callback) {
    var newName = Path.resolve(".iso-config.json");
    var renames = [{ src: configFile, dst: newName }, { src: newName, dst: configFile }];

    var check = function() {
      var found = logs.find(function(x) {
        return x.indexOf("unexpected config file watch event rename") > 0;
      });
      var x = renames.shift();
      if (!x) {
        expect(found).to.be.a.string;
        return callback();
      }
      fs.rename(x.src, x.dst, function(err) {
        expect(err).to.equal(null);
        setTimeout(check, 10);
      });
    };

    check();
  }

  function verifyBadConfig(callback) {
    function check() {
      var found = logs.find(function(x) {
        return x.indexOf("extend require: file watcher load assets error") >= 0;
      });
      logs = [];
      if (found) {
        callback();
      } else {
        setTimeout(check, 10);
      }
    }

    fs.writeFile(configFile, "bad", function() {
      setTimeout(check, 10);
    });
  }

  function verifySkipReload(callback) {
    function check() {
      var found = logs.find(function(x) {
        return x.indexOf("config is now VALID - skip reload. timestamp did not change") >= 0;
      });
      logs = [];
      if (found) {
        callback();
      } else {
        setTimeout(check, 10);
      }
    }

    var isoConfig = JSON.parse(fs.readFileSync(configFile));
    isoConfig.timestamp -= 10000;
    fs.writeFileSync(configFile, JSON.stringify(isoConfig, null, 2));
    check();
  }

  it("should have default log", function() {
    logger.log = origLog;
    logger.log("hello", "world", "from logger");
  });

  it("should start and watch for file change event", function(done) {
    test(clone(webpackConfig), function() {
      verifyRenameEvent(function() {
        setTimeout(function() {
          extendRequire.deactivate();
          stop(done);
        }, 10);
      });
    });
  });

  function testAddUrl(publicPath, skipSetEnv, done) {
    var wpConfig = clone(webpackConfig);
    wpConfig.output.publicPath = publicPath;
    wpConfig.plugins = [
      new IsomorphicLoaderPlugin({
        webpackDev: { url: "http://localhost:8080", addUrl: true, skipSetEnv: skipSetEnv }
      })
    ];
    test(wpConfig, function() {
      var font = require("../client/fonts/font.ttf");
      expect(font).to.equal("http://localhost:8080/test/1e2bf10d5113abdb2ca03d0d0f4f7dd1.ttf");
      var env = skipSetEnv ? (!!process.env.WEBPACK_DEV).toString() : process.env.WEBPACK_DEV;
      expect(env).to.equal((!skipSetEnv).toString());
      setTimeout(function() {
        verifySkipReload(function() {
          verifyBadConfig(function() {
            fs.unlinkSync(configFile);
            setTimeout(function() {
              extendRequire.deactivate();
              stop(done);
            }, 10);
          });
        });
      }, 50);
    });
  }

  it("should start and add webpack dev server URL", function(done) {
    delete process.env.WEBPACK_DEV;
    testAddUrl("/test/", true, done);
  });

  it("should start and add webpack dev server URL and /", function(done) {
    delete process.env.WEBPACK_DEV;
    testAddUrl("test/", false, done);
  });
});
