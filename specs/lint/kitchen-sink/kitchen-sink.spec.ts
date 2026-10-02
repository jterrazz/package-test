import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('kitchen-sink', () => {
    test('surfaces every diagnostic in one run', async () => {
        // Given - a specs tree that violates all of the checker passes
        const result = await checker.fixture(directory('./_fixtures/checker-kitchen-sink/')).run();

        // Then - the whole diagnostic block is asserted (the \`no-token-in-request\` line's echoed {{uuid}} token is covered by {{string}}; a literal token in the golden would itself be read as a placeholder by the grammar — see \`no-unknown-token\`)
        expect(result.report).toMatch(`
            specs/db/_seeds/x.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as grammar/_seeds/used.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground — a file, or a tree compared file by file — that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/_seeds/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/_shared/_seeds/<name>\` across facets), named by the path that climbs to it.
                fix: give the copies the one name the entry should keep — they go by several, so \`make fix\` moves none
                read: docs/19-linting.md#no-duplicate-ground
            specs/db/db.test.ts:9:1  jterrazz-check(database-named-only-when-several)
                found: \`.seed()\` with no \`{ database }\`, while 2 SQL databases are declared
                why: With ≥ 2 databases, \`database:\` is required on every \`.seed()\`/\`.table()\`; with exactly one it is forbidden — checked by crossing the \`services:\` record with the calls in the tests.
                fix: pass \`.seed(…, { database: '<key>' })\`, naming one of the 2 databases the services record declares
                read: docs/19-linting.md#database-named-only-when-several
            specs/docker/docker.test.ts:8:1  jterrazz-check(docker-exec-bound-with-await-using)
                found: a result of the docker-aware runner "dockerCli" bound without \`await using\`
                why: Docker-aware runners are inferred from the \`docker:\` option of the imported specification file, and every \`.exec()\` result bound without \`await using\` is reported.
                fix: bind it with \`await using result = await dockerCli…\`, so the containers it started are removed at the end of the scope
                read: docs/19-linting.md#docker-exec-bound-with-await-using
            specs/grammar/_expected/out.txt:1:1  jterrazz-check(no-unknown-token)
                found: the unknown token {{userid}}
                why: Every \`{{token}}\` in an \`_expected/\` fixture — or in an expected stream of a \`<case>.spec.yaml\` document — belongs to the frozen vocabulary; an unknown token is an error.
                fix: write one of the tokens the vocabulary has, between double braces: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir
                read: docs/19-linting.md#no-unknown-token
            specs/grammar/_expected/out.txt:2:1  jterrazz-check(no-malformed-ref)
                found: the malformed token {{iso8601#}}
                why: A malformed ref of a known kind (\`{{iso8601#}}\`, \`{{uuid #id}}\`) in a text file under \`_expected/\` is an error.
                fix: write iso8601 bare, or its named capture iso8601#<name>, between double braces
                read: docs/19-linting.md#no-malformed-ref
            specs/grammar/_requests/req.http:1:1  jterrazz-check(http-first-line-follows-its-grammar)
                found: the first line of req.http is no request line
                why: The first line of a depth-1 \`.http\` follows its grammar: a request line (\`METHOD /path\`) under \`_requests/\`, a status line (\`HTTP/1.1 <status>\`) under \`_expected/\`.
                fix: start req.http with its request line, \`GET /path\` or another method
                read: docs/19-linting.md#http-first-line-follows-its-grammar
            specs/grammar/_requests/req.http:3:1  jterrazz-check(no-token-in-request)
                found: the token {{string}} in a _requests/ file
                why: A known token in a file under \`_requests/\` → error: requests are inputs, never matched.
                fix: write the literal value the request sends — a request is sent, never matched
                read: docs/19-linting.md#no-token-in-request
            specs/grammar/_seeds/dead.sql:1:1  jterrazz-check(no-unused-ground)
                found: _seeds/dead.sql, which no test of grammar names
                why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete _seeds/dead.sql, or name it from the test that stands on it
                read: docs/19-linting.md#no-unused-ground
            specs/grammar/_seeds/used.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as db/_seeds/x.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground — a file, or a tree compared file by file — that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/_seeds/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/_shared/_seeds/<name>\` across facets), named by the path that climbs to it.
                fix: give the copies the one name the entry should keep — they go by several, so \`make fix\` moves none
                read: docs/19-linting.md#no-duplicate-ground
        `);
    });
});
