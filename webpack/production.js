'use strict'

var webpack = require('webpack')
var OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin')

var config = require('./base')

config.mode = 'production'
config.output.filename = 'ms-uploader.min.js'

config.plugins = config.plugins.concat([new OptimizeCssAssetsPlugin({})])

module.exports = config
