# Webpack Isomorphic Loader

Webpack loader and tools to extend NodeJS `require` so it understands your Web asset files such as images when you are doing server side rendering.


## Install

```
$ npm install isomorphic-loader --save
```

## Purpose

With webpack and [file-loader], you can do things like this in your React code:

```js
import smiley from "./images/smiley.jpg";


render() {
    return <div><img src={smiley} /></div>
}
```

That works out nicely, but if you need to do Server Side Rendering, you will get SyntaxError from Node `require`.  That's because `require` only understand JS files.

With this module, you can extend Node's `require` so it will understand these files.

It saves a list of your files that you want to be treated as assets and the extended `require` will return the URL string like it would on the client side.

## Usage

### Configuring Webpack

First you need to mark all your asset files to be handled by the extend require.  To do that, simply use the webpack loader `isomorphic-loader` on the file.

> The webpack loader `isomorphic-loader` is just a simple pass thru loader to mark your files.

You also need to install a plugin to collect and save the list of the files you marked.

For example, in the webpack config, to mark the usual image files to be understood by the extend require:

```js
var IsomorphicLoaderPlugin = require("isomorphic-loader/lib/webpack-plugin");

module.exports = {
    plugins: [
        new IsomorphicLoaderPlugin()
    ],
    module: {
        loaders: [
            {
                test: /\.(jpe?g|png|gif|svg)$/i,
                loader: "file!isomorphic"
            }
        ]
    }
};
```

You can also mark any file in your code directly:

```js
import smiley from "file!isomorphic!./images/smiley.jpg";
```

### Extending Node Require

After you've configured your webpack to mark your asset files, you need to extend `require` before your server starts.

To do that:

```js
var extendRequire = require("isomorphic-loader/lib/extend-require");

extendRequire(function (err) {
    if (err) {
        console.log(err);
    } else {
        require("./server");
    }
});
```

If `Promise` is supported:

```js
extendRequire().then(function () {
    require("./server");
}).catch(function (err) {
    console.log(err);
});
```

If the config file `.isomorphic-loader-config.json` is not found in CWD, it will wait until it's there.  This is so you can use [webpack-dev-server].

#### Reloading Assets for Extend Require

If at any time you wish extend require to reload the assets, you can use the `loadAssets` API.

```js
var extendRequire = require("isomorphic-loader/lib/extend-require");

extendRequire.loadAssets(function (err) {
    if (err) {
        console.log(err);
    }
});
```

## Config and Assets Files

After Webpack compiled your project, the plugin will generate a config file in your CWD `.isomorphic-loader-config.json` which the require extender will use.

It will also generate a JSON file with the list of your marked asset files in your output directory.  The default name of that file is `isomorphic-assets.json`.

You can configure the name when you initialize the plugin:

```js
new IsomorphicLoaderPlugin({assetsFile: "my-custom-isomorphic-assets-file.json"});
```

It will also save in the config the `publicPath` from your webpack config.

Here is how a config file might look like:

```json
{
  "version": "0.1.0",
  "context": "client",
  "debug": false,
  "devtool": false,
  "output": {
    "path": "dist",
    "filename": "bundle.js",
    "publicPath": "/test/"
  },
  "assetsFile": "dist/isomorphic-assets.json"
}
```

## License

[MIT License]


[file-loader]: https://github.com/webpack/file-loader
[MIT License]: http://www.opensource.org/licenses/mit-license.php
[webpack-dev-server]: https://webpack.github.io/docs/webpack-dev-server.html
