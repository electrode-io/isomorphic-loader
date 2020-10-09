"use strict";

/* eslint-disable no-unused-expressions, prefer-template, no-magic-numbers, max-statements */

// https://webpack.github.io/docs/how-to-write-a-plugin.html

const Config = require("./config");
const removeCwd = require("./remove-cwd");
const Pkg = require("../package.json");
const posixify = require("./posixify");
const EventEmitter = require("events");

const pluginName = "IsomorphicLoaderPlugin";

class IsomorphicLoaderPlugin extends EventEmitter {
  /**
   *
   * @param {*} options options
   *
   */
  constructor(options) {
    super();
    this.config = { valid: false };
    this.options = { assetsFile: "isomorphic-assets.json", ...options };
  }

  apply(compiler) {
    const createConfig = (compilerOpts, assets = { marked: {}, chunks: {} }) => {
      //
      // There is no easy way to detect that webpack-dev-server is running, but it
      // does change the output path to "/".  Since that normally is "build" or "dist"
      // and it's unlikely anyone would use "/", assuming it's webpack-dev-server if
      // output path is "/".
      //
      const isWebpackDev =
        compilerOpts.output.path === "/" ||
        require.main.filename.indexOf("webpack-dev-server") >= 0;

      const config = {
        valid: false,
        version: Pkg.version,
        timestamp: Date.now(),
        context: removeCwd(compilerOpts.context),
        output: {
          path: removeCwd(compilerOpts.output.path),
          filename: removeCwd(compilerOpts.output.filename),
          publicPath: compilerOpts.output.publicPath || ""
        },
        assets
      };

      if (isWebpackDev) {
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

    const updateConfigForDevMode = () => {
      if (!this.config.isWebpackDev) {
        return;
      }

      this.emit("update", { name: Config.configName, config: this.config });
    };

    const handleEmit = (compilation, callback) => {
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

      const config = createConfig(compiler.options, assets);
      config.valid = true;

      const configStr = JSON.stringify(config, null, 2) + "\n";

      compilation.assets[this.options.assetsFile] = {
        source: () => configStr,
        size: () => configStr.length
      };

      this.config = config;

      callback && callback();
    };

    const handleMake = (compilation, callback) => {
      this.config = createConfig(compiler.options);

      // If running in webpack dev server mode, then create a config file ASAP so not to leave
      // extend require waiting.
      updateConfigForDevMode();

      callback && callback();
    };

    const handleInvalid = () => {
      this.config.valid = false;
      updateConfigForDevMode();
    };

    if (compiler.hooks) {
      // use .hooks
      compiler.hooks.make.tap(pluginName, handleMake);
      compiler.hooks.emit.tap(pluginName, handleEmit);
      compiler.hooks.invalid.tap(pluginName, handleInvalid);
      compiler.hooks.done.tap(pluginName, updateConfigForDevMode);
    } else {
      compiler.plugin("make", handleMake);
      compiler.plugin("emit", handleEmit);
      compiler.plugin("invalid", handleInvalid);
      compiler.plugin("done", updateConfigForDevMode);
    }
  }
}

module.exports = { IsomorphicLoaderPlugin };
