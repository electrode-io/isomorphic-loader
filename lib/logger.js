"use strict";

const LEVELS = {
  info: 10,
  error: 99,
  none: 999
};

let LEVEL = LEVELS.info;

function log() {
  if (LEVEL <= LEVELS.info) {
    console.log.apply(console, arguments); // eslint-disable-line
  }
}

function error() {
  if (LEVEL <= LEVELS.error) {
    console.error.apply(console, arguments); // eslint-disable-line
  }
}

module.exports = { log: log, error: error, setLevel: l => (LEVEL = LEVELS[l] || LEVELS.info) };
