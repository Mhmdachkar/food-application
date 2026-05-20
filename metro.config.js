const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Metro resolves zustand's ESM .mjs exports (which contain import.meta) instead of CJS.
// Force the resolver to prefer 'require' (CJS) over 'import' so zustand's .js files are used.
// This eliminates the "Cannot use import.meta outside a module" SyntaxError on web.
config.resolver = {
  ...config.resolver,
  unstable_conditionNames: ['require', 'react-native', 'default'],
};

module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 14,
});
