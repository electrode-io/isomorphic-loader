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

var originalLoad = Module._load.bind(Module);

Module._load = function (request, parent, isMain) {
    if (config && config.output && assetsCount > 0) {
        var loaderIndex = request.lastIndexOf("!");
        var xRequest = loaderIndex > 0 ? request.substr(loaderIndex + 1) : request;
        var absolute = Path.isAbsolute(xRequest) || !xRequest.startsWith(".");
        var f = absolute ? xRequest : Path.join(Path.dirname(parent.filename), xRequest);
        var x = removeCwd(require.resolve(f));
        var a = assets[x];

        if (a) {
            return config.output.publicPath + a;
        }
    }

    return originalLoad(request, parent, isMain);
};


function loadAssets(callback) {
    assetsCount = 0;
    assets = {};

    function parseAssets(err, result) {
        if (!err) {
            try {
                assets = JSON.parse(result);
                assetsCount = Object.keys(assets).length;
            } catch (ex) {
                err = ex;
            }
        }

        callback(err);
    }

    function parseConfig(configData) {
        if (configData) {
            config = JSON.parse(configData);
        }

        if (config.version !== Pkg.version) {
            throw new Error("isomorphic-loader config.version and package.version mismatched");
        }
    }

    function readAssets(err, configData) {
        if (err) {
            return callback(err);
        }

        try {
            parseConfig(configData);
            fs.readFile(Path.resolve(config.assetsFile), parseAssets);
        } catch (ex) {
            callback(ex);
        }
    }

    if (!config) {
        fs.readFile(configFile, readAssets);
    } else {
        readAssets();
    }
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
            loadAssets(callback);
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
