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

var configFile = Path.resolve(Config.configFile);

var assetsCount = 0;
var assets = {};
var config;
var configFileWatcher;

var originalLoad;

function interceptLoad() {
    if (originalLoad) {
        return;
    }

    originalLoad = Module._load.bind(Module);
    Module._load = function (request, parent, isMain) {
        if (config && config.output && assetsCount > 0) {
            var loaderIndex = request.lastIndexOf("!");
            var xRequest = loaderIndex > 0 ? request.substr(loaderIndex + 1) : request;
            var absolute = Path.isAbsolute(xRequest) || !xRequest.startsWith(".");
            var f = absolute ? xRequest : Path.join(Path.dirname(parent.filename), xRequest);
            var x = removeCwd(require.resolve(f));
            var assetUrl = assets[x];

            if (assetUrl) {
                assetUrl = config.output.publicPath + assetUrl;

                if (config.isWebpackDev && config.webpackDev.addUrl && config.webpackDev.url) {
                    var sep = (!config.webpackDev.url.endsWith("/") && !assetUrl.startsWith("/")) ? "/" : "";
                    assetUrl = config.webpackDev.url + sep + assetUrl;
                }

                return assetUrl;
            }
        }

        return originalLoad(request, parent, isMain);
    };
}

function setAssets(a) {
    assets = a;
    assetsCount = Object.keys(assets).length;
}

function _loadAssets(force, callback) {
    var result = {};

    function handleFileChangeEvent(event) {
        if (event !== "change") {
            console.log("isomorphic-loader extend require: unexpected config file watch event", event); // eslint-disable-line
        } else {
            _loadAssets(true, function (err2, res) {
                if (!err2) {
                    if (config && res.config.timestamp <= config.timestamp) {
                        return;
                    }
                    config = res.config;
                    setAssets(config.assets);
                    console.log("isomorphic-loader extend require: config refreshed"); // eslint-disable-line
                } else {
                    console.log("isomorphic-loader extend require: file watcher load assets error", err2); // eslint-disable-line
                }
            });
        }
    }

    function watchConfig() {
        if (!configFileWatcher) {
            configFileWatcher = fs.watch(configFile, handleFileChangeEvent);
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
        if (configData) {
            result.config = JSON.parse(configData);
        }

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

    if (force || !config) {
        fs.readFile(configFile, readAssets);
    } else {
        result.config = config;
        readAssets();
    }
}

function loadAssets(force, callback) {
    if (typeof force === "function") {
        callback = force;
        force = false;
    }

    _loadAssets(force, function (err, result) {
        if (!err) {
            config = result.config;
            setAssets(result.assets);
        }
        callback(err);
    });
}

var started = Date.now();
var delay = 0;

function waitingNotice() {
    if (Date.now() - started >= delay) {
        console.log("isomorphic-loader extend require: waiting for config file to be generated."); // eslint-disable-line
        started = Date.now();
        delay += 1000;
        delay = Math.min(delay, 5000);
    }
}

function go(callback) {
    if (!config && !fs.existsSync(configFile)) {
        waitingNotice();
        setTimeout(function () {
            go(callback);
        }, Config.pollConfigInterval);
    } else {
        setTimeout(function () {
            loadAssets(function (err) {
                if (!err) {
                    interceptLoad();
                }
                callback(err);
            });
        }, 0);
    }
}

function extendRequire(userConfig, callback) {
    started = Date.now();
    delay = 0;

    if (typeof userConfig === "function") {
        callback = userConfig;
        userConfig = undefined;
    }

    config = userConfig;

    if (typeof Promise !== "undefined" && !callback) {
        return new Promise(function (resolve, reject) {
            go(function (err) {
                return err ? reject(err) : resolve();
            });
        });
    }

    return go(callback);
}

module.exports = extendRequire;

extendRequire.loadAssets = loadAssets;
extendRequire.deactivate = function () {
    config = undefined;
    assetsCount = 0;
    if (configFileWatcher) {
        configFileWatcher.close();
        configFileWatcher = undefined;
    }
};
