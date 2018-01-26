"use strict";

function log() {
  console.log.apply(console, arguments); // eslint-disable-line
}

module.exports = { log: log };
