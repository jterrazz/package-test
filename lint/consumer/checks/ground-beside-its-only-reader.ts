import { GROUND_FOLDERS } from '@jterrazz/typescript/rules';
import { join, relative } from 'node:path';

import {
    entriesOf,
    PRUNED_WITH_FIXTURES,
    textOf,
    walkFiles,
} from '../../kit/project/facet-folders.js';
import { isNodeTestFileName } from '../../kit/project/role.js';
import type { Spotted } from './checker.js';

function* walkDirectories(dir: string): Generator<string> {
    for (const entry of entriesOf(dir)) {
        if (!entry.isDirectory() || PRUNED_WITH_FIXTURES.has(entry.name)) {
            continue;
        }
        const path = join(dir, entry.name);
        yield path;
        yield* walkDirectories(path);
    }
}

const SUBJECT_FOLDER_FACETS = new Set(['api', 'cli', 'job']);

const GROUND = new Set<string>(GROUND_FOLDERS);

/** Such a test reads every golden of its leaf though its source names none. */
const COMPUTED_GOLDEN = /\.toMatch\(\s*(?:file|directory)\(\s*(?:`|[A-Za-z_$])/u;

/** Not where the folder is the subject's standard name (`spec-in-subject-folder`): there the leaf is the subject, and its aspect files share it by design. */
export function checkGroundBesideItsOnlyReader(specsRoot: string): Spotted[] {
    const violations: Spotted[] = [];
    const derived = (directory: string): boolean =>
        SUBJECT_FOLDER_FACETS.has(relative(specsRoot, directory).split(/[/\\]/u)[0] ?? '');
    for (const directory of [specsRoot, ...walkDirectories(specsRoot)].filter(
        (candidate) => !derived(candidate),
    )) {
        const entries = entriesOf(directory);
        // A `.test.tsx` is out of reach, as for `specs-at-declared-depth`: a tree of rendered units has no domain folders for the ground to move into.
        const tests = entries
            .filter((entry) => entry.isFile() && isNodeTestFileName(entry.name))
            .map((entry) => join(directory, entry.name));
        if (tests.length < 2) {
            continue;
        }
        const grounds = entries
            .filter((entry) => entry.isDirectory() && GROUND.has(entry.name))
            .map((entry) => entry.name);
        for (const ground of grounds) {
            const names = [...walkFiles(join(directory, ground))].map((file) =>
                file.slice(file.lastIndexOf('/') + 1),
            );
            if (names.length === 0) {
                continue;
            }
            const readers = tests.filter((test) => {
                const text = textOf(test) ?? '';
                return (
                    names.some((name) => text.includes(name)) ||
                    text.includes(`${ground}/`) ||
                    COMPUTED_GOLDEN.test(text)
                );
            });
            if (readers.length !== 1) {
                continue;
            }
            const reader = readers[0] ?? '';
            const rel = relative(specsRoot, join(directory, ground));
            violations.push({
                path: rel,
                line: 1,
                fix: `give \`${relative(directory, reader)}\` a domain folder of its own, and move \`${ground}/\` into it`,
                found: `\`${ground}/\`, read by \`${relative(directory, reader)}\` alone of the tests beside it`,
                rule: 'ground-beside-its-only-reader',
            });
        }
    }
    return violations;
}
