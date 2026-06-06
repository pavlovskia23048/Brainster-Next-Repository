import type { Config } from 'jest';

const config: Config = {
    preset: 'react-native',
    setupFiles: ['./jest.setup.ts'],
    transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|expo|@expo|firebase|@firebase|zustand|nativewind)/)',
    ],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
    testPathIgnorePatterns: ['/node_modules/', '/functions/'],
    collectCoverageFrom: [
        'utils/**/*.ts',
        'services/**/*.ts',
        'store/**/*.ts',
        '!**/*.d.ts',
    ],
};

export default config;
