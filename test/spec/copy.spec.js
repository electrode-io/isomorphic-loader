"use strict";

/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

var copy = require("../../lib/copy");
var chai = require("chai");

describe("copy", function () {
    it("should skip non object", function () {
        chai.expect(copy()).to.equal(undefined);
    });

    it("should copy props from object", function () {
        chai.expect(copy({a: 0, b: 2}, {a: 1, c: 3})).to.deep.equal({a: 1, b: 2, c: 3});
    });

    it("should not copy props from non object", function () {
        chai.expect(copy({a: 0, b: 2})).to.deep.equal({a: 0, b: 2});
    });
});

