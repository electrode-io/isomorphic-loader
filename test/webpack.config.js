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
        new IsomorphicLoaderPlugin()
    ],
    module: {
        loaders: [
            {
                test: /\.(jpe?g|png|gif|svg)$/i,
                loader: "file!../.."
            }
        ]
    }
};
