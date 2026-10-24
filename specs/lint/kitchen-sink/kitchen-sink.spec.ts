import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('kitchen-sink', () => {
    test('surfaces every diagnostic in one run', async () => {
        // Given - a specs tree that violates all of the checker passes
        const result = await checker
            .fixture(directory('./__fixtures__/checker-kitchen-sink/'))
            .run();

        // Then - the whole diagnostic block is asserted (the \`no-token-in-request\` line's echoed {{uuid}} token is covered by {{string}}; a literal token in the golden would itself be read as a placeholder by the grammar; see \`no-unknown-token\`)
        expect(result.report).toMatch(`
            specs/db/__seeds__/x.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as grammar/__seeds__/used.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground (a file, or a tree compared file by file) that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/__seeds__/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/__seeds__/<name>\` across specifications), named by the path that climbs to it.
                fix: give the copies the one name the entry should keep: they go by several, so \`typescript fix\` moves none
                read: docs/reference/linting.md#no-duplicate-ground
            specs/db/db.test.ts:9:1  jterrazz-check(database-named-only-when-several)
                found: \`.seed()\` with no \`{ database }\`, while 2 SQL databases are declared
                why: With ≥ 2 databases, \`database:\` is required on every \`.seed()\`/\`.table()\`; with exactly one it is forbidden, which is checked by crossing the \`services:\` record with the calls in the tests.
                fix: pass \`.seed(..., { database: '<key>' })\`, naming one of the 2 databases the services record declares
                read: docs/reference/linting.md#database-named-only-when-several
            specs/docker/docker.test.ts:8:1  jterrazz-check(docker-exec-bound-with-await-using)
                found: a result of the docker-aware runner "dockerCli" bound without \`await using\`
                why: Docker-aware runners are inferred from the \`docker:\` option of the imported specification file, and every \`.exec()\` result bound without \`await using\` is reported.
                fix: bind it with \`await using result = await dockerCli...\`, so the containers it started are removed at the end of the scope
                read: docs/reference/linting.md#docker-exec-bound-with-await-using
            specs/grammar/__expected__/out.txt:1:1  jterrazz-check(no-unknown-token)
                found: the unknown token {{userid}}
                why: Every \`{{token}}\` in an \`__expected__/\` fixture (or in an expected stream of a \`<case>.spec.yaml\` document) belongs to the frozen vocabulary; an unknown token is an error.
                fix: write one of the tokens the vocabulary has, between double braces: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir
                read: docs/reference/linting.md#no-unknown-token
            specs/grammar/__expected__/out.txt:2:1  jterrazz-check(no-malformed-ref)
                found: the malformed token {{iso8601#}}
                why: A malformed ref of a known kind (\`{{iso8601#}}\`, \`{{uuid #id}}\`) in a text file under \`__expected__/\` is an error.
                fix: write iso8601 bare, or its named capture iso8601#<name>, between double braces
                read: docs/reference/linting.md#no-malformed-ref
            specs/grammar/__requests__/req.http:1:1  jterrazz-check(http-first-line-follows-its-grammar)
                found: the first line of req.http is no request line
                why: The first line of a depth-1 \`.http\` follows its grammar: a request line (\`METHOD /path\`, or \`METHOD https://host/path\` for a deployment) under \`__requests__/\`, a status line (\`HTTP/1.1 <status>\`, or \`unreachable: <reason>\` for an exchange that never answered) under \`__expected__/\`.
                fix: start req.http with its request line, \`GET /path\`, \`GET https://host/path\` or another method
                read: docs/reference/linting.md#http-first-line-follows-its-grammar
            specs/grammar/__requests__/req.http:3:1  jterrazz-check(no-token-in-request)
                found: the token {{string}} in a __requests__/ file
                why: A known token in a file under \`__requests__/\` is an error: requests are inputs, never matched.
                fix: write the literal value the request sends: a request is sent, never matched
                read: docs/reference/linting.md#no-token-in-request
            specs/grammar/__seeds__/dead.sql:1:1  jterrazz-check(no-unused-ground)
                found: __seeds__/dead.sql, which no test of grammar names
                why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced: a folder's by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete __seeds__/dead.sql, or name it from the test that stands on it
                read: docs/reference/linting.md#no-unused-ground
            specs/grammar/__seeds__/used.sql:1:1  jterrazz-check(no-duplicate-ground)
                found: the same file as db/__seeds__/x.sql
                why: Ground several leaves share lives once: an entry of a leaf's ground (a file, or a tree compared file by file) that another leaf holds byte for byte under the same role, whatever either is called, is an error on every copy; it belongs once, in the ground of the lowest folder the leaves share (\`events/__seeds__/<name>\` for \`events/list/\` and \`events/get/\`, \`<specs>/__seeds__/<name>\` across specifications), named by the path that climbs to it.
                fix: give the copies the one name the entry should keep: they go by several, so \`typescript fix\` moves none
                read: docs/reference/linting.md#no-duplicate-ground
        `);
    });
});
