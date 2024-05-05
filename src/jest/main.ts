import { createRequire } from 'module';
import { JestConfigWithTsJest, pathsToModuleNameMapper } from 'ts-jest';
import { convertTsConfig } from 'tsconfig-to-swcconfig';

const readTsConfig = () => {
    const require = createRequire(import.meta.url);

    return require('../../../../../tsconfig.json');
};

const jestConfig: JestConfigWithTsJest = {
    // Convention
    testMatch: ['**/__tests__/**/*.test.ts'],
};

export default function () {
    const tsConfig = readTsConfig();
    const paths = tsConfig.compilerOptions?.paths;

    // Paths configuration
    if (paths) {
        jestConfig.moduleNameMapper = pathsToModuleNameMapper(paths, {
            prefix: '<rootDir>/',
        });
    }

    // Typescript configuration
    jestConfig.transform = {
        '^.+\\.(t|j)sx?$': ['@swc/jest', convertTsConfig(tsConfig) as Record<string, unknown>],
    };

    return jestConfig;
}
