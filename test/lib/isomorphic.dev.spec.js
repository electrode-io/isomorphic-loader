"use strict";

/* eslint-disable max-nested-callbacks */

const fs = require("fs");
const Path = require("path");
const rimraf = require("rimraf");
const chai = require("chai");
const clone = require("clone");
const _ = require("lodash");
const fetchUrl = require("fetch").fetchUrl;
const xaa = require("xaa");
const { asyncVerify, runFinally } = require("run-verify");

const expect = chai.expect;

const { extendRequire, IsomorphicLoaderPlugin } = require("../..");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

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

    const defaultFontHash = "1e2bf10d5113abdb2ca03d0d0f4f7dd1.ttf";
    const changedFontHash = "1fb0e331c05a52d5eb847d6fc018320d.ttf";

    function writeFont(data) {
      // default font file md5 1e2bf10d5113abdb2ca03d0d0f4f7dd1
      fs.writeFileSync(
        Path.resolve("test/client/fonts/font.ttf"),
        data || "ttfttfttf\nfontfontfont"
      );
    }

    function writeCss(data) {
      fs.writeFileSync(
        Path.resolve("test/nm/demo.css"),
        data || ".demo1 { background-color: greenyellow; }"
      );
    }

    function cleanup() {
      delete process.send;
      try {
        rimraf.sync(Path.resolve("test/dist"));
        writeFont();
        writeCss();
      } catch (e) {
        //
      }
    }

    let webpackDevServer;

    function start(config, devConfig, callback) {
      const compiler = webpack(config);
      webpackDevServer = new WebpackDevServer(compiler, _.merge({}, devConfig));
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

    beforeEach(function(done) {
      cleanup();
      done();
    });

    let isomorphicRequire;
    let isomorphicConfig;

    afterEach(function(done) {
      // cleanup();
      isomorphicRequire && isomorphicRequire.reset();
      isomorphicRequire = undefined;
      isomorphicConfig = undefined;

      stopWebpackDevServer(done);
    });

    const fontFile = "test/client/fonts/font.ttf";
    const cssFile = "test/nm/demo.css";

    function verifyRemoteAssets(fontHash, callback) {
      fetchUrl("http://localhost:8080/test/isomorphic-assets.json", function(err, meta, body) {
        if (err) return callback(err);
        expect(meta.status).to.equal(200);
        const isomorphicData = JSON.parse(body.toString());
        expect(isomorphicData.assets.marked[fontFile]).to.equal(fontHash);
        expect(isomorphicData.assets.marked[cssFile]).to.deep.equal({ "demo1": "demo__demo1" });
        return callback();
      });
    }

    function testWebpackDevServer(config, plugin) {
      isomorphicRequire = extendRequire({});

      plugin.on("update", data => {
        isomorphicConfig = data.config;
        isomorphicRequire.initialize(data.config);
      });

      function verifyAssetChanges(callback) {
        const oldHash = isomorphicConfig.assets.marked[fontFile];
        expect(oldHash).to.be.a("string").that.is.not.empty;
        writeFont("testtesttest"); // font.ttf md5 1fb0e331c05a52d5eb847d6fc018320d
        writeCss(".demo { background-color: greenyellow; }");

        const startTime = Date.now();
        function check() {
          const newHash = isomorphicConfig.assets.marked[fontFile];
          const newMap = isomorphicConfig.assets.marked[cssFile];
          if (newHash && newHash !== oldHash) {
            expect(newHash).to.be.a("string").that.is.not.empty;
            expect(newHash).contains("1fb0e331c05a52d5eb847d6fc018320d");
            expect(newMap).to.deep.equal({ "demo": "demo__demo" });
            callback();
          } else if (Date.now() - startTime > 5000) {
            callback(new Error("waiting for font change valid message timeout"));
          } else {
            setTimeout(check, 50);
          }
        }

        check();
      }

      return asyncVerify(
        next => start(config, devConfig, next),
        () => expect(isomorphicRequire.isWebpackDev()).to.equal(true),
        next => verifyRemoteAssets(defaultFontHash, next),
        () => xaa.delay(25),
        next => verifyAssetChanges(next),
        runFinally(() => {
          plugin.removeAllListeners();
        })
      );
    }

    function testAddUrl(publicPath) {
      const wpConfig = clone(webpackConfig);
      wpConfig.output.publicPath = publicPath;

      const plugin = new IsomorphicLoaderPlugin({
        webpackDev: { url: "http://localhost:8080", addUrl: true }
      });

      wpConfig.plugins = [plugin, new MiniCssExtractPlugin({ filename: "[name].style.css" })];

      return asyncVerify(
        () => testWebpackDevServer(wpConfig, plugin),
        () => {
          const ttf = "../client/fonts/font.ttf";
          const fontFullPath = require.resolve(ttf);
          delete require.cache[fontFullPath];
          const font = require(ttf);
          expect(font).to.equal(`http://localhost:8080/test/${changedFontHash}`);
          delete require.cache[fontFullPath];
        },
        runFinally(() => {
          isomorphicRequire && isomorphicRequire.reset();

          return new Promise(resolve => stopWebpackDevServer(resolve));
        })
      );
    }

    it(`should start and add webpack dev server URL @${tag}`, function() {
      return testAddUrl("/test/", true);
    });

    it(`should start and add webpack dev server URL and / @${tag}`, function() {
      return testAddUrl("test/");
    });
  });
};
