"use strict";

/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

module.exports = function copy(dest, src) {
    if (typeof dest === "object" && typeof src === "object") {
        Object.keys(src).forEach(function (k) {
            dest[k] = src[k];
        });
    }

    return dest;
};
