module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated DEBE ser el último plugin
      'react-native-reanimated/plugin',
    ],
  };
};
