"use strict";

/* eslint-disable no-unused-expressions, prefer-template, no-magic-numbers, max-statements */

// https://webpack.github.io/docs/how-to-write-a-plugin.html

const Path = require("path");
const Config = require("./config");
const {
  getWebpackRequest,
  removeLoaders,
  removeCwd,
  replaceAppSrcDir,
  getCssModuleGlobalMapping,
  getMyNodeModulesPath,
  requireFromString
} = require("./utils");
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
    this.options = { cwd: process.cwd(), assetsFile: "isomorphic-assets.json", ...options };

    const directJs = Path.posix.join(getMyNodeModulesPath(), "index.js!");
    this._loaderSigs = [directJs, `isomorphic-loader/lib/index.js!`, `isomorphic-loader!`];
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
        context: removeCwd(compilerOpts.context, false, this.options.cwd),
        output: {
          path: removeCwd(compilerOpts.output.path, false, this.options.cwd),
          filename: removeCwd(compilerOpts.output.filename, false, this.options.cwd),
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

    const handleEmit = (compilation, webpackAssets) => {
      const stats = compilation.getStats().toJson();

      const marked = stats.modules.reduce((acc, m) => {
        const ident = posixify(m.identifier);
        const foundSig = this._loaderSigs.find(sig => ident.includes(sig));
        if (foundSig && m.assets && m.assets.length > 0) {
          const userRequest = removeLoaders(getWebpackRequest(m));

          let requestMarkKey;
          // if userRequest starts with ., it's a relative path, so try to reconstruct its
          // full path by joining it with the issuer path
          // npm module name can't start with ., so it's not needed to check ./ or ../
          if (userRequest.startsWith(".")) {
            const issuerPath = posixify(
              Path.dirname(removeCwd(removeLoaders(m.issuer), true, this.options.cwd))
            );
            // require paths always use / so use posix path
            requestMarkKey = Path.posix.join(issuerPath, userRequest);
          } else {
            // no need to worry about target's location relative to issuer's location, just
            // use full identifier path directly
            requestMarkKey = posixify(
              removeCwd(removeLoaders(m.identifier), false, this.options.cwd)
            );
          }

          acc[replaceAppSrcDir(requestMarkKey, this.options.appSrcDir)] =
            m.assets[m.assets.length - 1];
        }

        return acc;
      }, {});

      const cssModuleMap = getCssModuleGlobalMapping();
      Object.keys(cssModuleMap).forEach(userRequest => {
        const requestKey = posixify(removeCwd(userRequest, false, this.options.cwd));
        const content = requireFromString(cssModuleMap[userRequest]);
        marked[replaceAppSrcDir(requestKey, this.options.appSrcDir)] = content;
      });

      const assets = {
        marked,
        chunks: stats.assetsByChunkName
      };

      const config = createConfig(compiler.options, assets);
      config.valid = true;

      const configStr = JSON.stringify(config, null, 2) + "\n";

      webpackAssets[this.options.assetsFile] = {
        source: () => configStr,
        size: () => configStr.length
      };

      this.config = config;
    };

    const handleMake = (compilation, callback) => {
      this.config = createConfig(compiler.options);

      // If running in webpack dev server mode, then create a config file ASAP so not to leave
      // extend require waiting.
      updateConfigForDevMode();

      /* istanbul ignore next */
      if (compilation.hooks && compilation.hooks.processAssets) {
        // handle emit for webpack 5
        /* istanbul ignore next */
        compilation.hooks.processAssets.tap(pluginName, assets => handleEmit(compilation, assets));
      }

      /* istanbul ignore next */
      callback && callback();
    };

    const handleInvalid = () => {
      this.config.valid = false;
      updateConfigForDevMode();
    };

    /* istanbul ignore else */
    if (compiler.hooks) {
      // use .hooks
      compiler.hooks.make.tap(pluginName, handleMake);
      compiler.hooks.emit.tap(pluginName, compilation => {
        // handle emit for webpack 4
        /* istanbul ignore else */
        if (!compilation.hooks.processAssets) {
          handleEmit(compilation, compilation.assets);
        }
      });
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
