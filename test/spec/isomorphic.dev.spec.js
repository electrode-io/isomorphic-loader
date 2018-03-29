"use strict";

const clone = require("clone");

const testInfo = {
  v3: {
    skip: false,
    webpack: "webpack@3.x.x",
    devServer: "webpack-dev-server@2.x.x",
    config: "../webpack.config"
  },
  v4: {
    skip: false,
    webpack: "webpack@4.x.x",
    devServer: "webpack-dev-server@3.x.x",
    config: "../webpack4.config"
  }
};

Object.keys(testInfo).forEach(ver => {
  const info = testInfo[ver];
  if (info.skip) return;
  describe(`isomorphic extend with webpack ${ver} & webpack-dev-server`, function() {
    this.timeout(10000);
    /*
     * This usage of require depends on fyn and flat-module
     */

    const webpack = require(info.webpack);
    const WebpackDevServer = require(info.devServer);
    const webpackConfig = clone(require(info.config));

    require("../lib/isomorphic.dev.spec")({
      tag: `webpack_${ver}`,
      webpack,
      WebpackDevServer,
      webpackConfig
    });
  });
});
