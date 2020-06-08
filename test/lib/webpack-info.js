"use strict";

const testInfo = {
  v4: {
    skip: false,
    xrequire: require,
    webpack: "webpack",
    devServer: "webpack-dev-server",
    config: require.resolve("../webpack.config")
  },
  v5: {
    skip: false,
    xrequire: require,
    webpack: "webpack",
    devServer: "webpack-dev-server",
    config: require.resolve("../webpack5/config")
  }
};

module.exports = testInfo;
