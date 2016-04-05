"use strict";

/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

module.exports = {
    configFile: ".isomorphic-loader-config.json",
    defaultAssetsFile: "isomorphic-assets.json",
    pollConfigInterval: 200,
    initialWaitingNoticeDelay: 5000, // ms to wait before printing the waiting for config notice
    reloadDelay: 10 // ms to wait before loading after config file change detected
};
