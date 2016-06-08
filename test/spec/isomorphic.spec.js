"use strict";

/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

var chai = require("chai");
var webpack = require("webpack");
var fs = require("fs");
var rimraf = require("rimraf");
var Path = require("path");
var Config = require("../../lib/config");
var expect = chai.expect;

var extendRequire = require("../../lib/extend-require");
var clone = require("clone");
var webpackConfig = clone(require("../webpack.config"));

var configFile = Path.resolve(Config.configFile);
var lockFile = Path.resolve(Config.lockFile);

Config.defaultStartDelay = 0;

describe("isomorphic extend", function () {
    function cleanup() {
        rimraf.sync(Path.resolve("test/dist"));
        rimraf.sync(configFile);
    }

    function generate(config, callback) {
        if (!callback) {
            callback = config;
            config = webpackConfig;
        }
        var compiler = webpack(config);
        compiler.run(function (err, stats) {
            stats.toString();
            callback(err);
        });
    }

    before(cleanup);
    afterEach(function () {
        extendRequire.deactivate();
        cleanup();
    });

    it("should generate assets file", function (done) {
        function verify() {
            chai.assert(fs.existsSync(configFile), "config file doesn't exist");
            var config = JSON.parse(fs.readFileSync(configFile));
            var assets = JSON.parse(fs.readFileSync(Path.resolve(config.assetsFile)));
            var expected = {
                chunks: {
                    main: "bundle.js"
                },
                marked: {
                    "test/client/images/smiley.jpg": "2029f1bb8dd109eb06f59157de62b529.jpg",
                    "test/client/images/smiley2.jpg": "2029f1bb8dd109eb06f59157de62b529.jpg",
                    "test/client/images/smiley.svg": "47869791f9dd9ef1be6e258e1a766ab8.svg",
                    "test/client/images/smiley.png": "f958aee9742689b14418e8efef2b4032.png",
                    "test/client/data/foo.bin": "71f74d0894d9ce89e22c678f0d8778b2.bin",
                    "test/client/fonts/font.ttf": "1e2bf10d5113abdb2ca03d0d0f4f7dd1.ttf"
                }
            };
            expect(assets).to.deep.equal(expected);
            done();
        }

        generate(function () {
            setTimeout(verify, 10);
        });
    });

    function verifyRequireAssets(publicPath) {
        publicPath = publicPath === undefined ? "/test/" : publicPath;

        var smiley = require("../client/images/smiley.jpg");
        var smiley2 = require("../client/images/smiley2.jpg");
        var smileyFull = require(Path.resolve("test/client/images/smiley.jpg"));
        var smileyPng = require("../client/images/smiley.png");
        var smileySvg = require("../client/images/smiley.svg");
        var fooBin = require("file!isomorphic!../client/data/foo.bin");
        var expectedUrl = publicPath + "2029f1bb8dd109eb06f59157de62b529.jpg";

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

    function verifyExtend(callback) {
        extendRequire({startDelay: 0}, function () {
            verifyRequireAssets();
            callback();
        });
    }

    function verifyExtendPromise(callback) {
        extendRequire({startDelay: 0}).then(verifyRequireAssets).then(callback);
    }

    it("should extend require", function (done) {
        generate(function () {
            verifyExtend(done);
        });
    });

    it("should wait for generate", function (done) {
        verifyExtend(done);
        setTimeout(function () {
            generate(function () {
            });
        }, Config.pollConfigInterval + 1);
    });

    it("should timeout if wait over waitConfigTimeout", function (done) {
        Config.initialWaitingNoticeDelay = 50;
        Config.waitConfigTimeout = 100;
        extendRequire({startDelay: 0}, function (err) {
            expect(err.message).to.equal("isomorphic-loader config not found");
            done();
        });
    });

    it("should support Promise", function (done) {
        if (typeof Promise !== "undefined") {
            generate(function () {
                verifyExtendPromise(done);
            });
        } else {
            console.log("Promise not defined.  Skip test.");
            done();
        }
    });

    it("should fail to load if config doesn't exist", function (done) {
        extendRequire.loadAssets(function (err) {
            expect(err).to.be.ok;
            done();
        });
    });

    it("should fail to load if assets file doesn't exist", function (done) {
        generate(function () {
            rimraf.sync(Path.resolve("test/dist"));
            extendRequire.loadAssets(function (err) {
                expect(err).to.be.ok;
                done();
            });
        });
    });

    it("should fail to load if assets file is invalid", function (done) {
        generate(function () {
            fs.writeFileSync(Path.resolve("test/dist/isomorphic-assets.json"), "bad");
            extendRequire.loadAssets(function (err) {
                expect(err).to.be.ok;
                done();
            });
        });
    });


    it("should fail to extend if config file is invalid (Promise)", function () {
        if (typeof Promise === "undefined") {
            console.log("Promise not defined.  Skip test.");
            return;
        }

        fs.writeFileSync(configFile, "bad");
        return extendRequire({startDelay: 0})
            .then(function () {
                chai.assert(false, "expected error");
            }, function (err) {
                expect(err).to.be.ok;
            });
    });

    it("should fail to extend if config file is invalid (callback)", function (done) {
        fs.writeFileSync(configFile, "bad");
        extendRequire({startDelay: 1}, function (err) {
            expect(err).to.be.ok;
            done();
        });
    });

    it("should handle undefined publicPath", function (done) {
        var config = clone(webpackConfig);
        delete config.output.publicPath;
        generate(config, function () {
            extendRequire({startDelay: 2}, function () {
                verifyRequireAssets("");
                done();
            });
        });
    });

    it("should handle empty publicPath", function (done) {
        var config = clone(webpackConfig);
        config.output.publicPath = "";
        generate(config, function () {
            extendRequire({startDelay: 1}, function () {
                verifyRequireAssets("");
                done();
            });
        });
    });

    it("should fail if config version and package version mismatch", function (done) {
        generate(function () {
            extendRequire({startDelay: 0, version: "0.0.1"}, function (err) {
                expect(err).to.be.ok;
                done();
            });
        });
    });

    it("plugin should remove existing config base on option flag", function () {
        var Plugin = require("../../lib/webpack-plugin");
        fs.writeFileSync(configFile, "{}");
        new Plugin({keepExistingConfig: true}); // eslint-disable-line
        expect(fs.existsSync(configFile)).to.be.true;
        new Plugin({}); // eslint-disable-line
        expect(fs.existsSync(configFile)).to.be.false;
    });

    it("should check lock file", function (done) {
        Config.lockFilePollInterval = 20;
        function verify() {
            var begin = Date.now();
            fs.writeFileSync(lockFile, "lock");
            setTimeout(function () {
                fs.unlinkSync(lockFile);
            }, 18);

            extendRequire(function (err) {
                expect(err).not.to.be.ok;
                expect(Date.now() - begin).to.be.above(20);
                done();
            });
        }

        generate(function (err) {
            expect(err).not.to.be.ok;
            setTimeout(verify, 10);
        });
    });

    it("should wait for valid config if file watcher is not setup yet", function (done) {
        Config.validPollInterval = 20;
        function verify() {
            var config = JSON.parse(fs.readFileSync(configFile));

            function saveConfig(valid) {
                config.valid = valid;
                config.isWebpackDev = true;
                config.assets = {marked: {}};
                config.webpackDev = {};
                fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
            }

            saveConfig(false);
            setTimeout(function () {
                saveConfig(true);
            }, 18);

            var begin = Date.now();
            extendRequire(function (err) {
                expect(err).not.to.be.ok;
                expect(Date.now() - begin).to.be.above(20);
                done();
            });
        }

        generate(function (err) {
            expect(err).not.to.be.ok;
            setTimeout(verify, 10);
        });
    });
});
