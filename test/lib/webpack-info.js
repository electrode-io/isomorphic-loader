"use strict";

const testInfo = {
  v4: {
    skip: false,
    xrequire: require("webpack4/xrequire"),
    webpack: "webpack",
    devServer: "webpack-dev-server",
    config: require.resolve("../webpack4.config")
  },
  v3: {
    skip: false,
    xrequire: require,
    webpack: "webpack",
    devServer: "webpack-dev-server",
    config: require.resolve("../webpack.config")
  }
};

module.exports = testInfo;
