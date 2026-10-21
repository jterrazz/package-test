import { TESTS_FOLDER } from '@jterrazz/typescript/rules';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

// invariant: a module runs again before each file after the sibling modules it imports (`'./<name>.specification.js'`, as the formatter quotes it), so it reads their subject of this file, never the last one's.
function inImportOrder(directory: string, modules: readonly string[]): string[] {
    const ordered: string[] = [];
    const seen = new Set<string>();
    const visit = (module: string): void => {
        if (seen.has(module)) {
            return;
        }
        seen.add(module);
        const text = readFileSync(join(directory, module), 'utf8');
        for (const imported of modules.filter((other) =>
            text.includes(`'./${other.slice(0, -'ts'.length)}js'`),
        )) {
            visit(imported);
        }
        ordered.push(module);
    };
    for (const module of modules) {
        visit(module);
    }

    return ordered;
}

// invariant: every specification module of the folder is a runner: in a shared module graph, a module that is none would load once per worker, and its files would share the first one's subject.
function runnerOf(root: string, folder: string, specification: string): Record<string, unknown> {
    if (!RUNNER_SHARED.has(specification)) {
        return {};
    }
    const directory = join(root, folder);
    const modules = readdirSync(directory)
        .filter((name) => name.endsWith(SPECIFICATION_MODULE))
        .toSorted();

    return modules.length === 0
        ? {}
        : { runner: inImportOrder(directory, modules).map((name) => `./${folder}/${name}`) };
}

// invariant: a workspace member named `specs` is the specs root itself, with no `specs/` folder beneath it: its folders are the specifications.
const isSpecsMember = (root: string): boolean =>
    basename(root) === SPECS && existsSync(join(root, 'package.json'));

/** The projects a tree names, each with the options it derives: one per `specs/<specification>/` folder (one whose spec files meet their subject through a runner handed as its `runner` every specification module of the folder, `*.specification.ts`, a module after those it imports), `unit` over each root holding a module test (`specs/unit/` is one root among them), `component` over each holding a rendered one. */
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
