const path = require('path');
const webpack = require('webpack');
const nconf = require('nconf');
const setupNconf = require('../../website/server/libs/setupNconf');

let configFile = path.join(path.resolve(__dirname, '../../config.json'));

// TODO abstract from server
setupNconf(configFile);

const DEV_BASE_URL = nconf.get('BASE_URL');

const envVars = [
  'AMAZON_PAYMENTS_SELLER_ID',
  'AMAZON_PAYMENTS_CLIENT_ID',
  'AMAZON_PAYMENTS_MODE',
  'EMAILS_COMMUNITY_MANAGER_EMAIL',
  'EMAILS_TECH_ASSISTANCE_EMAIL',
  'EMAILS_PRESS_ENQUIRY_EMAIL',
  'BASE_URL',
  'GA_ID',
  'STRIPE_PUB_KEY',
  'FACEBOOK_KEY',
  'GOOGLE_CLIENT_ID',
  'AMPLITUDE_KEY',
  'LOGGLY_CLIENT_TOKEN',
  // TODO necessary? if yes how not to mess up with vue cli? 'NODE_ENV'
];

const envObject = {};

envVars
  .forEach(key => {
    envObject[key] = nconf.get(key);
  });

module.exports = {
  configureWebpack: {
    plugins: [
      new webpack.EnvironmentPlugin(envObject)
    ],
  },
  chainWebpack: config => {
    const pugRule = config.module.rule('pug')

    // clear all existing loaders.
    // if you don't do this, the loader below will be appended to
    // existing loaders of the rule.
    pugRule.uses.clear()

    // add replacement loader(s)
    pugRule
        .test(/\.pug$/)
        // this applies to <template lang="pug"> in Vue components
        .oneOf('vue-loader')
          .resourceQuery(/^\?vue/)
          .use('pug-plain')
            .loader('pug-plain-loader')
            .end()
        .end()
  },

  devServer: {
    proxy: {
      // proxy all requests to the server at IP:PORT as specified in the top-level config
      '^/api/v3': {
        target: DEV_BASE_URL,
        changeOrigin: true,
      },
      '^/api/v4': {
        target: DEV_BASE_URL,
        changeOrigin: true,
      },
      '^/stripe': {
        target: DEV_BASE_URL,
        changeOrigin: true,
      },
      '^/amazon': {
        target: DEV_BASE_URL,
        changeOrigin: true,
      },
      '^/paypal': {
        target: DEV_BASE_URL,
        changeOrigin: true,
      },
      '^/logout-server': {
        target: DEV_BASE_URL,
        changeOrigin: true,
      },
      '^/export': {
        target: DEV_BASE_URL,
        changeOrigin: true,
      },
    }
  }
};
