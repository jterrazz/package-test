import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll, inject } from 'vitest';

const CONSUMER = resolve(import.meta.dirname, './__setup__/packed/consumer.ts');

const packedPackage = inject('packedPackage');
if (packedPackage === undefined) {
    throw new Error(
        'no tarball was packed: the project running a packed spec takes specs/cli/__setup__/packed/per-run.ts as its global setup, which packs it',
    );
}

export const { cleanup, cli } = await specification.cli(`node ${CONSUMER}`, {
    defaults: { PACKED_PACKAGE: packedPackage },
});

afterAll(cleanup);

declare module 'vitest' {
    interface ProvidedContext {
        packedPackage?: string;
    }
}
