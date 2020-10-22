"use strict";

const { IsomorphicLoaderPlugin } = require("..");
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
        use: [{ loader: "electrode-cdn-file-loader", options: { limit: 10000 } }, "../.."]
      },
      {
        test: /\.(ttf|eot)$/,
        use: [{ loader: "electrode-cdn-file-loader", options: { limit: 10000 } }, "../.."]
      }
    ]
  },
  resolve: {
    alias: {
      smiley2Jpg: Path.join(__dirname, "./nm/smiley2.jpg")
    }
  }
};
