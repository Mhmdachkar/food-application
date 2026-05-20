module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^expo-av$': '<rootDir>/src/__tests__/__mocks__/expo-av.ts',
    '^expo-speech$': '<rootDir>/src/__tests__/__mocks__/expo-speech.ts',
    '^react-native$': '<rootDir>/src/__tests__/__mocks__/react-native.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/__tests__/__mocks__/@react-native-async-storage/async-storage.ts',
    '^expo-constants$': '<rootDir>/src/__tests__/__mocks__/expo-constants.ts',
    '^expo-file-system$': '<rootDir>/src/__tests__/__mocks__/expo-file-system.ts',
    '^expo-image$': '<rootDir>/src/__tests__/__mocks__/expo-image.ts',
    '^expo-notifications$': '<rootDir>/src/__tests__/__mocks__/expo-notifications.ts',
    '^expo-device$': '<rootDir>/src/__tests__/__mocks__/expo-device.ts',
    '^nativewind$': '<rootDir>/src/__tests__/__mocks__/nativewind.ts',
    '^@tanstack/react-query$': '<rootDir>/src/__tests__/__mocks__/@tanstack/react-query.ts',
    '\\.css$': '<rootDir>/src/__tests__/__mocks__/css.ts',
  },
};
