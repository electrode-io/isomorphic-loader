"use strict";

/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

/* eslint-disable */

var chai = require("chai");
var webpack = require("webpack");
var fs = require("fs");
var rimraf = require("rimraf");
var Path = require("path");
var Config = require("../../lib/config");
var expect = chai.expect;

var extendRequire = require("../../lib/extend-require");
var clone = require("clone");
var WebpackDevServer = require("webpack-dev-server");
var deepExtend = require("deep-extend");
var fetchUrl = require("fetch").fetchUrl;

var webpackConfig = clone(require("../webpack.config"));
var IsomorphicLoaderPlugin = require("../../lib/webpack-plugin");

webpackConfig.output.path = "/";


describe("isomorphic extend with webpack-dev-server", function () {

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
    var devConfig = {
        "host": "localhost",
        "port": 8080,
        "publicPath": webpackConfig.output.publicPath,
        "outputPath": "/",
        "filename": webpackConfig.output.filename,
        "hot": false,
        "contentBase": process.cwd(),
        "quiet": true,
        "stats": {
            "cached": false,
            "cachedAssets": false,
            "colors": {
                "level": 2,
                "hasBasic": true,
                "has256": true,
                "has16m": false
            }
        }
    };

    function start(config, devConfig, callback) {
        var compiler = webpack(config);
        webpackDevServer = new WebpackDevServer(compiler, deepExtend({}, devConfig));
        webpackDevServer.listen(8080, "localhost", function () {
            callback();
        });
    }

    function stop(callback) {
        if (webpackDevServer) {
            webpackDevServer.close();
            webpackDevServer.listeningApp.close(function () {
                webpackDevServer = undefined;
                callback();
            });
        }
    }

    before(cleanup);
    afterEach(function () {
        extendRequire.deactivate();
        cleanup();
    });

    function verifyRemoteAssets(fontHash, callback) {
        fetchUrl("http://localhost:8080/test/isomorphic-assets.json", function (err, meta, body) {
            expect(meta.status).to.equal(200);
            var assets = JSON.parse(body.toString());
            expect(assets.marked["test/client/fonts/font.ttf"]).to.equal(fontHash);

            callback();
        });

    }

    function verifyFontChange(callback) {
        var log = console.log, found;

        writeFont("testtesttest");

        function check() {
            if (!found) {
                setTimeout(check, 10);
            } else {
                verifyRemoteAssets("1fb0e331c05a52d5eb847d6fc018320d.ttf", callback);
            }
        }

        console.log = function (txt) {
            if (txt.indexOf("extend require: config refreshed") >= 0) {
                found = true;
                console.log = log;
            }
        };

        setTimeout(check, 10);
    }

    function test(config, callback) {
        start(config, devConfig, function () {
            extendRequire(function () {
                verifyRemoteAssets("1e2bf10d5113abdb2ca03d0d0f4f7dd1.ttf", function () {
                    setTimeout(function () {
                        verifyFontChange(callback);
                    }, 25);
                });
            });
        });
    }

    function verifyRenameEvent(callback) {
        var found = false;
        var log = console.log;
        console.log = function (txt, event) {
            if (txt.indexOf("extend require: unexpected config file watch event") >= 0 && event === "rename") {
                found = true;
            }
        };

        var newName = Path.resolve(".iso-config.json");
        var check;

        var verified = function () {
            found = false;
            verified = function () {
                console.log = log;
                callback();
            };
            fs.rename(newName, configFile, function (err) {
                expect(err).to.equal(null);
                setTimeout(check, 10);
            });
        };

        check = function () {
            if (found) {
                verified();
            } else {
                setTimeout(check, 10);
            }
        };

        fs.rename(configFile, newName, function (err) {
            expect(err).to.equal(null);
            setTimeout(check, 10);
        });
    }

    function verifyBadConfig(callback) {
        var log = console.log;
        var found = false;
        console.log = function (txt) {
            if (txt.indexOf("extend require: file watcher load assets error") >= 0) {
                found = true;
                console.log = log;
            }
        };
        function check() {
            if (found) {
                callback();
            } else {
                setTimeout(check, 10);
            }
        }

        fs.writeFile(configFile, "bad", function () {
            setTimeout(check, 10);
        });
    }

    function verifySkipReload(callback) {
        var log = console.log;
        var found = false;

        console.log = function (txt) {
            if (txt.indexOf("extend require: skip reload. timestamp did not change") >= 0) {
                found = true;
                console.log = log;
            }
        };

        function check() {
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


    it("should start and watch for file change event", function (done) {
        test(clone(webpackConfig), function () {
            verifyRenameEvent(function () {
                setTimeout(function () {
                    extendRequire.deactivate();
                    stop(done);
                }, 10);
            });
        });
    });

    function testAddUrl(publicPath, skipSetEnv, done) {
        var wpConfig = clone(webpackConfig);
        wpConfig.output.publicPath = publicPath;
        wpConfig.plugins = [new IsomorphicLoaderPlugin({
            webpackDev: {url: "http://localhost:8080", addUrl: true, skipSetEnv: skipSetEnv}
        })];
        test(wpConfig, function () {
            var font = require("../client/fonts/font.ttf");
            expect(font).to.equal("http://localhost:8080/test/1fb0e331c05a52d5eb847d6fc018320d.ttf");
            var env = skipSetEnv ? (!!process.env.WEBPACK_DEV).toString() : process.env.WEBPACK_DEV;
            expect(env).to.equal((!skipSetEnv).toString());
            setTimeout(function () {
                verifySkipReload(function () {
                    verifyBadConfig(function () {
                        fs.unlinkSync(configFile);
                        setTimeout(function () {
                            extendRequire.deactivate();
                            stop(done);
                        }, 10);
                    });
                });
            }, 50);
        });
    }

    it("should start and add webpack dev server URL", function (done) {
        delete process.env.WEBPACK_DEV;
        testAddUrl("/test/", true, done);
    });

    it("should start and add webpack dev server URL and /", function (done) {
        delete process.env.WEBPACK_DEV;
        testAddUrl("test/", false, done);
    });
});
