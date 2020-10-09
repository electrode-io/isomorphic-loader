"use strict";

const clone = require("clone");
const webpackInfo = require("../lib/webpack-info");

Object.keys(webpackInfo).forEach(ver => {
  const info = webpackInfo[ver];
  if (info.skip) return;

  const xrequire = info.xrequire;
  const webpack = xrequire(info.webpack);
  const WebpackDevServer = xrequire(info.devServer);
  const webpackConfig = clone(xrequire(info.config));

  require("../lib/isomorphic.dev.spec")({
    title: `isomorphic extend with webpack ${ver} & webpack-dev-server`,
    tag: `webpack_${ver}`,
    timeout: 10000,
    webpack,
    WebpackDevServer,
    webpackConfig
  });
});
