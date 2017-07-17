/* eslint-disable no-process-env */

const path = require('path');
const webpack = require('webpack');

const WEB = process.env.WEB_ENV;

const config = {
  entry: { 'main-backend': './src/index.js' },
  target: 'node',
  devtool: 'source-map',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'vizabi-ws-reader-node.js',
    libraryTarget: 'commonjs2'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loaders: ['babel-loader']
      }
    ]
  },
  resolve: { extensions: ['.js'] },
  profile: true,
  plugins: [new webpack.optimize.UglifyJsPlugin()]
};

if (WEB) {
  config.target = 'web';
  config.output.filename = 'vizabi-ws-reader.js';
  config.output.libraryTarget = 'var';
  config.output.library = 'WsReader';
}

module.exports = config;
