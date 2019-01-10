var webpack = require('webpack')
var MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = {
  entry: ['./src/index.js', './src/index.scss'],
  output: {
    filename: 'ms-uploader.js',
    library: 'MSUploader',
    libraryTarget: 'umd',
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
