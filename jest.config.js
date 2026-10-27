/**
 * Pure TypeScript tests, no React Native needed. Engine tests live in src/engine/__tests__;
 * tests for app-side modules (analytics, stores) live in test/.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/engine', '<rootDir>/test'],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': '<rootDir>/test/asyncStorageMock.js',
    '^react-native$': '<rootDir>/test/reactNativeMock.js',
  },
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, target: 'es2020', module: 'commonjs', types: ['jest'] } }] },
};
