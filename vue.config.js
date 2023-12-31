
// eslint-disable-next-line no-global-assign
require = require('esm')(module);

const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    https: true,
    proxy: {
      '^/api': {
        target: 'apiurl',
        ws: true,
        changeOrigin: true,
        pathRewrite: {
          '^/api': ''
        }
      },
    }
  }
})
