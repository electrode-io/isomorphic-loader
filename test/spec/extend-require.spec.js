"use strict";

const { ExtendRequire } = require("../../lib/extend-require");
const Pkg = require("../../package.json");
const { asyncVerify, runFinally, expectError } = require("run-verify");
const xstdout = require("xstdout");

describe("extend-require", function() {
  it("should log error if require on non-path request is asset that doesn't exist", () => {
    const extendRequire = new ExtendRequire({});
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      () => {
        extendRequire.initialize({
          version: Pkg.version,
          assets: {
            marked: {
              "blah-test": "test"
            }
          },
          output: {
            publicPath: ""
          }
        });
      },
      expectError(() => {
        require("blah-test");
      }),
      error => {
        expect(error.code).equal("MODULE_NOT_FOUND");
        expect(intercept.stderr.join("")).contains(
          `isomorphic-loader check asset blah-test exception`
        );
      },
      runFinally(() => {
        intercept.restore();
        extendRequire.reset();
      })
    );
  });

  it("should prepend publicPath from config", () => {
    const extendRequire = new ExtendRequire({});

    return asyncVerify(
      () => {
        extendRequire.initialize({
          version: Pkg.version,
          assets: {
            marked: {
              "test/nm/smiley2.jpg": "test.jpg"
            }
          },
          output: {
            publicPath: "/blah/"
          }
        });
      },
      () => require("../nm/smiley2.jpg"),
      assetUrl => {
        expect(assetUrl).equals("/blah/test.jpg");
      },
      runFinally(() => {
        extendRequire.reset();
      })
    );
  });

  it("should prepend custom publicPath", () => {
    const extendRequire = new ExtendRequire({});

    return asyncVerify(
      () => {
        extendRequire.initialize({
          version: Pkg.version,
          assets: {
            marked: {
              "test/nm/smiley2.jpg": "test.jpg"
            }
          },
          output: {
            publicPath: "/blah/"
          }
        });
        extendRequire.setPublicPath("/foo/");
      },
      () => require("../nm/smiley2.jpg"),
      assetUrl => {
        expect(assetUrl).equals("/foo/test.jpg");
      },
      runFinally(() => {
        extendRequire.reset();
      })
    );
  });

  it("should use custom url map", () => {
    const extendRequire = new ExtendRequire({});

    return asyncVerify(
      () => {
        extendRequire.initialize({
          version: Pkg.version,
          assets: {
            marked: {
              "test/nm/smiley2.jpg": "test.jpg"
            }
          },
          output: {
            publicPath: "/blah/"
          }
        });
        extendRequire.setUrlMapper(url => "/woop/" + url); // eslint-disable-line
      },
      () => require("../nm/smiley2.jpg"),
      assetUrl => {
        expect(assetUrl).equals("/woop/test.jpg");
      },
      runFinally(() => {
        extendRequire.reset();
      })
    );
  });

  it("should log error urlMap throws", () => {
    const extendRequire = new ExtendRequire({});
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      () => {
        extendRequire.initialize({
          version: Pkg.version,
          assets: {
            marked: {
              "test/nm/smiley2.jpg": "test.jpg"
            }
          },
          output: {
            publicPath: ""
          }
        });
        extendRequire.setUrlMapper(() => {
          throw new Error("test oops");
        });
      },
      () => require("../nm/smiley2.jpg"),
      assetUrl => {
        intercept.restore();
        expect(assetUrl).equals("test.jpg");

        expect(intercept.stderr.join("")).contains("urlMap thrown error Error: test oops");
      },
      runFinally(() => {
        intercept.restore();
        extendRequire.reset();
      })
    );
  });

  it("should return object for css", () => {
    const extendRequire = new ExtendRequire({});

    return asyncVerify(
      () => {
        extendRequire.initialize({
          version: Pkg.version,
          assets: {
            marked: {
              "test/nm/demo.css": { "demo": "abc" }
            }
          },
          output: {
            publicPath: "/blah/"
          }
        });
      },
      () => require("../nm/demo.css"),
      assetUrl => {
        expect(assetUrl).deep.equals({ "demo": "abc" });
      },
      runFinally(() => {
        extendRequire.reset();
      })
    );
  });

  it("should be ok to reset before initializing", () => {
    const extendRequire = new ExtendRequire();
    extendRequire.reset();
    // no error => good
  });
});
