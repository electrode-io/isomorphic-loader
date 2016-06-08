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
var lockFile = Path.resolve(Config.lockFile);

function IsomorphicLoaderPlugin(options) {
    this.config = {valid: false};
    this.options = deepExtend({assetsFile: Config.defaultAssetsFile}, options);
    if (!options.keepExistingConfig && fs.existsSync(configFile)) {
        fs.unlinkSync(configFile);
        console.log("isomorphic-loader webpack plugin: removed existing config file");  // eslint-disable-line
    }
}

IsomorphicLoaderPlugin.prototype.apply = function (compiler) {
    var self = this;
    self.locked = 0;

    function saveConfig() {
        self.locked++;
        !fs.existsSync(lockFile) && fs.writeFileSync(lockFile, "lock");

        fs.writeFile(configFile, JSON.stringify(self.config, null, 2) + "\n", function () {
            self.locked--;
            self.locked === 0 && fs.existsSync(lockFile) && fs.unlinkSync(lockFile);
        });
    }

    function createConfig(opts, assets) {
        //
        // There is no easy way to detect that webpack-dev-server is running, but it does change the output
        // path to "/".  Since that normally is "build" or "dist" and it's unlikely anyone would use "/",
        // we assumes that it's webpack-dev-server if output path is "/".
        //
        var isWebpackDev = opts.output.path === "/" || require.main.filename.indexOf("webpack-dev-server") >= 0;

        var config = {
            valid: false,
            version: Pkg.version,
            timestamp: Date.now(),
            context: removeCwd(opts.context),
            output: {
                path: removeCwd(opts.output.path),
                filename: removeCwd(opts.output.filename),
                publicPath: opts.output.publicPath || ""
            }
        };

        if (isWebpackDev) {
            // webpack-dev-server keeps output in memory, so save assets in config.
            config.assets = assets;
            config.webpackDev = deepExtend({
                skipSetEnv: false,
                url: "http://localhost:8080",

                // should extend require prepend webpack dev URL when returning URL for asset file
                addUrl: true
            }, self.options.webpackDev);
            config.isWebpackDev = true;
        }

        return config;
    }

    compiler.plugin("make", function (compilation, callback) {
        self.config = createConfig(this.options);

        // If running in webpack dev server mode, then create a config file ASAP so not to leave
        // extend require waiting.

        if (self.config.isWebpackDev) {
            saveConfig();
        }

        callback();
    });

    compiler.plugin("emit", function (compilation, callback) {
        var stats = compilation.getStats().toJson();

        var marked = stats.modules.reduce(function (acc, m) {
            if (m.identifier.indexOf("isomorphic-loader/index.js!") >= 0) {
                var n = removeCwd(m.identifier, true);
                acc[n] = m.assets[0];
            }

            return acc;
        }, {});

        var assets = {
            marked: marked,
            chunks: stats.assetsByChunkName
        };

        var assetsStr = JSON.stringify(assets, null, 2) + "\n";

        compilation.assets[self.options.assetsFile] = {
            source: function () {
                return assetsStr;
            },
            size: function () {
                return assetsStr.length;
            }
        };

        var config = createConfig(this.options, assets);
        config.valid = true;
        config.assetsFile = Path.join(config.output.path, self.options.assetsFile);

        self.config = config;

        callback();
    });

    compiler.plugin("invalid", function () {
        self.config.valid = false;
        saveConfig();
    });

    compiler.plugin("done", saveConfig);
};

module.exports = IsomorphicLoaderPlugin;
