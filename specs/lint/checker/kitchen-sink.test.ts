import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('kitchen-sink', () => {
    // The \`output-asserted-as-a-golden\` regression net: one project tripping every checker pass, one full-output golden that churns with the diagnostic surface by design.
    test('surfaces every diagnostic in one run', async () => {
        // Given - a specs tree that violates all of the checker passes
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-kitchen-sink/'))
            .exec('.');

        // Then - the whole diagnostic block is asserted (the \`no-token-in-request\` line's echoed {{uuid}} token is covered by {{string}}; a literal token in the golden would itself be read as a placeholder by the grammar — see \`no-unknown-token\`)
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/grammar/expected/out.txt:1:1: error jterrazz-check(no-unknown-token): found: the unknown token {{userid}} · why: Every \`{{token}}\` in an \`expected/\` fixture — or in an expected stream of a \`<case>.spec.yaml\` document — belongs to the frozen vocabulary; an unknown token is an error. · fix: write one of the tokens the vocabulary has, between double braces: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir · read: docs/19-linting.md#no-unknown-token
            specs/grammar/expected/out.txt:2:1: error jterrazz-check(no-malformed-ref): found: the malformed token {{iso8601#}} · why: A malformed ref of a known kind (\`{{iso8601#}}\`, \`{{uuid #id}}\`) in a text file under \`expected/\` is an error. · fix: write iso8601 bare, or its named capture iso8601#<name>, between double braces · read: docs/19-linting.md#no-malformed-ref
            specs/grammar/requests/req.http:1:1: error jterrazz-check(http-first-line-follows-its-grammar): found: the first line of req.http is no request line · why: The first line of a depth-1 \`.http\` follows its grammar: a request line (\`METHOD /path\`) under \`requests/\`, a status line (\`HTTP/1.1 <status>\`) under \`expected/\`. · fix: start req.http with its request line, \`GET /path\` or another method · read: docs/19-linting.md#http-first-line-follows-its-grammar
            specs/grammar/requests/req.http:3:1: warning jterrazz-check(no-token-in-request): found: the token {{string}} in a requests/ file · why: A known token in a file under \`requests/\` → warning: requests are inputs, never matched. · fix: write the literal value the request sends — a request is sent, never matched · read: docs/19-linting.md#no-token-in-request
            specs/grammar/seeds/dead.sql:1:1: error jterrazz-check(no-unused-ground): found: seeds/dead.sql, which no test of grammar names · why: No dead fixtures: every file under \`seeds/\`/\`requests/\`/\`fixtures/\` and every top-level entry of \`expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete seeds/dead.sql, or name it from the test that stands on it · read: docs/19-linting.md#no-unused-ground
            specs/db/seeds/x.sql:1:1: warning jterrazz-check(no-duplicate-ground): found: the same file as grammar/seeds/used.sql · why: Ground several leaves share lives once: an entry of a leaf's ground — a file, or a tree compared file by file — that another leaf holds byte for byte under the same role, whatever either is called, is a warning on every copy; it belongs in the specs root's shared folder of its role (\`<specs>/shared/seeds/<name>\`), named by the path that climbs to it. · fix: give the copies the one name the entry should keep — they go by several, so \`make fix\` moves none · read: docs/19-linting.md#no-duplicate-ground
            specs/grammar/seeds/used.sql:1:1: warning jterrazz-check(no-duplicate-ground): found: the same file as db/seeds/x.sql · why: Ground several leaves share lives once: an entry of a leaf's ground — a file, or a tree compared file by file — that another leaf holds byte for byte under the same role, whatever either is called, is a warning on every copy; it belongs in the specs root's shared folder of its role (\`<specs>/shared/seeds/<name>\`), named by the path that climbs to it. · fix: give the copies the one name the entry should keep — they go by several, so \`make fix\` moves none · read: docs/19-linting.md#no-duplicate-ground
            specs/docker/docker.test.ts:8:1: error jterrazz-check(docker-exec-bound-with-await-using): found: a result of the docker-aware runner "dockerCli" bound without \`await using\` · why: \`docker-exec-bound-with-await-using\`'s one channel: docker-aware runners are inferred from the \`docker:\` option of the imported specification file, and every \`.exec()\` result bound without \`await using\` is reported. · fix: bind it with \`await using result = await dockerCli…\`, so the containers it started are removed at the end of the scope · read: docs/19-linting.md#docker-exec-bound-with-await-using
            specs/db/db.test.ts:9:1: error jterrazz-check(database-named-only-when-several): found: \`.seed()\` with no \`{ database }\`, while 2 SQL databases are declared · why: With ≥ 2 databases, \`database:\` is required on every \`.seed()\`/\`.table()\`; with exactly one it is forbidden — checked by crossing the \`services:\` record with the calls in the tests. · fix: pass \`.seed(…, { database: '<key>' })\`, naming one of the 2 databases the services record declares · read: docs/19-linting.md#database-named-only-when-several

            conventions checker: 6 error(s) found under {{workdir}}
        `);
    });
});
