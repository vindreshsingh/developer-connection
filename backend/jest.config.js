export default {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/src/__tests__/setup.js'],
  transform: {},
};
