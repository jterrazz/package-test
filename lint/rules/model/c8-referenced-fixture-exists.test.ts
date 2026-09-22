import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c8ReferencedFixtureExists } from './c8-referenced-fixture-exists.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

// C8 resolves a path from the test file's own directory, so the cases are
// Anchored to REAL spec dirs whose ground ships in the repo.
const SPECS = resolve(import.meta.dirname, '../../../specs');
const EXEC = `${SPECS}/cli/exec/exec.spec.ts`;
const SEEDING = `${SPECS}/cli/seeding/seeding.spec.ts`;
const REQUESTS = `${SPECS}/api/sending/sending.spec.ts`;
const DIRECTORY = `${SPECS}/cli/directory/directory.spec.ts`;

ruleTester.run('c8-referenced-fixture-exists', c8ReferencedFixtureExists as unknown as OxlintRule, {
    invalid: [
        {
            code: 'expect(result.stdout).toMatch(file("./expected/missing.txt"));',
            errors: 1,
            filename: EXEC,
        },
        { code: 'cli.seed(file("./seeds/ghost.sql"));', errors: 1, filename: SEEDING },
        { code: 'api.request(file("./requests/ghost.http"));', errors: 1, filename: REQUESTS },
        { code: 'cli.fixture(file("./fixtures/ghost.txt"));', errors: 1, filename: SEEDING },
        // The pool, reached by the path that climbs to it — and the entry is not there.
        { code: 'cli.fixture(directory("../../fixtures/ghost/"));', errors: 1, filename: EXEC },
        // The verb states the kind: a directory is not a file, a file is not a tree.
        { code: 'cli.fixture(file("../../fixtures/cli-app"));', errors: 1, filename: EXEC },
        {
            code: 'await expect(result.filesystem).toMatch(directory("./expected/help.txt/"));',
            errors: 1,
            filename: EXEC,
        },
    ],
    valid: [
        { code: 'expect(result.stdout).toMatch(file("./expected/help.txt"));', filename: EXEC },
        {
            code: 'await expect(result.directory("out")).toMatch(directory("./expected/cli-scaffold/out/"));',
            filename: DIRECTORY,
        },
        { code: 'cli.seed(file("./seeds/users.sql"));', filename: SEEDING },
        { code: 'api.request(file("./requests/create-user.http"));', filename: REQUESTS },
        { code: 'cli.fixture(file("./fixtures/note.txt"));', filename: SEEDING },
        { code: 'cli.fixture(directory("../../fixtures/cli-app/"));', filename: EXEC },
        // Not a relative path — the type's refusal (B2), not existence.
        { code: 'cli.seed(file("users.sql"));', filename: SEEDING },
        // Non-literal argument is out of static reach — skipped.
        { code: 'cli.seed(file(fileName));', filename: SEEDING },
        // A method that is not a file verb is ignored.
        { code: 'result.grep("./help.txt");', filename: EXEC },
        // Outside specs/ the rule is inert.
        {
            code: 'expect(x).toMatch(file("./nope.txt"));',
            filename: '/repo/src/specification/matching/match.test.ts',
        },
    ],
});
