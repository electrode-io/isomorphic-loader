"use strict";

var cwd = process.cwd();

module.exports = function removeCwd(path, last) {
  var x = last ? path.lastIndexOf(cwd) : path.indexOf(cwd);

  if (x >= 0) {
    return path.substr(x + cwd.length + 1);
  }

  return path;
};
