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

    // Typescript
    const swcrc = convertTsConfig(tsConfig.compilerOptions);
    delete swcrc.jsc?.paths; // swc-jest does not handle typescript paths
    jestConfig.transform = {
        '^.+\\.(t|j)sx?$': ['@swc/jest', swcrc as Record<string, unknown>],
    };

    return jestConfig;
}
