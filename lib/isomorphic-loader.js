"use strict";

module.exports = function(content) {
  this.cacheable && this.cacheable(); // eslint-disable-line
  return content;
};

module.exports.raw = true;
