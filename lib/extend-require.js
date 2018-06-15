"use strict";

/* eslint-disable max-statements, complexity, prefer-template, no-magic-numbers */

const Module = require("module");
const fs = require("fs");
const Path = require("path");
const Config = require("./config");
const removeCwd = require("./remove-cwd");
const Pkg = require("../package.json");
const deepExtend = require("deep-extend");
const posixify = require("./posixify");

const LOG_PREFIX = " > isomorphic-loader extend require:";

const VALID_CONFIG_STATE = "now VALID";
const INVALID_CONFIG_STATE = "INVALID!!";

const configFile = Path.resolve(Config.configFile);
const lockFile = Path.resolve(Config.lockFile);

function ExtendRequire() {
  this.assetsCount = 0;
  this.assets = {};
  this.config = undefined;
  this.userConfig = undefined;
  this.configFileWatcher = undefined;
}

const logger = require("./logger");

let originalLoad;

ExtendRequire.prototype.interceptLoad = function interceptLoad() {
  if (originalLoad) {
    return;
  }

  originalLoad = Module._load;

  const isAssetNotFound = request => {
    const x = Path.basename(request);
    return Object.keys(this.assets.marked).find(name => {
      return name.indexOf(x) >= 0;
    });
  };

  const checkAsset = (moduleInstance, request, parent) => {
    const config = this.config;
    if (config && config.output && this.assetsCount > 0) {
      const loaderIndex = request.lastIndexOf("!");
      let xRequest = loaderIndex > 0 ? request.substr(loaderIndex + 1) : request;
      xRequest = xRequest.trim();
      if (parent && parent.filename && xRequest.startsWith(".")) {
        xRequest = Path.join(Path.dirname(parent.filename), xRequest);
      }
      let resolved;
      try {
        resolved = posixify(removeCwd(moduleInstance._resolveFilename(xRequest, parent)));
      } catch (e) {
        if (isAssetNotFound(xRequest)) {
          logger.log(LOG_PREFIX, "check asset " + xRequest + " exception", e);
        }
        return undefined;
      }
      let assetUrl = this.assets.marked[resolved];

      if (assetUrl) {
        assetUrl = config.output.publicPath + assetUrl;

        if (config.isWebpackDev && config.webpackDev.addUrl && config.webpackDev.url) {
          const sep = !config.webpackDev.url.endsWith("/") && !assetUrl.startsWith("/") ? "/" : "";
          assetUrl = config.webpackDev.url + sep + assetUrl;
        }

        return assetUrl;
      }
    }

    return undefined;
  };

  Module._load = function(request, parent, isMain) {
    const a = checkAsset(this, request, parent);
    if (a !== undefined) {
      return a;
    }

    return originalLoad.apply(this, [request, parent, isMain]);
  };
};

ExtendRequire.prototype.setAssets = function setAssets(a) {
  a = a || {};
  a.marked = a.marked || {};
  if (this.userConfig.processAssets) {
    a = this.userConfig.processAssets(a);
  }
  this.assets = a;
  this.assetsCount = Object.keys(a.marked).length;
};

ExtendRequire.prototype._logConfigState = function(state, action) {
  if (Config.verbose || this._configState !== state) {
    this._configState = state;
    logger.log(LOG_PREFIX, "config is", state, "- " + action + " < ");
  }
};

ExtendRequire.prototype._loadAssets = function _loadAssets(callback) {
  const result = {};

  const handleFileChangeEvent = event => {
    if (event !== "change") {
      logger.log(LOG_PREFIX, "unexpected config file watch event", event);
    } else {
      if (this.reloading) {
        clearTimeout(this.reloading);
      }

      this.reloading = setTimeout(() => {
        this.reloading = undefined;
        this._loadAssets((err2, res) => {
          if (!err2) {
            if (this.config && res.config.timestamp <= this.config.timestamp) {
              this._logConfigState(VALID_CONFIG_STATE, "skip reload. timestamp did not change");
              return;
            }
            this.config = res.config;
            this.setAssets(this.config.assets);
            this._logConfigState(VALID_CONFIG_STATE, "refreshed");
          } else if (err2.message === Config.waitForValidMessage) {
            this._logConfigState(INVALID_CONFIG_STATE, "watching for valid change");
          } else {
            logger.log(LOG_PREFIX, "file watcher load assets error", err2);
          }
        });
      }, Config.reloadDelay);
    }
  };

  const watchConfig = () => {
    if (!this.configFileWatcher) {
      this.configFileWatcher = fs.watch(configFile, handleFileChangeEvent);
    }
  };

  const parseAssets = (err, assetsData) => {
    if (!err) {
      try {
        result.assets = JSON.parse(assetsData);
      } catch (ex) {
        err = ex;
      }
    }

    callback(err, result);
  };

  const parseConfig = configData => {
    result.config = JSON.parse(configData);
    deepExtend(result.config, this.userConfig);

    if (result.config.version !== Pkg.version) {
      throw new Error(
        "isomorphic-loader version and `.isomorphic-loader-config.json` version does not mismatch"
      );
    }
  };

  const waitForValidConfig = () => {
    if (this.configFileWatcher) {
      return callback(new Error(Config.waitForValidMessage));
    } else {
      return setTimeout(() => {
        this._loadAssets(callback);
      }, Config.validPollInterval);
    }
  };

  const handleWebpackDev = () => {
    if (!result.config.webpackDev.skipSetEnv) {
      process.env.WEBPACK_DEV = "true";
    }

    if (!result.config.valid) {
      this._logConfigState(INVALID_CONFIG_STATE, "webpack dev server mode - waiting");
      return waitForValidConfig();
    }

    this._logConfigState(VALID_CONFIG_STATE, "webpack dev server mode");

    result.assets = result.config.assets;
    watchConfig();
    return callback(undefined, result);
  };

  const readAssets = (err, configData) => {
    if (err) {
      return callback(err);
    }

    try {
      parseConfig(configData);
      if (result.config.isWebpackDev) {
        return handleWebpackDev();
      } else {
        return fs.readFile(Path.resolve(result.config.assetsFile), parseAssets);
      }
    } catch (ex) {
      return callback(ex);
    }
  };

  if (fs.existsSync(lockFile)) {
    setTimeout(() => {
      this._loadAssets(callback);
    }, Config.lockFilePollInterval);
  } else {
    fs.readFile(configFile, readAssets);
  }
};

ExtendRequire.prototype.loadAssets = function loadAssets(callback) {
  this._loadAssets((err, result) => {
    if (!err) {
      this.config = result.config;
      this.setAssets(result.assets);
    }
    callback(err);
  });
};

ExtendRequire.prototype.waitingNotice = function waitingNotice() {
  const now = Date.now();
  if (now - this.waitStart >= this.delay) {
    this._logConfigState("not ready", "waiting for config file to be generated.");
    this.waitStart = now;
    this.delay += 500;
    this.delay = Math.min(this.delay, 5000);
    if (now - this.started >= Config.waitConfigTimeout) {
      logger.log(LOG_PREFIX, "ERROR - unable to detect " + configFile);
      logger.log(
        " >>>> If you are running with webpack dev server, please make sure that is working properly." // eslint-disable-line
      );
      return false;
    }
  }
  return true;
};

ExtendRequire.prototype.go = function go(callback) {
  if (!this.config && !fs.existsSync(configFile)) {
    if (!this.waitingNotice()) {
      return callback(new Error("isomorphic-loader config not found"));
    }
    return setTimeout(() => {
      this.go(callback);
    }, Config.pollConfigInterval);
  } else {
    return this.loadAssets(err => {
      if (!err) {
        this.interceptLoad();
      }
      callback(err);
    });
  }
};

ExtendRequire.prototype.deactivate = function deactivate() {
  this.config = undefined;
  this.assetsCount = 0;
  if (this.configFileWatcher) {
    this.configFileWatcher.close();
    this.configFileWatcher = undefined;
  }
};

ExtendRequire.prototype.extend = function extend(userConfig, callback) {
  this.waitStart = this.started = Date.now();
  this.delay = Config.initialWaitingNoticeDelay;

  if (typeof userConfig === "function") {
    callback = userConfig;
    userConfig = undefined;
  }

  this.userConfig = userConfig || {};

  const startDelay = isNaN(this.userConfig.startDelay)
    ? Config.defaultStartDelay
    : this.userConfig.startDelay;

  if (typeof Promise !== "undefined" && !callback) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this.go(err => {
          return err ? reject(err) : resolve();
        });
      }, startDelay);
    });
  }

  return setTimeout(() => {
    this.go(callback);
  }, startDelay);
};

const instance = new ExtendRequire();

function extendRequire(userConfig, callback) {
  return instance.extend(userConfig, callback);
}

extendRequire.loadAssets = function(callback) {
  return instance.loadAssets(callback);
};

extendRequire.deactivate = function() {
  return instance.deactivate();
};

extendRequire._instance = instance;

module.exports = extendRequire;
