"use strict";

module.exports = function(content) {
  this.cacheable && this.cacheable();
  return content;
};

module.exports.raw = true;
