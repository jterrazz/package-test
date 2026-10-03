import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { CHARTS, migrating, RUNNER, specsTree } from '../../kit/testing/subject.fixtures.js';
import { checkSpecInSubjectFolder } from './spec-in-subject-folder.js';

describe('checkSpecInSubjectFolder', () => {
    test('spec-in-subject-folder — a route written as its template is filed under the route, and a filled one that reads two ways teaches the template', () => {
        // Given - the chart route twice: once as a template, once as the path it fills
        const root = specsTree(CHARTS);

        // Then - the template's file goes to indicators/chart/; the filled one is reported at its chain
        expect(checkSpecInSubjectFolder(root)).toStrictEqual([
            {
                column: 31,
                path: 'api/charts/filled.spec.ts',
                fix: "write the route's template: `.get('/indicators/:<name>/chart', { params: { <name>: 'btc' } })` — or, if `btc` is the route's own segment, state that the path is the route: `.get('/indicators/btc/chart', { params: {} })`",
                found: '`GET /indicators/btc/chart` names `btc` right after the collection `indicators`: a value or a segment of the route, and the folder depends on which',
                line: 2,
                rule: 'spec-in-subject-folder',
            },
            {
                path: 'api/charts/templated.spec.ts',
                fix: 'move it to api/indicators/chart/templated.spec.ts — `typescript fix` moves it, and the ground it stands on',
                found: 'a spec of GET /indicators/:id/chart, filed under api/charts/',
                line: 1,
                rule: 'spec-in-subject-folder',
            },
        ]);
    });

    test('spec-in-subject-folder — a cli command is its first word, unless its runner declares the words of its commands', () => {
        // Given - one spec running `db migrate`, from a runner that declares no list, and one from a runner that does
        const root = specsTree({
            'cli/cli.specification.ts':
                'export const { cleanup, cli } = await specification.cli(BIN);\n',
            'cli/db-cli.specification.ts':
                "export const { cleanup, cli } = await specification.cli(BIN, { commands: ['db', 'migrate'] });\n",
            'cli/first/runs.spec.ts': migrating('cli'),
            'cli/listed/runs.spec.ts': migrating('db-cli'),
        });

        // Then - the first word files the one, the declared words the other
        expect(checkSpecInSubjectFolder(root).map(({ fix }) => fix)).toStrictEqual([
            'move it to cli/db/runs.spec.ts — `typescript fix` moves it, and the ground it stands on',
            'move it to cli/db/migrate/runs.spec.ts — `typescript fix` moves it, and the ground it stands on',
        ]);
    });

    test('spec-in-subject-folder — a collection no plural names is listed once the repository declares it', () => {
        // Given - GET /data filed as a singleton would be, in a unit whose config names `data` a collection
        const root = specsTree({
            'api/api.specification.ts': RUNNER,
            'api/data/get/listing.spec.ts': [
                "import { api } from '../../api.specification.js';",
                "test('a', async () => { await api.get('/data'); });",
                '',
            ].join('\n'),
        });
        const plain = checkSpecInSubjectFolder(root);
        writeFileSync(
            join(dirname(root), 'jterrazz.config.ts'),
            "export default { test: { collections: ['data'] } };\n",
        );
        writeFileSync(join(dirname(root), 'package.json'), '{}\n');

        // Then - no finding before the declaration, and the list folder after it
        expect(plain).toStrictEqual([]);
        expect(checkSpecInSubjectFolder(root).map(({ fix }) => fix)).toStrictEqual([
            'move it to api/data/list/listing.spec.ts — `typescript fix` moves it, and the ground it stands on',
        ]);
    });
});
