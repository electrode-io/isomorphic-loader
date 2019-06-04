"use strict";

const lockFile = require("lockfile");
const logger = require("./logger");
const Path = require("path");

const Config = require("./config");

const lockFileName = () => Path.resolve(Config.lockFile);

const lockOptions = () => ({
  wait: Config.lockFileWait,
  retries: Config.lockFileRetries,
  retryWait: Config.lockFileRetryWait,
  pollPeriod: Config.lockFilePollInterval,
  stale: Config.lockFileStale
});

module.exports = {
  unlock(tag, unlocked) {
    // lockfile.unlock doesn't pass err back to callback
    return lockFile.unlock(lockFileName(), unlocked);
  },

  lock(tag, locked, fail) {
    const fn = lockFileName();
    return lockFile.lock(fn, lockOptions(), err => {
      if (err) {
        logger.error(`Can't acquire lock for ${tag}`, fn, err);
        return fail && fail(err);
      }

      return locked && locked();
    });
  }
};
