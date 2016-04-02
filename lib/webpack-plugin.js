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

function IsomorphicLoaderPlugin(options) {
    options = options || {};
    this.options = options;
    this.options.assetsFile = options.assetsFile || Config.defaultAssetsFile;
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

        assets = JSON.stringify(assets, null, 2) + "\n";

        compilation.assets[self.options.assetsFile] = {
            source: function () {
                return assets;
            },
            size: function () {
                return assets.length;
            }
        };

        var opts = this.options;

        var config = {
            version: Pkg.version,
            context: removeCwd(opts.context),
            debug: opts.debug,
            devtool: opts.devtool,
            output: {
                path: removeCwd(opts.output.path),
                filename: removeCwd(opts.output.filename),
                publicPath: opts.output.publicPath || ""
            }
        };

        config.assetsFile = Path.join(config.output.path, self.options.assetsFile);

        fs.writeFile(Path.resolve(Config.configFile), JSON.stringify(config, null, 2) + "\n", callback);
    });
};

module.exports = IsomorphicLoaderPlugin;
