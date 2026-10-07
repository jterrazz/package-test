import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../testing/package-tree.fixtures.js';
import { subjectOfSource, testTitle } from '../test-title.js';

describe('testTitle', () => {
    test('names the default export when it declares a name', () => {
        // Given - a module whose default export is a named function beside a helper
        const source = 'export default function judgeLedgers() {}\nexport const helper = 1;\n';

        // Then - the default export's name, whatever else the module exports
        expect(subjectOfSource('route-judge', source, 'route-judge.ts')).toBe('judgeLedgers');
    });

    test('names the one value export, types not counted', () => {
        // Given - a module exporting one function and two types
        const source =
            'export type Ledger = {};\nexport interface Route {}\nexport function judgeLedgers() {}\n';

        // Then - the function, the one thing a test can call
        expect(subjectOfSource('route-judge', source, 'route-judge.ts')).toBe('judgeLedgers');
    });

    test('names the export spelling the base name when several run', () => {
        // Given - a component module exporting its component and a constant
        const source = 'export const LABELS = {};\nexport function LocaleNote() {}\n';

        // Then - the export whose name is the base name in PascalCase
        expect(subjectOfSource('locale-note', source, 'locale-note.tsx')).toBe('LocaleNote');
    });

    test('names the export spelling the base less its role suffix, the whole base first', () => {
        // Given - an action module exporting its verb and a helper, and a service exporting its class
        const action = 'export function request() {}\nexport const METHODS = [];\n';
        const service = 'export class UserService {}\nexport const user = 1;\n';

        // Then - the subject is the concept, not the file's role; a whole-base spelling still wins
        expect(subjectOfSource('request.action', action, 'request.action.ts')).toBe('request');
        expect(subjectOfSource('user.service', service, 'user.service.ts')).toBe('UserService');
    });

    test('falls back to the base name when no export answers', () => {
        // Given - two value exports, neither spelling the base name
        const source = 'export const a = 1;\nexport const b = 2;\n';

        // Then - the file's own base name
        expect(subjectOfSource('route-judge', source, 'route-judge.ts')).toBe('route-judge');
    });

    test('reads the module of the folder above the test’s __tests__/, its own extension first, or the one beside a rendered unit of a specs tree', () => {
        // Given - a component and a same-named plain module, a rendered unit of the component specimen, and a test naming no module
        const root = packageWith({
            'specs/component/clock/dial.tsx': 'export function ClockDial() {}\n',
            'src/locale-note.ts': 'export const other = 1;\n',
            'src/locale-note.tsx': 'export function LocaleNote() {}\n',
        });

        // Then - the .tsx answers for a .test.tsx in the tests folder; the specimen's unit beside its test; a test with no module keeps its base name
        expect(
            testTitle(join(root, 'src/__tests__/locale-note.test.tsx'), 'component'),
        ).toStrictEqual({
            named: 'LocaleNote',
            what: 'subject',
        });
        expect(
            testTitle(join(root, 'specs/component/clock/dial.test.tsx'), 'component').named,
        ).toBe('ClockDial');
        expect(testTitle(join(root, 'src/__tests__/alone.test.ts'), 'module').named).toBe('alone');
    });

    test('names an index module by the folder it stands for, the package entry aside', () => {
        // Given - a folder's index module exporting two values, neither spelling the folder
        const root = packageWith({
            'src/concurrency/index.ts':
                'export class Semaphore {}\nexport function yieldToEventLoop() {}\n',
        });

        // Then - the folder names the subject, not the word index
        expect(
            testTitle(join(root, 'src/concurrency/__tests__/index.test.ts'), 'module').named,
        ).toBe('concurrency');
        expect(testTitle(join(root, 'src/__tests__/index.test.ts'), 'module').named).toBe('index');
    });

    test.each([
        ['a variable', 'export const run = 1;\nexport const [skipped] = [];', 'run'],
        [
            'a specifier, type ones aside',
            'const a = 1;\nexport { a as run };\nexport type { T };\nexport { type U };',
            'run',
        ],
        [
            'a class or an enum beside declared and type-only ones',
            'export enum Run {}\nexport declare function shim(): void;\nexport type T = 1;\nexport interface I {}',
            'Run',
        ],
        [
            'an expression default export is no name',
            'export default 1;\nexport function run() {}',
            'run',
        ],
        [
            'a default export bound to a name',
            'const run = 1;\nexport default run;\nexport const other = 2;',
            'run',
        ],
        [
            'an anonymous default class is no name',
            'export default class {}\nexport const run = 1;',
            'run',
        ],
        ['a statement that exports nothing', 'const a = 1;\nexport const run = a;', 'run'],
    ])('names the one value export: %s', (_, source, named) => {
        // Given - a module whose one value export is written that way
        // Then - its name
        expect(subjectOfSource('base', source, 'base.ts')).toBe(named);
    });

    test('names a spec by its aspect, and a module test by the module of its own extension, deep in a folder', () => {
        // Given - a spec, tests beside modules written as .ts, .tsx or both, under a folder no manifest sits above
        const root = packageWith({
            'src/deep/both.ts': 'export const fromTs = 1;\n',
            'src/deep/both.tsx': 'export const fromTsx = 1;\n',
            'src/deep/plain.ts': 'export const fromPlain = 1;\n',
            'src/deep/rendered.tsx': 'export const fromRendered = 1;\n',
        });

        // Then - the aspect, the .ts for a .test.ts, the base of a test alone deep down, and the other extension where its own is missing
        expect([
            testTitle(join(root, 'specs/api/users/pagination.spec.ts'), 'spec'),
            testTitle(join(root, 'src/deep/both.test.ts'), 'module'),
            testTitle(join(root, 'src/deep/alone.test.ts'), 'module'),
            testTitle(join(root, 'src/deep/plain.test.tsx'), 'component'),
            testTitle(join(root, 'src/deep/rendered.test.ts'), 'module'),
        ]).toStrictEqual([
            { named: 'pagination', what: 'aspect' },
            { named: 'fromTs', what: 'subject' },
            { named: 'alone', what: 'subject' },
            { named: 'fromPlain', what: 'subject' },
            { named: 'fromRendered', what: 'subject' },
        ]);
    });
});
