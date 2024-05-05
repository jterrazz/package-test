import { exec } from 'child_process';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import { JestConfigWithTsJest, pathsToModuleNameMapper } from 'ts-jest';

const getSwcrc = () => {
    const tmpSwcrc = `/tmp/.swcrc.${randomUUID()}`;
    const require = createRequire(import.meta.url);

    exec(`npx tsconfig-to-swcconfig --output=${tmpSwcrc}`);

    return require(tmpSwcrc);
};

const jestConfig: JestConfigWithTsJest = {
    // Convention
    testMatch: ['**/__tests__/**/*.test.ts'],
};

export default function () {
    const swcrc = getSwcrc();
    const paths = swcrc.jsc?.paths;

    // Paths configuration
    if (paths) {
        jestConfig.moduleNameMapper = pathsToModuleNameMapper(paths, {
            prefix: '<rootDir>/',
        });
    }
    delete swcrc.jsc?.paths; // swc-jest does not handle typescript paths

    // Typescript
    jestConfig.transform = {
        '^.+\\.(t|j)sx?$': ['@swc/jest', swcrc as Record<string, unknown>],
    };

    return jestConfig;
}
