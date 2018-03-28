"use strict";

const clone = require("clone");

describe("isomorphic extend with webpack v3 & webpack-dev-server", function() {
  if (this.pending) return;
  this.timeout(10000);
  /*
   * This usage of require depends on fyn and flat-module
   */

  const webpack = require("webpack@3.x.x");
  const WebpackDevServer = require("webpack-dev-server@2.x.x");
  const webpackConfig = clone(require("../webpack.config"));

  require("../lib/isomorphic.dev.spec")({
    tag: "webpack3",
    webpack,
    WebpackDevServer,
    webpackConfig
  });
});
