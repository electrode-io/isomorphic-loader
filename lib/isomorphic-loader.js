"use strict";

const { getCssModuleGlobalMapping } = require("./utils");

module.exports = function (content) {
  const userRequest = (this._module && this._module.userRequest) || "";
  if (/\.(css|less|styl|sass|scss)$/.test(userRequest)) {
    const mapping = getCssModuleGlobalMapping();
    mapping[userRequest] = content.toString("utf-8");
  }
  this.cacheable && this.cacheable(); // eslint-disable-line
  return content;
};

module.exports.raw = true;
