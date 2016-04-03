/*
 * MIT License http://www.opensource.org/licenses/mit-license.php
 */

var IsomorphicLoaderPlugin = require("../lib/webpack-plugin");
var Path = require("path");

module.exports = {
    context: Path.resolve("test/client"),
    entry: "./entry.js",
    output: {
        path: Path.resolve("test/dist"),
        filename: "bundle.js",
        publicPath: "/test/"
    },
    plugins: [
        new IsomorphicLoaderPlugin({webpackDev: {addUrl: false}})
    ],
    module: {
        loaders: [
            {
                name: "images",
                test: /\.(jpe?g|png|gif|svg)$/i,
                loader: "file!../.."
            },
            {
                name: "fonts",
                test: /\.(ttf|eot)$/,
                loader: "file!../.."
            }
        ]
    }
};
