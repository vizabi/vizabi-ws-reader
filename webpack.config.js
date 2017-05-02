const webpack = require('webpack');
const path = require('path');

/* eslint-disable no-process-env */
const PROD = JSON.parse(process.env.PROD_ENV || '0');
const WEB = JSON.parse(process.env.WEB_ENV || '0');

const config = {
  entry: {'main-backend': './src/index.js'},
  target: 'node',
  devtool: 'source-map',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'vizabi-ws-reader-node.js',
    libraryTarget: 'commonjs2'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loaders: ['babel']
      }
    ]
  },
  resolve: {extensions: ['', '.js']},
  profile: true,
  plugins: PROD ? [
    new webpack.optimize.UglifyJsPlugin({compress: {warnings: false}})
  ] : []
};

// pack for Web

if (WEB) {
  config.target = 'web';
  config.output.filename = 'vizabi-ws-reader.js';
  config.output.libraryTarget = 'var';
  config.output.library = 'WSReader';
}

module.exports = config;
