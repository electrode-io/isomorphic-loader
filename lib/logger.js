"use strict";

function log() {
  console.log.apply(console, arguments); // eslint-disable-line
}

function error() {
  console.error.apply(console, arguments); // eslint-disable-line
}

module.exports = { log: log, error: error };
