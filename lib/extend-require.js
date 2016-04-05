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

    function checkAsset(request, parent) {
        var config = self.config;
        if (config && config.output && self.assetsCount > 0) {
            var loaderIndex = request.lastIndexOf("!");
            var xRequest = loaderIndex > 0 ? request.substr(loaderIndex + 1) : request;
            var x = removeCwd(this._resolveFilename(xRequest, parent));
            var assetUrl = self.assets[x];

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
        try {
            var a = checkAsset.apply(this, [request, parent]);
            if (a !== undefined) {
                return a;
            }
        } catch (e) {
            /* istanbul ignore next */
            console.log(" > isomorphic-loader extend require: check asset exception", e); // eslint-disable-line
        }

        return originalLoad.apply(this, [request, parent, isMain]);
    };
};

ExtendRequire.prototype.setAssets = function setAssets(a) {
    this.assets = a;
    this.assetsCount = Object.keys(a).length;
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

    function readAssets(err, configData) {
        if (err) {
            return callback(err);
        }

        try {
            parseConfig(configData);
            if (result.config.isWebpackDev) {
                result.assets = result.config.assets;
                watchConfig();
                callback(undefined, result);
            } else {
                fs.readFile(Path.resolve(result.config.assetsFile), parseAssets);
            }
        } catch (ex) {
            callback(ex);
        }
    }

    fs.readFile(configFile, readAssets);
};

ExtendRequire.prototype.loadAssets = function loadAssets(force, callback) {
    var self = this;

    if (typeof force === "function") {
        callback = force;
    }

    this._loadAssets(function (err, result) {
        if (!err) {
            self.config = result.config;
            self.setAssets(result.assets);
        }
        callback(err);
    });
};

ExtendRequire.prototype.waitingNotice = function waitingNotice() {
    if (Date.now() - this.started >= this.delay) {
        console.log(" > isomorphic-loader extend require: waiting for config file to be generated."); // eslint-disable-line
        this.started = Date.now();
        this.delay += 1000;
        this.delay = Math.min(this.delay, 5000);
    }
};

ExtendRequire.prototype.go = function go(callback) {
    var self = this;
    if (!this.config && !fs.existsSync(configFile)) {
        this.waitingNotice();
        setTimeout(function () {
            self.go(callback);
        }, Config.pollConfigInterval);
    } else {
        setTimeout(function () {
            self.loadAssets(function (err) {
                if (!err) {
                    self.interceptLoad();
                }
                callback(err);
            });
        }, 0);
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
    this.started = Date.now();
    this.delay = Config.initialWaitingNoticeDelay;

    var self = this;

    if (typeof userConfig === "function") {
        callback = userConfig;
        userConfig = undefined;
    }

    this.userConfig = userConfig || {};

    if (typeof Promise !== "undefined" && !callback) {
        return new Promise(function (resolve, reject) {
            self.go(function (err) {
                return err ? reject(err) : resolve();
            });
        });
    }

    return this.go(callback);
};

var instance = new ExtendRequire();

module.exports = function extendRequire(userConfig, callback) {
    return instance.extend(userConfig, callback);
};

module.exports.loadAssets = function (force, callback) {
    return instance.loadAssets(force, callback);
};

module.exports.deactivate = function () {
    return instance.deactivate();
};
