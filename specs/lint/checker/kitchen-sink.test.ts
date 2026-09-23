import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('lint — checker kitchen-sink (CONVENTIONS D11)', () => {
    // The D11 regression net: ONE fixture project that trips every checker pass
    // At once — D4 unknown + malformed tokens, D4b http first line, D10 token
    // Leak, C9 dead fixture, B5 await-using inference and A7 database — asserted
    // As a single full-output golden. It churns as the diagnostic surface
    // Evolves; that is its job (the checker output is OURS, so D11(d) is moot).
    test('surfaces every diagnostic in one run', async () => {
        // Given - a specs tree that violates all of the checker passes
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-kitchen-sink/'))
            .exec('.');

        // Then - the whole diagnostic block is asserted (the D10 line's echoed {{uuid}} token is covered by {{string}}; a literal token in the golden would itself be read as a placeholder by the grammar — see D4)
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/grammar/expected/out.txt:1:1: error jterrazz-check(d4): unknown token {{string}} — the D4 vocabulary is frozen (known: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir)
            specs/grammar/expected/out.txt:2:1: error jterrazz-check(d4): unknown token {{string}} — the D4 vocabulary is frozen (known: any, base64, date, duration, email, float, hex, int, ip, iso8601, number, path, port, semver, sha, string, time, ulid, url, uuid, workdir)
            specs/grammar/requests/req.http:1:1: error jterrazz-check(d4b): a requests/*.http file must start with a request line "METHOD /path"
            specs/grammar/requests/req.http:3:1: warning jterrazz-check(d10w): token {{string}} in a requests/ file — requests are inputs, never matched; tokens are not validated here
            specs/grammar/seeds/dead.sql:1:1: error jterrazz-check(c9): dead fixture — no test literal in grammar references seeds/dead.sql
            specs/db/seeds/x.sql:1:1: warning jterrazz-check(c27w): the same file is in grammar/seeds/used.sql — ground several leaves share lives once — the copies go by several names, so \`--fix\` moves none: give them the one name the entry should keep
            specs/grammar/seeds/used.sql:1:1: warning jterrazz-check(c27w): the same file is in db/seeds/x.sql — ground several leaves share lives once — the copies go by several names, so \`--fix\` moves none: give them the one name the entry should keep
            specs/docker/docker.test.ts:8:1: error jterrazz-check(b5): result of docker-aware runner "dockerCli" must be bound with \`await using\` so its containers are disposed
            specs/db/db.test.ts:9:1: error jterrazz-check(a7): .seed() must pass { database } — 2 SQL databases are declared

            conventions checker: 6 error(s) found under {{workdir}}
        `);
    });
});
