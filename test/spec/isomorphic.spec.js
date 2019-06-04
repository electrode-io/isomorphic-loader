"use strict";

const clone = require("clone");
const webpackInfo = require("../lib/webpack-info");

Object.keys(webpackInfo).forEach(ver => {
  const info = webpackInfo[ver];
  if (info.skip) return;
  describe(`isomorphic extend with webpack ${ver}`, function() {
    this.timeout(20000);
    const webpack = info.xrequire(info.webpack);
    const webpackConfig = clone(info.xrequire(info.config));
    require("../lib/isomorphic.spec")({
      tag: `webpack_${ver}`,
      webpack,
      webpackConfig
    });
  });
});
