const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const PORTAL_ROOT = path.resolve(__dirname, 'node_modules/@tamagui/portal');

// @tamagui/portal が rc.41/rc.42 の複数バージョンに分散しており React Context が共有されない。
// resolveRequest で全インポートをトップレベルの rc.42 エントリファイルに直接リダイレクトする。
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@tamagui/portal') {
    const filePath =
      platform === 'web'
        ? path.join(PORTAL_ROOT, 'dist/esm/index.mjs')
        : path.join(PORTAL_ROOT, 'dist/esm/index.native.js');
    return { type: 'sourceFile', filePath };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
