/* oxlint-disable jterrazz/a1-specification-file, jterrazz/d2-await-io-matcher, jterrazz/f2-no-test-imports-in-prod, typescript/no-unsafe-call, typescript/no-unsafe-return, typescript/no-unsafe-type-assertion -- every line below is a call the compiler REFUSES, marked with the `@ts-expect-error` that is the assertion: a refused call has no type, so the type-aware rules see `any` where the point is that there is nothing at all, and a refused golden is typed as the overload it failed, never awaited. The `specification.api()` calls are the same thing for A1: this file constructs no runner, it states what a construction may not say. It imports vitest's `expect` because the D14 rows are about the matcher augmentation, and it runs nothing: no test is declared, so F2's production reach does not apply. */
import { expect } from 'vitest';

import { directory, file, mockOf, postgres, specification } from './index.js';
import type { Visitor } from './model/ports/browser.port.js';
import type { MobileVisitor } from './model/ports/device.port.js';

/**
 * The TYPE channel — the conventions the compiler refuses, stated as code.
 *
 * The rows here are held by nothing else: no rule sees them, no pass walks
 * them, and the framework never gets the chance to refuse them at run time,
 * because the call they describe does not compile. Each `@ts-expect-error`
 * below IS the assertion — `typescript check` fails if the line it marks ever
 * starts compiling, which is exactly the day the convention stopped holding.
 *
 * The file is a `*.test-d.ts`: it declares no test, runs in no project, and is
 * judged by the typechecker the whole repository already runs. The W6 verb rows
 * have a fuller set of their own in
 * `src/facets/component/component.shape.test.ts`; one row is
 * restated here so the channel has a single entry point.
 *
 * W4 (an ARIA landmark handed to a mobile verb) is deliberately NOT here: the
 * two facets share one `ElementRef` on purpose, so the refusal is the runtime
 * row's, and the catalogue says so.
 */

/** A port with one method — the shape a double is asked for. */
type Mailer = { send: (to: string) => Promise<void> };

/** Resolves only for `true` — the shape a verb row is stated in. */
type Assert<Row extends true> = Row;

/** Does this visitor offer the verb? */
type Carries<Verbs, Verb extends string> = Verb extends keyof Verbs ? true : false;

// W6 — the verb set is the boundary between the facets: a page is navigated,
// A screen is tapped, and neither vocabulary borrows the other's word.
export type WebsiteGoes = Assert<Carries<Visitor, 'goto'>>;
export type MobileNeverGoes = Assert<Carries<MobileVisitor, 'goto'> extends false ? true : false>;

/** Every row of the channel, as one function the compiler reads. */
export async function typeRows(): Promise<void> {
    // A8 — the `services` record types the factory argument: a key that is not
    // In the record is not a service, and the failure belongs at the call.
    await specification.api({
        server: (services) =>
            // @ts-expect-error A8 — `cache` is not a key of the services record [`Property 'cache' does not exist on type '{ db: PostgresHandle; }'`]
            services.cache,
        services: { db: postgres() },
    });

    // A11 — `server` and `url` state two different subjects (a site this run
    // Starts, a site already running), so the pair is inexpressible.
    await specification.website(
        // @ts-expect-error A11 — `server` and `url` are mutually exclusive [`Types of property 'url' are incompatible`]
        { server: { command: 'npm start' }, url: 'https://site.test' },
    );

    const { api } = await specification.api({ server: () => ({}) as never });
    const { cli } = await specification.cli('./bin.sh');

    // B3 — a chain carries no label: the test's name is the sentence, and a
    // Second one inside the chain would be a second place to read it.
    // @ts-expect-error B3 — a chain carries no label [`Property 'label' does not exist on type 'ApiSpecification<never>'`]
    api.label('the happy path');

    // B2 — a string is a value and the disk is `file()` or `directory()`: a
    // Bare string where a file is meant, a file with the wrong tail, a path that
    // Is not relative, a directory without its `/` — none of them compiles. The
    // Golden rows are D14's, below.
    // @ts-expect-error B2 — a bare string is a value, not a file [`Argument of type 'string' is not assignable to parameter of type 'DiskFile<".sql">'`]
    api.seed('./seeds/x.sql');
    // @ts-expect-error B2 — a seed's path ends in `.sql` [`Argument of type 'FileAt<"./seeds/x.json">' is not assignable to parameter of type 'DiskFile<".sql">'`]
    api.seed(file('./seeds/x.json'));
    // @ts-expect-error B2 — a path is relative to the spec file [`Argument of type '"x.sql"' is not assignable to parameter of type 'RelativePath<string>'`]
    api.seed(file('x.sql'));
    // @ts-expect-error B2 — a directory's path ends in `/` [`Argument of type '"./fixtures/shop"' is not assignable to parameter of type 'RelativePath<"/">'`]
    cli.fixture(directory('./fixtures/shop'));
    // @ts-expect-error B2 — a path ending in `/` is a directory [`Argument of type '"./fixtures/shop/"' is not assignable to parameter of type 'never'`]
    cli.fixture(file('./fixtures/shop/'));
    // @ts-expect-error B2 — a request is one `.http` file, not a directory [`is not assignable to parameter of type 'DiskFile<".http">'`]
    await api.request(directory('./requests/'));
    // @ts-expect-error B2 — a document is a `.spec.yaml` file [`Argument of type 'FileAt<"./case.yaml">' is not assignable to parameter of type 'DiskFile<".spec.yaml">'`]
    await cli.run(file('./case.yaml'));
    // @ts-expect-error B2 — a path is a value where a verb takes one [`Argument of type 'FileAt<"./requests/orders.http">' is not assignable to parameter of type 'string'`]
    await api.get(file('./requests/orders.http'));
    // @ts-expect-error B2 — a command is a value where a verb takes one [`Argument of type 'FileAt<"./fixtures/args.txt">' is not assignable to parameter of type 'string | string[] | undefined'`]
    await cli.exec(file('./fixtures/args.txt'));

    // D14 — the golden half of `toMatch` takes the disk its subject has: a
    // Value subject has none, a stream's is a file, a tree's is a directory.
    const out = await cli.exec();
    // @ts-expect-error D14 — a string subject has no golden: its argument is a value [`Argument of type 'FileAt<"./expected/abc.txt">' is not assignable to parameter of type 'string | RegExp'`]
    expect('abc').toMatch(file('./expected/abc.txt'));
    // @ts-expect-error D14 — a stream's golden is a file [`is not assignable to parameter of type 'DiskFile'`]
    expect(out.stdout).toMatch(directory('./expected/out/'));
    // @ts-expect-error D14 — a tree's golden is a directory [`Argument of type 'FileAt<"./expected/tree.txt">' is not assignable to parameter of type 'DiskDirectory'`]
    await expect(out.filesystem).toMatch(file('./expected/tree.txt'));
    expect(out.stdout).toMatch(file('./expected/out.txt'));
    expect(out.stdout.text).toMatch(/built/u);
    await expect(out.filesystem).toMatch(directory('./expected/tree/'));

    // What the rows are written FOR — the disk where the disk is meant.
    await api.seed(file('./seeds/orders.sql')).post('/orders', file('./requests/order.json'));
    await cli.fixture(directory('../../fixtures/shop/')).fixture(file('./fixtures/a.json')).exec();

    const result = await api.get('/orders/1');

    // B1 — exactly one terminal action closes a chain: what a terminal action
    // Answers is a RESULT, and a result has no verbs to continue with.
    // @ts-expect-error B1 — one terminal action closes the chain [`Property 'get' does not exist on type 'HttpResult'`]
    await result.get('/orders/2');

    // D1 — a result accessor is read-only: the answer a run produced is
    // Evidence, and a test that can rewrite its evidence proves nothing.
    // @ts-expect-error D1 — a result accessor is read-only [`Cannot assign to 'status' because it is a read-only property`]
    result.status = 200;

    // M2 — `mockOf<Port>()` needs the port: the type argument IS the contract
    // The double stands for, and without it the double has no surface at all.
    const anonymous = mockOf();
    // @ts-expect-error M2 — a double with no port has nothing to call [`Property 'send' does not exist on type 'object'`]
    anonymous.send('reader@site.test');

    // The shape the row is written FOR, so the file also shows what passes.
    const mailer = mockOf<Mailer>();
    await mailer.send('reader@site.test');
}

/**
 * D14, the value half — a stream is not a string: a value matcher reads its
 * `.text`, and vitest's `toContain` handed the accessor would search an empty
 * list, so `.not` would pass on anything. An empty stream is an empty text:
 * `toBeEmpty` is a table's matcher.
 */
export async function streamValueRows(): Promise<void> {
    const { cli } = await specification.cli('./bin.sh');
    const out = await cli.exec();
    // @ts-expect-error D14 — a stream compared as a value is its text [`Type 'never' has no call signatures`]
    expect(out.stdout).toContain('built');
    // @ts-expect-error D14 — a stream compared as a value is its text [`Type 'never' has no call signatures`]
    expect(out.stderr).not.toContain('warning');
    expect(out.stdout.text).toContain('built');
    expect(['built']).toContain('built');
    // @ts-expect-error D14 — an empty stream is an empty text [`Type 'never' has no call signatures`]
    await expect(out.stderr).toBeEmpty();
    expect(out.stderr.text).toBe('');
}
