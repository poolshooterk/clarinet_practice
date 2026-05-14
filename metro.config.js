const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @tamagui/portal が複数バージョン(rc.41/rc.42)に分散しており React Context が共有されない。
// 全パッケージがトップレベルの同一インスタンス(rc.42)を参照するよう統一する。
config.resolver.extraNodeModules = {
  '@tamagui/portal': path.resolve(__dirname, 'node_modules/@tamagui/portal'),
};

module.exports = config;
