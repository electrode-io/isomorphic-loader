"use strict";

const Path = require("path");
const posixify = require("./posixify");

const CSS_MODULE_MAPPINGS = Symbol.for("css-module-content-mapping");

/**
 * Get the path of a parent module that's making a require call
 *
 * @param {*} parent module
 * @returns {string} parent module's path
 */
exports.getParentPath = parent => {
  return (
    (parent && posixify(parent.path || (parent.filename && Path.dirname(parent.filename)))) || ""
  );
};

/**
 * Get the verbatim string as passed to require that webpack processed
 * @param {*} mod module
 * @returns {string} require request
 *
 */
exports.getWebpackRequest = mod => {
  const reason = mod && mod.reasons && mod.reasons[0];
  return (reason && reason.userRequest) || "";
};

/**
 * Remove CWD from path
 * @param {*} path - path
 * @param {*} last - if true then use lastIndexOf to search
 * @param {string} cwd - optional current working dir
 * @returns {string} new path
 */
exports.removeCwd = (path, last, cwd = process.cwd()) => {
  const x = last ? path.lastIndexOf(cwd) : path.indexOf(cwd);

  if (x >= 0) {
    return path.substr(x + cwd.length + 1);
  }

  return path;
};

/**
 * remove webpack loader marks like "file-loader!" from a require request
 *
 * @param {string} request - require request
 * @returns {string} request without webpack loader marks
 */
exports.removeLoaders = request => {
  const markIx = request.lastIndexOf("!");
  if (markIx >= 0) {
    return request.substr(markIx + 1);
  }
  return request;
};

/**
 * Replace app src dir in request path with a consistent marker
 *
 * @param {string} request - require request
 * @param {string} appSrcDir - app src dir
 * @returns {string} updated request
 */
exports.replaceAppSrcDir = (request, appSrcDir) => {
  if (appSrcDir) {
    const asd = Path.posix.join(appSrcDir, "/");
    return request.replace(new RegExp(`^${asd}`), "$AppSrc/");
  }
  return request;
};

/**
 * Returns local to global classnames mapping for css modules
 *
 * @returns {object} mapping object
 */
exports.getCssModuleGlobalMapping = () => {
  if (!global[CSS_MODULE_MAPPINGS]) {
    global[CSS_MODULE_MAPPINGS] = {};
  }

  return global[CSS_MODULE_MAPPINGS];
};

/**
 * Load node.js module from string
 *
 * @param {string} src - file's content
 * @param {string} filename - optional filename
 * @returns {object} exported object
 */
exports.requireFromString = (src, filename = "") => {
  const Module = module.constructor;
  const m = new Module();
  m._compile(src, filename);
  return m.exports;
};
