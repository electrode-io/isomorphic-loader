"use strict";

/* eslint-disable no-unused-expressions, prefer-template, no-magic-numbers */

// https://webpack.github.io/docs/how-to-write-a-plugin.html

const fs = require("fs");
const Path = require("path");
const Config = require("./config");
const removeCwd = require("./remove-cwd");
const Pkg = require("../package.json");
const deepExtend = require("deep-extend");

const configFile = Path.resolve(Config.configFile);
const lockFile = Path.resolve(Config.lockFile);

function IsomorphicLoaderPlugin(options) {
  this.config = { valid: false };
  this.options = deepExtend({ assetsFile: Config.defaultAssetsFile }, options);
  if (!this.options.keepExistingConfig && fs.existsSync(configFile)) {
    fs.unlinkSync(configFile);
    console.log("isomorphic-loader webpack plugin: removed existing config file"); // eslint-disable-line
  }
}

IsomorphicLoaderPlugin.prototype.apply = function(compiler) {
  const self = this;
  self.locked = 0;

  function saveConfig() {
    self.locked++;
    !fs.existsSync(lockFile) && fs.writeFileSync(lockFile, "lock");

    fs.writeFile(configFile, JSON.stringify(self.config, null, 2) + "\n", () => {
      self.locked--;
      self.locked === 0 && fs.existsSync(lockFile) && fs.unlinkSync(lockFile);
    });
  }

  function createConfig(opts, assets) {
    //
    // There is no easy way to detect that webpack-dev-server is running, but it
    // does change the output path to "/".  Since that normally is "build" or "dist"
    // and it's unlikely anyone would use "/", assumng it's webpack-dev-server if
    // output path is "/".
    //
    const isWebpackDev =
      opts.output.path === "/" || require.main.filename.indexOf("webpack-dev-server") >= 0;

    const config = {
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
      config.webpackDev = deepExtend(
        {
          skipSetEnv: false,
          url: "http://localhost:8080",

          // should extend require prepend webpack dev URL when returning URL for asset file
          addUrl: true
        },
        self.options.webpackDev
      );
      config.isWebpackDev = true;
    }

    return config;
  }

  compiler.plugin("make", function(compilation, callback) {
    self.config = createConfig(this.options); // eslint-disable-line

    // If running in webpack dev server mode, then create a config file ASAP so not to leave
    // extend require waiting.

    if (self.config.isWebpackDev) {
      saveConfig();
    }

    callback();
  });

  compiler.plugin("emit", function(compilation, callback) {
    let sigIdx;
    const stats = compilation.getStats().toJson();
    const loaderSig = Path.join("isomorphic-loader", "index.js!");

    const marked = stats.modules.reduce((acc, m) => {
      sigIdx = m.identifier.indexOf(loaderSig);
      if (sigIdx >= 0) {
        const n = removeCwd(m.identifier.substr(sigIdx + loaderSig.length), true);
        acc[n] = m.assets[0];
      }

      return acc;
    }, {});

    const assets = {
      marked: marked,
      chunks: stats.assetsByChunkName
    };

    const assetsStr = JSON.stringify(assets, null, 2) + "\n";

    compilation.assets[self.options.assetsFile] = {
      source: function() {
        return assetsStr;
      },
      size: function() {
        return assetsStr.length;
      }
    };

    const config = createConfig(this.options, assets); // eslint-disable-line
    config.valid = true;
    config.assetsFile = Path.join(config.output.path, self.options.assetsFile);

    self.config = config;

    callback();
  });

  compiler.plugin("invalid", () => {
    self.config.valid = false;
    saveConfig();
  });

  compiler.plugin("done", saveConfig);
};

module.exports = IsomorphicLoaderPlugin;
