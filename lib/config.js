"use strict";

/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

module.exports = {
    configFile: ".isomorphic-loader-config.json",
    lockFile: ".isomorphic-loader-config.lock",
    defaultAssetsFile: "isomorphic-assets.json",
    pollConfigInterval: 200,
    initialWaitingNoticeDelay: 5000, // ms to wait before printing the waiting for config notice
    reloadDelay: 10, // ms to wait before loading after config file change detected
    defaultStartDelay: 300, // ms to wait before starting
    lockFilePollInterval: 50,  // ms to poll lock file being gone
    validPollInterval: 500 // ms to poll for config to be valid
};
