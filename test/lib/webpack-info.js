"use strict";

const testInfo = {
  v3: {
    skip: false,
    xrequire: require,
    webpack: "webpack",
    devServer: "webpack-dev-server",
    config: require.resolve("../webpack.config")
  },
  v4: {
    skip: false,
    xrequire: require("webpack4/xrequire"),
    webpack: "webpack",
    devServer: "webpack-dev-server",
    config: require.resolve("../webpack4.config")
  }
};

module.exports = testInfo;
