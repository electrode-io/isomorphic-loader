"use strict";

/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

var Module = require("module");
var fs = require("fs");
var Path = require("path");
var Config = require("./config");
var removeCwd = require("./remove-cwd");

var configFile = Path.resolve(Config.configFile);

var assets = {};
var config = {};

var originalLoad = Module._load.bind(Module);

Module._load = function (request, parent, isMain) {
    var loaderIndex = request.lastIndexOf("!");
    var xRequest = loaderIndex > 0 ? request.substr(loaderIndex + 1) : request;
    var absolute = Path.isAbsolute(xRequest) || !xRequest.startsWith(".");
    var f = absolute ? xRequest : Path.join(Path.dirname(parent.filename), xRequest);
    var x = removeCwd(require.resolve(f));
    var a = assets[x];
    return a ? config.output.publicPath + a : originalLoad(request, parent, isMain);
};


function loadAssets(callback) {
    function parseAssets(err, result) {
        if (!err) {
            try {
                assets = JSON.parse(result);
            } catch (ex) {
                err = ex;
            }
        }

        callback(err);
    }

    function readAssets(configData) {
        try {
            config = JSON.parse(configData);
            fs.readFile(Path.resolve(config.assetsFile), parseAssets);
        } catch (err) {
            callback(err);
        }
    }

    fs.readFile(configFile, function (err, configData) {
        if (err) {
            return callback(err);
        }

        return readAssets(configData);
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
    if (fs.existsSync(configFile)) {
        setTimeout(function () {
            loadAssets(callback);
        }, 0);
    } else {
        waitingNotice();
        setTimeout(function () {
            go(callback);
        }, Config.pollConfigInterval);
    }
}

function extendRequire(callback) {
    started = Date.now();
    delay = 0;

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
