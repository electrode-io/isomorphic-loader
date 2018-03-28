"use strict";

/* istanbul ignore next */

module.exports = process.platform.startsWith("win32") ? p => p.replace(/\\/g, "/") : p => p;
