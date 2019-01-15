var path = require('path')
var webpack = require('webpack')
var MiniCssExtractPlugin = require('mini-css-extract-plugin')
var PORT = process.env.PORT || 3003

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: ['./src/index.js'],
  context: path.resolve(process.cwd(), 'demo'),
  output: {
    path: path.resolve(process.cwd(), 'demo/.tmp'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: [['@babel/preset-env', { useBuiltIns: 'usage' }]],
        },
      },
      {
        test: /\.html$/,
        loaders: ['html-loader'],
      },
      {
        test: /\.scss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
    ],
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.optimize.ModuleConcatenationPlugin(),
    new MiniCssExtractPlugin({ filename: 'demo.css' }),
  ],
  resolve: {
    alias: { 'multiple-sources-uploader': path.join(process.cwd(), 'src/index.js') },
    extensions: ['.js', '.jsx', '.es6', '.scss', '.css'],
    modules: [path.join(process.cwd(), 'demo'), 'demo', 'node_modules'],
  },
  devServer: {
    contentBase: 'demo',
    noInfo: false,
    historyApiFallback: true,
    hot: true,
    inline: true,
    port: PORT,
  },
}
