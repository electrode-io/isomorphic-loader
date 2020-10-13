"use strict";

const { ExtendRequire } = require("./extend-require");
const { IsomorphicLoaderPlugin } = require("./webpack-plugin");
const IsomorphicLoader = require("./isomorphic-loader");

/**
 * Initialize node.js extend require to handle isomorphic assets in SSR
 * @param {*} options - options
 * @param {*} isomorphicConfig - isomorphic config data
 *
 * @returns {*} an instance of ExtendRequire
 */
function extendRequire(options, isomorphicConfig) {
  const extReq = new ExtendRequire(options);

  if (isomorphicConfig) {
    extReq.initialize(isomorphicConfig);
  } else if (!process.env.hasOwnProperty("WEBPACK_DEV")) {
    //
    // don't try to load assets in webpack dev mode, because there could be an outdated
    // and staled dist directory with a config file that's bad.  User may have
    // updated dependencies and run dev but didn't do a build to update dist yet, and
    // that could cause loading the assets to have unexpected failures
    //
    extReq.loadAssets();
  }

  return extReq;
}

IsomorphicLoader.extendRequire = extendRequire;
IsomorphicLoader.ExtendRequire = ExtendRequire;
IsomorphicLoader.IsomorphicLoaderPlugin = IsomorphicLoaderPlugin;

const GLOBAL_INSTANCE = Symbol.for("isomorphic-loader-global-extend-require");

IsomorphicLoader.setXRequire = instance => (global[GLOBAL_INSTANCE] = instance);
IsomorphicLoader.getXRequire = () => global[GLOBAL_INSTANCE];

module.exports = IsomorphicLoader;
