const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @tamagui/portal が複数の nested node_modules に分散しているため、
// 全パッケージが同一の React Context インスタンスを共有するよう単一パスに統一する。
config.resolver.extraNodeModules = {
  '@tamagui/portal': path.resolve(__dirname, 'node_modules/tamagui/node_modules/@tamagui/portal'),
};

module.exports = config;
