[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url]
[![Dependency Status][daviddm-image]][daviddm-url] [![devDependency Status][daviddm-dev-image]][daviddm-dev-url]

# Webpack Isomorphic Loader

Webpack loader and tools to make node.js `require` understands files such as images when you are doing server side rendering (SSR).

## Purpose

With [webpack] and [file-loader], you can do things like this in your React code:

```js
import smiley from "./images/smiley.jpg";


render() {
    return <div><img src={smiley} /></div>
}
```

That works out nicely, but if you need to do SSR, you will get `SyntaxError` from node.js `require`. That's because `require` only understands JS files.

With this module, you can extend `require` so it understands these files.

It contains three parts:

1. a webpack loader - to mark asset files
2. a webpack plugin - collect asset files and generate mapping data
3. a node.js library - extend `require` for SSR using the mapping data

## Install

```
$ npm install isomorphic-loader --save
```

## Usage

### Configuring Webpack

First use the webpack loader `isomorphic-loader` to mark all your asset files that you want `extendRequire` to handle.

> The webpack loader `isomorphic-loader` is just a simple pass thru loader to mark your files. It will not do anything to the file content.

Next install the webpack plugin `IsomorphicLoaderPlugin` to collect and save the list of the marked files.

For example, in the webpack config, to mark the usual image files to be understood by `extendRequire`:

```js
const { IsomorphicLoaderPlugin } = require("isomorphic-loader");

module.exports = {
  plugins: [new IsomorphicLoaderPlugin()],
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

### Extending node.js `require`

With the marked asset files collected, initialize `extendRequire` with the mapping data before your server starts:

```js
const { extendRequire } = require("isomorphic-loader");

const isomorphicRequire = extendRequire();

// isomorphicRequire is an instance of the ExtendRequire class exported from the module

// start your server etc
```

It will try to load the isomorphic config data from `dist/isomorphic-assets.json`. You can also pass in the config data:

```js
extendRequire(options, require("./dist/isomorphic-assets.json"));
```

#### Custom Config Overrides

When calling `extendRequire`, you can pass in a callback in `options.processConfig` to override the `isomorphicConfig`

```js
extendRequire({
  processConfig: config => {
    // do something with config
    return config;
  }
});
```

#### Activating and Deactivating extendRequire

- `deactivate` API - deactivate `extendRequire` during run time.
- `activate` API - activate `extendRequire` during run time.

```js
const { extendRequire } = require("isomorphic-loader");

const isomorphicRequire = extendRequire();

isomorphicRequire.deactivate();

// and reactivate it

isomorphicRequire.activate();
```

### Usage with CDN Server

If you publish your assets to a Content Delivery Network server, and if it generates a new unique path for your assets, then you likely have to set `publicPath` after webpack compiled your project.

That's why [webpack]'s document has this note in the [section about `publicPath`]:

> **Note:** In cases when the eventual `publicPath` of output files isn't known at compile time, it can be left blank and set dynamically at runtime in the entry point file.
> If you don't know the `publicPath` while compiling you can omit it and set `__webpack_public_path__` on your entry point.

In that case, you would have to save the path CDN created for you and pass it to `extendRequire` with a [custom config override](#custom-config-overrides), or you can just modify the [config file](#config-and-assets-files) directly.

If your CDN server generates an unique URL for every asset file instead of a single base path, then you have to do some custom post processing to update the asset mapping files yourself.

### Webpack Dev Server

If you are using webpack dev server, then you probably have two separate processes running:

1. webpack dev server (WDS)
2. your app's node.js server (APP)

And `IsomorphicLoaderPlugin` would be running in **WDS** but `extendRequire` is in **APP**.

- You need to setup some way to transfer the mapping data from **WDS** to **APP**.
- When starting up, **APP** needs to wait for the first mapping data before actually startup, unless your SSR code is not loaded until it's actually invoked.

Here is an example using chokidar to transfer the data through a file:

- In your `webpack.config.js`:

```js
const fs = require("fs");
const { IsomorphicLoaderPlugin } = require("isomorphic-loader");

const isoPlugin = new IsomorphicLoaderPlugin();
isoPlugin.on("update", data => {
  fs.writeFileSync("./tmp/isomorphic-assets.json", JSON.stringify(data.config));
});

module.exports = {
  plugins: [isoPlugin]
};
```

- In your app server `index.js`

```js
const { extendRequire } = require("isomorphic-loader");

// figure out if running in dev mode or not
if (process.env.NODE_ENV !== "production") {
  const chokidar = require("chokidar");
  const assetFile = "./tmp/isomorphic-assets.json";

  let isomorphicRequire;

  function updateIsomorphicAssets() {
    const firstTime = !isomorphicRequire;
    if (firstTime) {
      isomorphicRequire = extendRequire();
    } else {
      // do the necessary require cache refresh so hot module reload works in SSR
    }

    isomorphicRequire.loadAssets(assetFile);
    if (firstTime) {
      startServer();
    }
  }

  const watcher = chokidar.watch(assetFile, { persistent: true });
  watcher.on("add", updateIsomorphicAssets);
  watcher.on("change", updateIsomorphicAssets);

  // do some timeout check
  setTimeout(() => {
    if (!isomorphicRequire) {
      console.error("timeout waiting for webpack dev server");
    }
  }, 20000).unref();
} else {
  extendRequire().loadAssets("./dist/isomorphic-assets.json");
  startServer();
}
```

## License

[Apache License, Version 2]

[file-loader]: https://github.com/webpack/file-loader
[apache license, version 2]: https://www.apache.org/licenses/LICENSE-2.0
[webpack-dev-server]: https://webpack.github.io/docs/webpack-dev-server.html
[webpack]: https://webpack.github.io/
[section about `publicpath`]: https://github.com/webpack/docs/wiki/configuration#outputpublicpath
[travis-image]: https://travis-ci.org/electrode-io/isomorphic-loader.svg?branch=master
[travis-url]: https://travis-ci.org/electrode-io/isomorphic-loader
[npm-image]: https://badge.fury.io/js/isomorphic-loader.svg
[npm-url]: https://npmjs.org/package/isomorphic-loader
[daviddm-image]: https://david-dm.org/electrode-io/isomorphic-loader/status.svg
[daviddm-url]: https://david-dm.org/electrode-io/isomorphic-loader
[daviddm-dev-image]: https://david-dm.org/electrode-io/isomorphic-loader/dev-status.svg
[daviddm-dev-url]: https://david-dm.org/electrode-io/isomorphic-loader?type=dev
