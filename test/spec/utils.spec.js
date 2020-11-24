"use strict";

const Path = require("path");
const utils = require("../../lib/utils");

describe("utils", function() {
  describe("getParentPath", function() {
    it("should return path if it exist", () => {
      expect(utils.getParentPath({ path: "/test" })).to.equal("/test");
    });

    it("should return dirname of filename if only that exist", () => {
      expect(utils.getParentPath({ filename: "/test/foo.txt" })).to.equal("/test");
    });

    it(`should return "" if nothing exist`, () => {
      expect(utils.getParentPath()).to.equal("");
      expect(utils.getParentPath({})).to.equal("");
    });
  });

  describe("getWebpackRequest", function() {
    it("should return userRequest", () => {
      expect(utils.getWebpackRequest({ reasons: [{ userRequest: "test" }] })).to.equal("test");
    });

    it(`should return "" if can't find userRequest`, () => {
      expect(utils.getWebpackRequest()).to.equal("");
      expect(utils.getWebpackRequest({})).to.equal("");
      expect(utils.getWebpackRequest({ reasons: [] })).to.equal("");
    });
  });

  describe("replaceAppSrcDir", function() {
    it("should return request without appSrcDir", () => {
      expect(utils.replaceAppSrcDir("test")).to.equal("test");
    });

    it("should return request if appSrcDir not match", () => {
      expect(utils.replaceAppSrcDir("test/hello", "src")).to.equal("test/hello");
    });

    it("should replace request with appSrcDir if match", () => {
      expect(utils.replaceAppSrcDir("test/hello", "test")).to.equal("$AppSrc/hello");
      expect(utils.replaceAppSrcDir("test/hello", "test/")).to.equal("$AppSrc/hello");
    });
  });

  describe("removeCwd", function() {
    it("should remove process.cwd() from path", () => {
      expect(utils.removeCwd(Path.resolve("test"))).to.equal("test");
    });
  });

  describe("requireFromString", function() {
    it("should load module from string", () => {
      const result = utils.requireFromString("module.exports = { test: 'abc'}");
      expect(result).to.deep.equal({ test: "abc" });
    });
  });

  describe("getMyNodeModulesPath", function() {
    it("should find simple path", () => {
      expect(utils.getMyNodeModulesPath("/test/node_modules/isomorphic-loader/lib")).equals(
        "isomorphic-loader/lib"
      );
    });

    it("should return up to 4 parts path if dir doesn't contain name", () => {
      expect(utils.getMyNodeModulesPath("/test/node_modules/123456789/lib")).equals(
        "test/node_modules/123456789/lib"
      );
      expect(utils.getMyNodeModulesPath("/foo/blah/test/node_modules/123456789/lib")).equals(
        "test/node_modules/123456789/lib"
      );
      expect(utils.getMyNodeModulesPath("/foo/123456789/lib")).equals("/foo/123456789/lib");
    });

    it("should find path with extras between name", () => {
      expect(utils.getMyNodeModulesPath("/test/node_modules/isomorphic-loader/123/lib")).equals(
        "isomorphic-loader/123/lib"
      );
    });
  });
});
