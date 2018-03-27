"use strict";

const IsomorphicLoaderPlugin = require("../lib/webpack-plugin");
const Path = require("path");

module.exports = {
  context: Path.resolve("test/client"),
  entry: "./entry.js",
  output: {
    path: Path.resolve("test/dist"),
    filename: "bundle.js",
    publicPath: "/test/"
  },
  plugins: [new IsomorphicLoaderPlugin({ webpackDev: { addUrl: false } })],
  module: {
    rules: [
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        loader: "file-loader!../.."
      },
      {
        test: /\.(ttf|eot)$/,
        loader: "file-loader!../.."
      }
    ]
  }
};
