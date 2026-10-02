import { specification } from '@jterrazz/test';
import { resolve } from 'node:path';
import { afterAll, inject } from 'vitest';

const CONSUMER = resolve(import.meta.dirname, './_setup/packed/consumer.ts');

export const { cleanup, cli } = await specification.cli(`node ${CONSUMER}`, {
    defaults: { PACKED_PACKAGE: inject('packedPackage') ?? '' },
});

afterAll(cleanup);

declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        packedPackage?: string;
    }
}
