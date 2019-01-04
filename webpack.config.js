const path = require('path')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')

module.exports = {
  entry: './src/index.js',
  mode: 'production',
  // optimization: { minimize: false },
  output: {
    filename: 'main.js',
    // path: '/dist',
    library: 'MSUploader',
    libraryTarget: 'umd',
  },
  plugins: [new MiniCssExtractPlugin('main.css'), new OptimizeCssAssetsPlugin({})],
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
