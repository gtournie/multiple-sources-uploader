var path = require('path')
var webpack = require('webpack')
var MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = {
  entry: ['./src/index.scss', './src/index.js'], // css must be placed first
  output: {
    filename: 'ms-uploader.js',
    library: 'MSUploader',
    libraryTarget: 'umd',
    libraryExport: 'default',
  },
  plugins: [new MiniCssExtractPlugin({ filename: 'ms-uploader.css' })],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.scss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
    ],
  },
}
