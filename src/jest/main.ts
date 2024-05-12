// promisify exec
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import { exec } from 'node:child_process';
import util from 'node:util';
import { JestConfigWithTsJest, pathsToModuleNameMapper } from 'ts-jest';

const execPromise = util.promisify(exec);

const getSwcrc = async () => {
    const tmpSwcrc = `/tmp/.swcrc.${randomUUID()}.json`;
    const require = createRequire(import.meta.url);

    await execPromise(`npx tsconfig-to-swcconfig --output=${tmpSwcrc}`);

    return require(tmpSwcrc);
};

const jestConfig: JestConfigWithTsJest = {
    // Support for ES6 modules
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },

    // Convention
    testMatch: ['**/__tests__/**/*.test.ts'],
};

export default async function () {
    const swcrc = await getSwcrc();
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
