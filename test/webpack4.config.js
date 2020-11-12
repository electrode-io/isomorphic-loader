"use strict";

const { IsomorphicLoaderPlugin } = require("..");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const Path = require("path");

module.exports = {
  context: Path.resolve("test/client"),
  entry: "./entry.js",
  output: {
    path: Path.resolve("test/dist"),
    filename: "bundle.js",
    publicPath: "/test/"
  },
  plugins: [
    new IsomorphicLoaderPlugin({ webpackDev: { addUrl: false } }),
    new MiniCssExtractPlugin({ filename: "[name].style.css" })
  ],
  module: {
    rules: [
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        loader: "file-loader!../.."
      },
      {
        test: /\.(ttf|eot)$/,
        loader: "file-loader!../.."
      },
      {
        test: /\.css$/,
        use: [
          "../..",
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              publicPath: "",
              esModule: false,
              modules: true
            }
          },
          {
            loader: "css-loader",
            options: {
              context: Path.resolve("test/client"),
              modules: true,
              localIdentName: "[name]__[local]"
            }
          }
        ]
      }
    ]
  },
  resolve: {
    alias: {
      smiley2Jpg: Path.join(__dirname, "./nm/smiley2.jpg"),
      demoCss: Path.join(__dirname, "./nm/demo.css")
    }
  }
};
