import { TESTS_FOLDER } from '@jterrazz/typescript/rules';
import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import { SPECIFICATIONS } from './specifications.js';

const SPECS = 'specs';

const UNIT = 'unit';

// invariant: every specification a project is built by has its folder, the unit one aside: module tests sit in the `__tests__/` of their modules' folders.
const FOLDERED: ReadonlySet<string> = new Set([...SPECIFICATIONS, 'component']);

// invariant: a spec file of these meets its subject through the runner its specification module exports, so a worker's files can share one module graph and run that module again before each file.
const RUNNER_SHARED: ReadonlySet<string> = new Set(['api', 'cli', 'integration', 'job', 'website']);

const SPECIFICATION_MODULE = '.specification.ts';

const MODULE_TEST = /\.test\.ts$/u;

const RENDERED_TEST = /\.test\.tsx$/u;

// invariant: no test sits in a dot folder, a ground or setup folder, an install or a build; a `__tests__/` holds them.
const UNWALKED_NAME = /^(?:[._]|node_modules$|dist$)/u;

const isUnwalked = (name: string): boolean => name !== TESTS_FOLDER && UNWALKED_NAME.test(name);

function holds(path: string, pattern: RegExp): boolean {
    return readdirSync(path, { withFileTypes: true }).some((entry) => {
        if (isUnwalked(entry.name)) {
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
              .filter((entry) => entry.isDirectory() && !isUnwalked(entry.name))
              .map(({ name }) => name)
              .toSorted()
        : [];

// invariant: the runner is derived only where the folder's one specification module is named for it: in a shared module graph, a second specification module would load once per worker, and its files would share the first one's subject.
function runnerOf(root: string, folder: string, specification: string): Record<string, unknown> {
    if (!RUNNER_SHARED.has(specification)) {
        return {};
    }
    const modules = readdirSync(join(root, folder)).filter((name) =>
        name.endsWith(SPECIFICATION_MODULE),
    );
    const own = `${specification}${SPECIFICATION_MODULE}`;

    return modules.length === 1 && modules[0] === own ? { runner: `./${folder}/${own}` } : {};
}

// invariant: a workspace member named `specs` is the specs root itself, with no `specs/` folder beneath it: its folders are the specifications.
const isSpecsMember = (root: string): boolean =>
    basename(root) === SPECS && existsSync(join(root, 'package.json'));

/** The projects a tree names, each with the options it derives: one per `specs/<specification>/` folder (one whose spec files meet their subject through a runner handed as its `runner` the folder's one specification module, `<specification>.specification.ts`), `unit` over each root holding a module test (`specs/unit/` is one root among them), `component` over each holding a rendered one. */
export function derivedProjects(root: string): Map<string, Record<string, unknown>> {
    const member = isSpecsMember(root);
    const prefix = member ? '' : `${SPECS}/`;
    const specs = foldersIn(member ? root : join(root, SPECS));
    const named = specs.filter((folder) => FOLDERED.has(folder));
    const roots = [
        ...(member ? [] : foldersIn(root).filter((folder) => folder !== SPECS)),
        ...specs.filter((folder) => !named.includes(folder)).map((folder) => `${prefix}${folder}`),
    ];
    const holding = (pattern: RegExp): string[] =>
        roots.filter((folder) => holds(join(root, folder), pattern));
    const rendered = [
        ...(named.includes('component') ? [`${prefix}component/**/*.test.tsx`] : []),
        ...holding(RENDERED_TEST).map((folder) => `${folder}/**/*.test.tsx`),
    ];
    const unitRoots = holding(MODULE_TEST);
    const projects = new Map<string, Record<string, unknown>>();
    if (unitRoots.length > 0) {
        projects.set(UNIT, { roots: unitRoots });
    }
    for (const specification of named) {
        projects.set(specification, runnerOf(root, `${prefix}${specification}`, specification));
    }
    if (rendered.length > 0) {
        projects.set('component', { include: rendered });
    }

    return projects;
}

/** The specification modules a tree holds, `specs/<specification>/<specification>.specification.ts`: documents bind one by name, and no import reaches it. */
export function specificationModules(root: string): string[] {
    const member = isSpecsMember(root);
    const prefix = member ? '' : `${SPECS}/`;

    return foldersIn(member ? root : join(root, SPECS))
        .filter((folder) => FOLDERED.has(folder))
        .map((folder) => `${prefix}${folder}/${folder}${SPECIFICATION_MODULE}`)
        .filter((path) => existsSync(join(root, path)));
}
