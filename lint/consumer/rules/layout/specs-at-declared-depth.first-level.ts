import {
    isDirectory,
    isGroundFolder,
    listDirectory,
    SHARED_FOLDER,
} from '@jterrazz/typescript/rules';

import { FACETS } from '../../../engine/project/facets.js';
import { declaresTests } from '../../../engine/project/specs-modules.js';

function holdsATest(folder: string): boolean {
    return (listDirectory(folder) ?? []).some((name) => {
        const path = `${folder}/${name}`;
        if (isDirectory(path)) {
            return !isGroundFolder(name) && name !== 'node_modules' && holdsATest(path);
        }
        return declaresTests(name);
    });
}

export function isStrayFolder(specs: string, relative: readonly string[]): boolean {
    const [first = ''] = relative;
    return (
        relative.length > 1 &&
        !FACETS.has(first) &&
        first !== SHARED_FOLDER &&
        !holdsATest(`${specs}/${first}`)
    );
}
