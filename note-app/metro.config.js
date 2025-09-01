// metro.config.js (루트)
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// svg -> transformer, html/txt -> asset
const { assetExts, sourceExts } = config.resolver;

config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = [...assetExts.filter(e => e !== 'svg'), 'html', 'txt'];
config.resolver.sourceExts = [...sourceExts, 'svg'];

module.exports = config;
