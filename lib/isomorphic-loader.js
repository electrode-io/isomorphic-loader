"use strict";

/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

module.exports = function (content) {
    this.cacheable && this.cacheable();
    return content;
};

module.exports.raw = true;
