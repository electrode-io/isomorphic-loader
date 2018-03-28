"use strict";

module.exports = {
  configFile: ".isomorphic-loader-config.json",
  lockFile: ".isomorphic-loader-config.lock",
  defaultAssetsFile: "isomorphic-assets.json",
  pollConfigInterval: 200,
  initialWaitingNoticeDelay: 1000, // ms to wait before printing the waiting for config notice
  reloadDelay: 250, // ms to wait before loading after config file change detected
  defaultStartDelay: 500, // ms to wait before starting
  lockFilePollInterval: 50, // ms to poll lock file being gone
  validPollInterval: 1000, // ms to poll for config to be valid
  waitForValidMessage: "wait for valid config",
  waitConfigTimeout: 5000,
  // ms to wait before start writing config file when using webpack-dev-server
  writeConfigDelay: 500,
  verbose: false
};
