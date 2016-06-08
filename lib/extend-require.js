"use strict";

/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

var Module = require("module");
var fs = require("fs");
var Path = require("path");
var Config = require("./config");
var removeCwd = require("./remove-cwd");
var Pkg = require("../package.json");
var deepExtend = require("deep-extend");

var configFile = Path.resolve(Config.configFile);
var lockFile = Path.resolve(Config.lockFile);

function ExtendRequire() {
    this.assetsCount = 0;
    this.assets = {};
    this.config = undefined;
    this.userConfig = undefined;
    this.configFileWatcher = undefined;
}

var originalLoad;

ExtendRequire.prototype.interceptLoad = function interceptLoad() {
    if (originalLoad) {
        return;
    }

    originalLoad = Module._load;

    var self = this;

    function isAssetNotFound(request) {
        var x = Path.basename(request);
        return Object.keys(self.assets.marked).find(function (name) {
            return name.indexOf(x) >= 0;
        });
    }

    function checkAsset(request, parent) {
        var config = self.config;
        if (config && config.output && self.assetsCount > 0) {
            var loaderIndex = request.lastIndexOf("!");
            var xRequest = loaderIndex > 0 ? request.substr(loaderIndex + 1) : request;
            var resolved;
            try {
                resolved = removeCwd(this._resolveFilename(xRequest, parent));
            } catch (e) {
                if (isAssetNotFound(xRequest)) {
                    console.log(" > isomorphic-loader extend require: check asset " + xRequest + " exception", e); // eslint-disable-line
                }
                return undefined;
            }
            var assetUrl = self.assets.marked[resolved];

            if (assetUrl) {
                assetUrl = config.output.publicPath + assetUrl;

                if (config.isWebpackDev && config.webpackDev.addUrl && config.webpackDev.url) {
                    var sep = (!config.webpackDev.url.endsWith("/") && !assetUrl.startsWith("/")) ? "/" : "";
                    assetUrl = config.webpackDev.url + sep + assetUrl;
                }

                return assetUrl;
            }
        }
    }

    Module._load = function (request, parent, isMain) {
        var a = checkAsset.apply(this, [request, parent]);
        if (a !== undefined) {
            return a;
        }

        return originalLoad.apply(this, [request, parent, isMain]);
    };
};

ExtendRequire.prototype.setAssets = function setAssets(a) {
    this.assets = a;
    this.assetsCount = Object.keys(a.marked).length;
};

ExtendRequire.prototype._loadAssets = function _loadAssets(callback) {
    var result = {};
    var self = this;

    function handleFileChangeEvent(event) {
        if (event !== "change") {
            console.log(" > isomorphic-loader extend require: unexpected config file watch event", event); // eslint-disable-line
        } else {
            if (self.reloading) {
                clearTimeout(self.reloading);
            }

            self.reloading = setTimeout(function () {
                self.reloading = undefined;
                self._loadAssets(function (err2, res) {
                    if (!err2) {
                        if (self.config && res.config.timestamp <= self.config.timestamp) {
                            console.log(" > isomorphic-loader extend require: skip reload. timestamp did not change"); // eslint-disable-line
                            return;
                        }
                        self.config = res.config;
                        self.setAssets(self.config.assets);
                        console.log(" > isomorphic-loader extend require: config refreshed"); // eslint-disable-line
                    } else if (err2.message === Config.waitForValidMessage) {
                        console.log(" > isomorphic-loader extend require: file watcher config is now invalid"); // eslint-disable-line
                    } else {
                        console.log(" > isomorphic-loader extend require: file watcher load assets error", err2); // eslint-disable-line
                    }
                });
            }, Config.reloadDelay);
        }
    }

    function watchConfig() {
        if (!self.configFileWatcher) {
            self.configFileWatcher = fs.watch(configFile, handleFileChangeEvent);
        }
    }

    function parseAssets(err, assetsData) {
        if (!err) {
            try {
                result.assets = JSON.parse(assetsData);
            } catch (ex) {
                err = ex;
            }
        }

        callback(err, result);
    }

    function parseConfig(configData) {
        result.config = JSON.parse(configData);
        deepExtend(result.config, self.userConfig);

        if (result.config.version !== Pkg.version) {
            throw new Error("isomorphic-loader config.version and package.version mismatched");
        }
    }

    function waitForValidConfig() {
        if (self.configFileWatcher) {
            callback(new Error(Config.waitForValidMessage));
        } else {
            setTimeout(function () {
                self._loadAssets(callback);
            }, Config.validPollInterval);
        }
    }

    function handleWebpackDev() {
        if (!result.config.webpackDev.skipSetEnv) {
            process.env.WEBPACK_DEV = "true";
        }

        if (!result.config.valid) {
            console.log(" > isomorphic-loader extend require: webpack dev server mode - waiting for config to become valid."); // eslint-disable-line
            return waitForValidConfig();
        }

        console.log(" > isomorphic-loader extend require: webpack dev server mode - config is now valid."); // eslint-disable-line
        result.assets = result.config.assets;
        watchConfig();
        callback(undefined, result);
    }

    function readAssets(err, configData) {
        if (err) {
            return callback(err);
        }

        try {
            parseConfig(configData);
            if (result.config.isWebpackDev) {
                handleWebpackDev();
            } else {
                fs.readFile(Path.resolve(result.config.assetsFile), parseAssets);
            }
        } catch (ex) {
            callback(ex);
        }
    }

    if (fs.existsSync(lockFile)) {
        setTimeout(function () {
            self._loadAssets(callback);
        }, Config.lockFilePollInterval);
    } else {
        fs.readFile(configFile, readAssets);
    }
};

ExtendRequire.prototype.loadAssets = function loadAssets(callback) {
    var self = this;

    this._loadAssets(function (err, result) {
        if (!err) {
            self.config = result.config;
            self.setAssets(result.assets);
        }
        callback(err);
    });
};

ExtendRequire.prototype.waitingNotice = function waitingNotice() {
    var now = Date.now();
    if (now - this.waitStart >= this.delay) {
        console.log(" > isomorphic-loader extend require: waiting for config file to be generated."); // eslint-disable-line
        this.waitStart = now;
        this.delay += 500;
        this.delay = Math.min(this.delay, 5000);
        if (now - this.started >= Config.waitConfigTimeout) {
            console.log(" > isomorphic-loader extend require: ERROR - unable to detect " + configFile); // eslint-disable-line
            console.log(" >>>> If you are running with webpack dev server, please make sure that is working properly."); // eslint-disable-line
            return false;
        }
    }
    return true;
};

ExtendRequire.prototype.go = function go(callback) {
    var self = this;
    if (!this.config && !fs.existsSync(configFile)) {
        if (!this.waitingNotice()) {
            return callback(new Error("isomorphic-loader config not found"));
        }
        setTimeout(function () {
            self.go(callback);
        }, Config.pollConfigInterval);
    } else {
        self.loadAssets(function (err) {
            if (!err) {
                self.interceptLoad();
            }
            callback(err);
        });
    }
};


ExtendRequire.prototype.deactivate = function deactivate() {
    this.config = undefined;
    this.assetsCount = 0;
    if (this.configFileWatcher) {
        this.configFileWatcher.close();
        this.configFileWatcher = undefined;
    }
};

ExtendRequire.prototype.extend = function extend(userConfig, callback) {
    this.waitStart = this.started = Date.now();
    this.delay = Config.initialWaitingNoticeDelay;

    var self = this;

    if (typeof userConfig === "function") {
        callback = userConfig;
        userConfig = undefined;
    }

    this.userConfig = userConfig || {};

    var startDelay = isNaN(this.userConfig.startDelay) ? Config.defaultStartDelay : this.userConfig.startDelay;

    if (typeof Promise !== "undefined" && !callback) {
        return new Promise(function (resolve, reject) {
            setTimeout(function () {
                self.go(function (err) {
                    return err ? reject(err) : resolve();
                });

            }, startDelay);
        });
    }

    return setTimeout(function () {
        self.go(callback);
    }, startDelay);
};

var instance = new ExtendRequire();

module.exports = function extendRequire(userConfig, callback) {
    return instance.extend(userConfig, callback);
};

module.exports.loadAssets = function (callback) {
    return instance.loadAssets(callback);
};

module.exports.deactivate = function () {
    return instance.deactivate();
};
