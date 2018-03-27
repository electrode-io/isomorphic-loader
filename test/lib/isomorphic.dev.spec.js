"use strict";

/* eslint-disable max-nested-callbacks */

const fs = require("fs");
const Path = require("path");
const rimraf = require("rimraf");
const chai = require("chai");
const clone = require("clone");
const deepExtend = require("deep-extend");
const fetchUrl = require("fetch").fetchUrl;

const Config = require("../../lib/config");

const expect = chai.expect;

const extendRequire = require("../../lib/extend-require");
const IsomorphicLoaderPlugin = require("../../lib/webpack-plugin");
const logger = require("../../lib/logger");

module.exports = function isomorphicDevSpec({ tag, webpack, WebpackDevServer, webpackConfig }) {
  webpackConfig.output.path = "/";

  Config.initialWaitingNoticeDelay = 0;

  const configFile = Path.resolve(Config.configFile);

  function writeFont(data) {
    // default font file md5 1e2bf10d5113abdb2ca03d0d0f4f7dd1
    fs.writeFileSync(Path.resolve("test/client/fonts/font.ttf"), data || "ttfttfttf\nfontfontfont");
  }

  function cleanup() {
    rimraf.sync(Path.resolve("test/dist"));
    writeFont();
    rimraf.sync(configFile);
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

  function stop(callback) {
    if (webpackDevServer) {
      webpackDevServer.close();
      webpackDevServer.listeningApp.close(function() {
        webpackDevServer = undefined;
        callback();
      });
    } else {
      callback();
    }
  }

  before(cleanup);

  const origLog = logger.log;
  let logs = [];
  beforeEach(function() {
    cleanup();
    Config.verbose = true;
    Config.reloadDelay = 10;
    logs = [];
    logger.log = function() {
      logs.push(Array.prototype.slice.apply(arguments).join(" "));
    };
  });

  afterEach(function(done) {
    extendRequire.deactivate();
    cleanup();
    logger.log = origLog;
    stop(done);
  });

  const fontFile = "test/client/fonts/font.ttf";

  function verifyRemoteAssets(fontHash, callback) {
    fetchUrl("http://localhost:8080/test/isomorphic-assets.json", function(err, meta, body) {
      expect(meta.status).to.equal(200);
      const assets = JSON.parse(body.toString());
      expect(assets.marked[fontFile]).to.equal(fontHash);
      callback();
    });
  }

  function verifyFontChange(callback) {
    writeFont("testtesttest"); // font.ttf md5 1fb0e331c05a52d5eb847d6fc018320d

    function check() {
      if (
        !logs.find(x => {
          console.log("checking", x);
          return x.indexOf("config is now VALID") >= 0;
        })
      ) {
        setTimeout(check, 500);
      } else {
        console.log("found");
        verifyRemoteAssets("1fb0e331c05a52d5eb847d6fc018320d.ttf", callback);
      }
    }

    setTimeout(check, 500);
  }

  function test(config, callback) {
    start(config, devConfig, () => {
      extendRequire(() => {
        verifyRemoteAssets("1e2bf10d5113abdb2ca03d0d0f4f7dd1.ttf", () => {
          setTimeout(() => {
            verifyFontChange(callback);
          }, 25);
        });
      });
    });
  }

  function verifyRenameEvent(callback) {
    const newName = Path.resolve(".iso-config.json");
    const renames = [{ src: configFile, dst: newName }, { src: newName, dst: configFile }];

    const check = function() {
      const found = logs.find(function(x) {
        return x.indexOf("unexpected config file watch event rename") > 0;
      });
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
    function check() {
      const found = logs.find(function(x) {
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
      const found = logs.find(function(x) {
        return x.indexOf("config is now VALID - skip reload. timestamp did not change") >= 0;
      });
      logs = [];
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
    logger.log = origLog;
    logger.log("hello", "world", "from logger");
  });

  it(`should start and watch for file change event @${tag}`, function(done) {
    test(clone(webpackConfig), () => {
      verifyRenameEvent(() => {
        setTimeout(() => {
          extendRequire.deactivate();
          stop(done);
        }, 10);
      });
    });
  });

  function testAddUrl(publicPath, skipSetEnv, done) {
    const wpConfig = clone(webpackConfig);
    wpConfig.output.publicPath = publicPath;
    wpConfig.plugins = [
      new IsomorphicLoaderPlugin({
        webpackDev: { url: "http://localhost:8080", addUrl: true, skipSetEnv: skipSetEnv }
      })
    ];
    test(wpConfig, () => {
      delete require.cache[require.resolve("../client/fonts/font.ttf")];
      const font = require("../client/fonts/font.ttf");
      console.log("font", font);
      expect(font).to.equal("http://localhost:8080/test/1fb0e331c05a52d5eb847d6fc018320d.ttf");
      delete require.cache[require.resolve("../client/fonts/font.ttf")];
      const env = skipSetEnv ? (!!process.env.WEBPACK_DEV).toString() : process.env.WEBPACK_DEV;
      expect(env).to.equal((!skipSetEnv).toString());
      setTimeout(() => {
        verifySkipReload(() => {
          verifyBadConfig(() => {
            fs.unlinkSync(configFile);
            setTimeout(() => {
              extendRequire.deactivate();
              stop(done);
            }, 10);
          });
        });
      }, 50);
    });
  }

  it(`should start and add webpack dev server URL @${tag}`, function(done) {
    delete process.env.WEBPACK_DEV;
    testAddUrl("/test/", true, done);
  });

  it(`should start and add webpack dev server URL and / @${tag}`, function(done) {
    delete process.env.WEBPACK_DEV;
    testAddUrl("test/", false, done);
  });
};
