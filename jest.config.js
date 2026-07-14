module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-redux|redux|immer|reselect|@reduxjs|@react-navigation|react-native-paper|react-native-vector-icons|react-native-safe-area-context|react-native-gesture-handler|react-native-reanimated)/)',
  ],
};
