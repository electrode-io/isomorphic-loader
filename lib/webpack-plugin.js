"use strict";

/* eslint-disable no-unused-expressions, prefer-template, no-magic-numbers */

// https://webpack.github.io/docs/how-to-write-a-plugin.html

const fs = require("fs");
const Path = require("path");
const Config = require("./config");
const removeCwd = require("./remove-cwd");
const Pkg = require("../package.json");
const deepExtend = require("deep-extend");
const posixify = require("./posixify");

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
  const configToSave = [];
  let savingLock = false;
  let writeConfigTimer;
  let writeConfig; // eslint-disable-line

  const lockSave = () => {
    if (!fs.existsSync(lockFile)) {
      fs.writeFileSync(lockFile, "lock");
    }
    savingLock = true;
  };

  const setupWriteTimer = delay => {
    if (writeConfigTimer) clearTimeout(writeConfigTimer);
    // If not in webpack dev mode, need to save immediately
    writeConfigTimer = setTimeout(writeConfig, delay).unref();
  };

  writeConfig = () => {
    writeConfigTimer = undefined;
    if (configToSave.length === 0) {
      savingLock && fs.unlinkSync(lockFile);
      savingLock = false;
      return;
    }

    const slot = configToSave.shift();
    fs.writeFile(configFile, slot.data, () => {
      setupWriteTimer(10);
    });
  };

  const saveConfig = tag => {
    const data = JSON.stringify(this.config, null, 2) + "\n";

    if (this.config.isWebpackDev) {
      lockSave();
      setupWriteTimer(Config.writeConfigDelay);
      const existSlot = configToSave.find(s => s.valid === this.config.valid);
      if (existSlot) {
        existSlot.data = data;
        existSlot.tag = tag;
      } else {
        configToSave.push({ valid: this.config.valid, data, tag });
      }
    } else {
      fs.writeFileSync(configFile, data);
    }
  };

  const createConfig = (opts, assets) => {
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
      config.webpackDev = Object.assign(
        {
          skipSetEnv: false,
          url: "http://localhost:8080",

          // should extend require prepend webpack dev URL when returning URL for asset file
          addUrl: true
        },
        this.options.webpackDev
      );
      config.isWebpackDev = true;
    }

    return config;
  };

  compiler.plugin("make", (compilation, callback) => {
    this.config = createConfig(compiler.options);

    // If running in webpack dev server mode, then create a config file ASAP so not to leave
    // extend require waiting.

    if (this.config.isWebpackDev) {
      saveConfig("webpackdev make");
    }

    callback();
  });

  compiler.plugin("emit", (compilation, callback) => {
    let sigIdx;
    const stats = compilation.getStats().toJson();
    const loaderSig = "isomorphic-loader";

    const marked = stats.modules.reduce((acc, m) => {
      sigIdx = m.identifier.indexOf(loaderSig);
      if (sigIdx >= 0 && m.assets && m.assets.length > 0) {
        const n = posixify(removeCwd(m.identifier.substr(sigIdx + loaderSig.length), true));
        acc[n] = m.assets[m.assets.length - 1];
      }

      return acc;
    }, {});

    const assets = {
      marked,
      chunks: stats.assetsByChunkName
    };

    const assetsStr = JSON.stringify(assets, null, 2) + "\n";

    compilation.assets[this.options.assetsFile] = {
      source: () => assetsStr,
      size: () => assetsStr.length
    };

    const config = createConfig(compiler.options, assets);
    config.valid = true;
    config.assetsFile = Path.join(config.output.path, this.options.assetsFile);

    this.config = config;

    callback();
  });

  compiler.plugin("invalid", () => {
    this.config.valid = false;
    saveConfig("invalid");
  });

  compiler.plugin("done", () => saveConfig("done"));
};

module.exports = IsomorphicLoaderPlugin;
