import {
    isDirectory,
    isGroundFolder,
    listDirectory,
    SHARED_FOLDER,
} from '@jterrazz/typescript/rules';

import { SPECIFICATIONS } from '../../../kit/project/specifications.js';
import { declaresTests } from '../../../kit/project/specs-modules.js';

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
        !SPECIFICATIONS.has(first) &&
        first !== SHARED_FOLDER &&
        !holdsATest(`${specs}/${first}`)
    );
}
