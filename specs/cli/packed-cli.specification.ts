import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll, inject } from 'vitest';

const CONSUMER = resolve(import.meta.dirname, './_setup/packed/consumer.ts');

const packedPackage = inject('packedPackage');
if (packedPackage === undefined) {
    throw new Error(
        'no tarball was packed: the project running a packed spec takes specs/cli/_setup/packed/per-run.ts as its global setup, which packs it',
    );
}

export const { cleanup, cli } = await specification.cli(`node ${CONSUMER}`, {
    defaults: { PACKED_PACKAGE: packedPackage },
});

afterAll(cleanup);

declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        packedPackage?: string;
    }
}
