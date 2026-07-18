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

// C8 resolves references against the on-disk conventional roots relative to the
// Test file's directory, so the cases are anchored to REAL spec dirs whose
// Fixtures ship in the repo — exercising every verb root, the $FIXTURES
// Walk-up, trailing-slash normalisation and the looksLikePath skip.
const SPECS = resolve(import.meta.dirname, '../../../specs');
const EXEC = `${SPECS}/cli/exec/exec.test.ts`; // Expected/help.txt, expected/start.txt
const SEEDING = `${SPECS}/cli/seeding/seeding.test.ts`; // Seeds/users.sql, fixtures/note.txt
const REQUESTS = `${SPECS}/api/requests/requests.test.ts`; // Requests/create-user.http
const DIRECTORY = `${SPECS}/cli/directory/directory.test.ts`; // Expected/cli-scaffold/out/ (tree)

ruleTester.run('c8-referenced-fixture-exists', c8ReferencedFixtureExists as unknown as OxlintRule, {
    invalid: [
        // ToMatch → expected/ file that does not exist.
        {
            code: 'expect(result.stdout).toMatch("missing.txt");',
            errors: 1,
            filename: EXEC,
        },
        // Seed → seeds/ file that does not exist.
        {
            code: 'cli.seed("ghost.sql");',
            errors: 1,
            filename: SEEDING,
        },
        // Request → requests/ file that does not exist.
        {
            code: 'api.request("ghost.http");',
            errors: 1,
            filename: REQUESTS,
        },
        // Fixture → feature-local fixtures/ file that does not exist.
        {
            code: 'cli.fixture("ghost.txt");',
            errors: 1,
            filename: SEEDING,
        },
        // Fixture → $FIXTURES pool entry that does not exist (walk-up to specs/fixtures/).
        {
            code: 'cli.fixture("$FIXTURES/ghost/");',
            errors: 1,
            filename: EXEC,
        },
    ],
    valid: [
        // ToMatch → an existing expected/ file.
        { code: 'expect(result.stdout).toMatch("help.txt");', filename: EXEC },
        // ToMatch → a trailing slash is normalised away before resolution.
        { code: 'expect(result.stdout).toMatch("help.txt/");', filename: EXEC },
        // ToMatch → an existing expected/ directory-tree snapshot.
        {
            code: 'await expect(result.directory("out")).toMatch("cli-scaffold/out");',
            filename: DIRECTORY,
        },
        // Seed → an existing seeds/ file.
        { code: 'cli.seed("users.sql");', filename: SEEDING },
        // Request → an existing requests/ file.
        { code: 'api.request("create-user.http");', filename: REQUESTS },
        // Fixture → an existing feature-local fixtures/ file.
        { code: 'cli.fixture("note.txt");', filename: SEEDING },
        // Fixture → an existing $FIXTURES pool entry (walk-up to specs/fixtures/cli-app/).
        { code: 'cli.fixture("$FIXTURES/cli-app/");', filename: EXEC },
        // Seed → raw SQL (whitespace) is inline content, not a path — skipped.
        { code: 'cli.seed("INSERT INTO users VALUES (1)");', filename: SEEDING },
        // Fixture → an unknown $marker is B2's concern, not existence — skipped.
        { code: 'cli.fixture("$UNKNOWN/x");', filename: EXEC },
        // Non-literal argument is out of static reach — skipped.
        { code: 'cli.seed(fileName);', filename: SEEDING },
        // A method that is not a fixture-referencing verb is ignored.
        { code: 'result.grep("help.txt");', filename: EXEC },
        // Outside specs/ the rule is inert.
        {
            code: 'expect(x).toMatch("nope.txt");',
            filename: '/repo/src/core/matching/match.test.ts',
        },
    ],
});
