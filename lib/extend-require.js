"use strict";

/* eslint-disable max-statements, max-len, complexity, prefer-template, no-magic-numbers */

const Module = require("module");
const fs = require("fs");
const Path = require("path");
const Config = require("./config");
const removeCwd = require("./remove-cwd");
const Pkg = require("../package.json");
const deepExtend = require("deep-extend");
const posixify = require("./posixify");
const lockConfig = require("./lock-config");
const logger = require("./logger");

const LOG_PREFIX = " > isomorphic-loader extend require:";

const VALID_CONFIG_STATE = "now VALID";
const INVALID_CONFIG_STATE = "INVALID!!";

const configFile = () => Path.resolve(Config.configFile);

let originalLoad;

class ExtendRequire {
  constructor() {
    this.assetsCount = 0;
    this.assets = {};
    this.config = undefined;
    this.userConfig = undefined;
    this.configFileWatcher = undefined;
  }

  reset() {
    this.deactivate();
    if (this.eventListener) {
      process.removeListener("message", this.eventListener);
      this.eventListener = undefined;
    }
    if (originalLoad) {
      Module._load = originalLoad;
      originalLoad = undefined;
    }
  }

  interceptLoad() {
    if (originalLoad) {
      return;
    }

    originalLoad = Module._load;

    const isAssetNotFound = request => {
      const x = Path.basename(request);
      return Object.keys(this.assets.marked).find(name => {
        return Path.basename(name).indexOf(x) >= 0;
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
            const sep =
              !config.webpackDev.url.endsWith("/") && !assetUrl.startsWith("/") ? "/" : "";
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
  }

  setAssets(a) {
    a = a || {};
    a.marked = a.marked || {};
    if (this.userConfig.processAssets) {
      a = this.userConfig.processAssets(a);
    }
    this.assets = a;
    this.assetsCount = Object.keys(a.marked).length;
  }

  _logConfigState(state, action) {
    if (Config.verbose || this._configState !== state) {
      this._configState = state;
      logger.log(LOG_PREFIX, "config is", state, "- " + action + " < ");
    }
  }

  _loadAssets(callback) {
    const result = {};

    const handleFileChangeEvent = event => {
      if (event !== "change") {
        logger.log(LOG_PREFIX, "unexpected config file watch event", event);
      } else {
        clearTimeout(this.reloading);

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
      if (!this.configFileWatcher && !this.eventListener) {
        this.configFileWatcher = fs.watch(configFile(), handleFileChangeEvent);
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
          `isomorphic-loader version ${Pkg.version} and config version ${result.config.version} mismatch`
        );
      }
    };

    const waitForValidConfig = () => {
      if (this.configFileWatcher) {
        return callback(new Error(Config.waitForValidMessage));
      } else if (!this.eventListener) {
        return setTimeout(() => {
          this._loadAssets(callback);
        }, Config.validPollInterval);
      } else {
        this.waitingForValidConfig = true;
      }
      return undefined;
    };

    const handleWebpackDev = () => {
      if (!result.config.webpackDev.skipSetEnv && !process.env.hasOwnProperty("WEBPACK_DEV")) {
        process.env.WEBPACK_DEV = "true";
      }

      if (!result.config.valid) {
        this._logConfigState(INVALID_CONFIG_STATE, "webpack dev server mode - waiting");
        return waitForValidConfig();
      }

      this.waitingForValidConfig = false;

      this._logConfigState(VALID_CONFIG_STATE, "webpack dev server mode");

      result.assets = result.config.assets;
      watchConfig();
      return callback(undefined, result);
    };

    const readAssets = (err, configData) => {
      try {
        if (err) {
          return callback(err);
        }
        parseConfig(configData);
        if (result.config.isWebpackDev) {
          return handleWebpackDev();
        } else {
          return fs.readFile(Path.resolve(result.config.assetsFile), parseAssets);
        }
      } catch (ex) {
        return callback(ex);
      } finally {
        if (!this.eventListener) {
          return lockConfig.unlock("read");
        }
      }
    };

    if (this.eventListener) {
      readAssets(null, this.configString);
    } else {
      lockConfig.lock("read", () => fs.readFile(configFile(), readAssets), callback);
    }
  }

  loadAssets(callback) {
    this._loadAssets((err, result) => {
      if (!err) {
        this.config = result.config;
        this.setAssets(result.assets);
      }
      callback(err);
    });
  }

  waitingNotice() {
    const now = Date.now();
    if (now - this.waitStart >= this.delay) {
      this._logConfigState("not ready", "waiting for config file to be generated.");
      this.waitStart = now;
      this.delay += 500;
      this.delay = Math.min(this.delay, 5000);
      if (now - this.started >= Config.waitConfigTimeout) {
        logger.error(LOG_PREFIX, `ERROR - unable to detect ${configFile()}`);
        logger.error(" >>>> please ensure webpack dev server is working properly.");
        return false;
      }
    }
    return true;
  }

  handleEventData(data) {
    if (data && data.name === "isomorphic-loader-config") {
      this.configString = data.config;
      this.loadAssets(err => {
        if (!err) {
          this.interceptLoad();
        } else {
          logger.log(LOG_PREFIX, "config event loadAssets failed\n", err);
        }
      });
    }
  }

  go(callback) {
    //
    // For development with a separate webpack dev server: check if we can use process event
    // to receive isomorphic config from the webpack plugin.
    //
    if (process.send) {
      const isProd = process.env.NODE_ENV === "production";
      // Generally process.send only exist if process was started by another
      // node.js process, so this is the first criteria to be able to receive messages.
      // *but*, in production deployment, app could be started by a process manager
      // that sets process.send, so we have to not be in prod mode or that user has
      // configured to force config from events:
      const useEvents = Boolean(!isProd || this.userConfig.forceConfigFromEvents);

      if (useEvents) {
        // Now we have determined that we want to be watching for isomorphic
        // config through process messages, setup listener if it's not done yet.
        if (this.eventListener === undefined) {
          this.eventListener = data => this.handleEventData(data);
          process.on("message", this.eventListener);
        }
        return process.nextTick(callback);
      }
    }

    // - We don't have config yet, so check:
    // - Do we have to wait for it from events?
    // - If not from events, is there a config file on disk?
    if (!this.config && !fs.existsSync(configFile())) {
      // If we've been instructed to not wait for config
      // Or we are in production mode and not expecting to wait for config from events
      // => fail app server
      if (!this.waitingNotice()) {
        return callback(new Error("isomorphic-loader config not found"));
      }
      return setTimeout(() => {
        this.go(callback);
      }, Config.pollConfigInterval);
    } else {
      // no config, no from events, found file: read it.
      return this.loadAssets(err => {
        if (!err) {
          this.interceptLoad();
        }
        callback(err);
      });
    }
  }

  deactivate() {
    this.config = undefined;
    this.assetsCount = 0;
    if (this.configFileWatcher) {
      this.configFileWatcher.close();
      this.configFileWatcher = undefined;
    }
  }

  extend(userConfig, callback) {
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
  }
}

const instance = new ExtendRequire();

const extendRequire = (userConfig, callback) => instance.extend(userConfig, callback);

extendRequire.loadAssets = callback => instance.loadAssets(callback);

extendRequire.deactivate = () => instance.deactivate();

extendRequire.reset = () => instance.reset();

extendRequire._instance = instance;

module.exports = extendRequire;
