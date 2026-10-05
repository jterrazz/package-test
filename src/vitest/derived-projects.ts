import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SPECS = 'specs';

const MODULE_TEST = /\.test\.ts$/u;

const RENDERED_TEST = /\.test\.tsx$/u;

// invariant: no test sits in a dot folder, a ground or setup folder, an install or a build.
const UNWALKED = /^(?:[._]|node_modules$|dist$)/u;

function holds(path: string, pattern: RegExp): boolean {
    return readdirSync(path, { withFileTypes: true }).some((entry) => {
        if (UNWALKED.test(entry.name)) {
            return false;
        }

        return entry.isDirectory()
            ? holds(join(path, entry.name), pattern)
            : pattern.test(entry.name);
    });
}

const foldersIn = (path: string): string[] =>
    existsSync(path)
        ? readdirSync(path, { withFileTypes: true })
              .filter((entry) => entry.isDirectory() && !UNWALKED.test(entry.name))
              .map(({ name }) => name)
              .toSorted()
        : [];

/** The projects a tree names, each with the options it derives: one per `specs/<specification>/` folder, `unit` over each root holding a module test, `component` over each holding a rendered one. */
export function derivedProjects(
    root: string,
    specifications: readonly string[],
): Map<string, Record<string, unknown>> {
    const specs = foldersIn(join(root, SPECS));
    const named = specs.filter((folder) => specifications.includes(folder));
    const roots = [
        ...foldersIn(root).filter((folder) => folder !== SPECS),
        ...specs.filter((folder) => !named.includes(folder)).map((folder) => `${SPECS}/${folder}`),
    ];
    const holding = (pattern: RegExp): string[] =>
        roots.filter((folder) => holds(join(root, folder), pattern));
    const rendered = [
        ...(named.includes('component') ? [`${SPECS}/component/**/*.test.tsx`] : []),
        ...holding(RENDERED_TEST).map((folder) => `${folder}/**/*.test.tsx`),
    ];
    const unitRoots = holding(MODULE_TEST);
    const projects = new Map<string, Record<string, unknown>>();
    if (unitRoots.length > 0) {
        projects.set('unit', { roots: unitRoots });
    }
    for (const specification of named) {
        projects.set(specification, {});
    }
    if (rendered.length > 0) {
        projects.set('component', { include: rendered });
    }

    return projects;
}
