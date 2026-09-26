import { isGroundName, SHARED_GROUND } from '../../../src/kernel/files/ground.js';
import { FACETS } from '../../reading/facets.js';
import { isDirectory, listDirectory } from '../../reading/fs-cache.js';

export function declaresTests(name: string): boolean {
    return /\.(?:test\.tsx?|spec\.ts|spec\.yaml)$/u.test(name);
}

function holdsATest(folder: string): boolean {
    return (listDirectory(folder) ?? []).some((name) => {
        const path = `${folder}/${name}`;
        if (isDirectory(path)) {
            return !isGroundName(name) && name !== 'node_modules' && holdsATest(path);
        }
        return declaresTests(name);
    });
}

export function isStrayFolder(specs: string, relative: readonly string[]): boolean {
    const [first = ''] = relative;
    return (
        relative.length > 1 &&
        !FACETS.has(first) &&
        first !== SHARED_GROUND &&
        !holdsATest(`${specs}/${first}`)
    );
}
