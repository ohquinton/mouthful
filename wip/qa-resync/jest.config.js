module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['**/*.qa.ts'],
  transform: { '^.+\.tsx?$': ['C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/node_modules/ts-jest', { diagnostics: false, tsconfig: { strict: false, esModuleInterop: true, target: 'es2020', module: 'commonjs' } }] },
};
