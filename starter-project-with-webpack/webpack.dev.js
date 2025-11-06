const path = require('path');
const common = require('./webpack.common.js');
const { merge } = require('webpack-merge');

module.exports = merge(common, {
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ],
      },
    ],
  },
  devServer: {
    static: [
      {
        directory: path.resolve(__dirname, 'dist'),
      },
    ],
    port: 9000,
    host: 'localhost',
    hot: false, // Disable hot reload untuk menghindari kedip-kedip
    liveReload: false,
    open: true,
    client: {
      overlay: {
        errors: true,
        warnings: true,
      },
    },
    historyApiFallback: true,
  },
});
