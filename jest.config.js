/** Engine tests only: pure TypeScript, no React Native needed. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/engine'],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': '<rootDir>/test/asyncStorageMock.js',
    '^react-native$': '<rootDir>/test/reactNativeMock.js',
  },
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, target: 'es2020', module: 'commonjs', types: ['jest'] } }] },
};
