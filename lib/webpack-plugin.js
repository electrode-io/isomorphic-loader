"use strict";

/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

// https://webpack.github.io/docs/how-to-write-a-plugin.html

var fs = require("fs");
var Path = require("path");
var Config = require("./config");
var removeCwd = require("./remove-cwd");
var Pkg = require("../package.json");
var deepExtend = require("deep-extend");

var configFile = Path.resolve(Config.configFile);

function IsomorphicLoaderPlugin(options) {
    this.options = deepExtend({assetsFile: Config.defaultAssetsFile}, options);
}

IsomorphicLoaderPlugin.prototype.apply = function (compiler) {
    var self = this;

    compiler.plugin("emit", function (compilation, callback) {
        var stats = compilation.getStats().toJson();

        var assets = stats.modules.reduce(function (acc, m) {
            if (m.identifier.indexOf("isomorphic-loader/index.js!") >= 0) {
                var n = removeCwd(m.identifier, true);
                acc[n] = m.assets[0];
            }

            return acc;
        }, {});

        var opts = this.options;

        //
        // There is no easy way to detect that webpack-dev-server is running, but it does change the output
        // path to "/".  Since that normally is "build" or "dist" and it's unlikely anyone would use "/",
        // we assumes that it's webpack-dev-server if output path is "/".
        //
        var isWebpackDev = opts.output.path === "/" || require.main.filename.indexOf("webpack-dev-server") >= 0;

        var assetsStr = JSON.stringify(assets, null, 2) + "\n";

        compilation.assets[self.options.assetsFile] = {
            source: function () {
                return assetsStr;
            },
            size: function () {
                return assetsStr.length;
            }
        };

        var config = {
            version: Pkg.version,
            timestamp: Date.now(),
            context: removeCwd(opts.context),
            output: {
                path: removeCwd(opts.output.path),
                filename: removeCwd(opts.output.filename),
                publicPath: opts.output.publicPath || ""
            },
            webpackDev: deepExtend({
                url: "http://localhost:8080",

                // should extend require prepend webpack dev URL when returning URL for asset file
                addUrl: true
            }, self.options.webpackDev),
            isWebpackDev: isWebpackDev
        };

        //
        // webpack-dev-server keeps output in memory, so save assets in config.
        //
        if (isWebpackDev) {
            config.assets = assets;
        }

        config.assetsFile = Path.join(config.output.path, self.options.assetsFile);

        fs.writeFile(configFile, JSON.stringify(config, null, 2) + "\n", callback);
    });
};

module.exports = IsomorphicLoaderPlugin;
