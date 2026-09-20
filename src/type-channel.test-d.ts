/* oxlint-disable jterrazz/a1-specification-file, typescript/no-unsafe-call, typescript/no-unsafe-return, typescript/no-unsafe-type-assertion -- every line below is a call the compiler REFUSES, marked with the `@ts-expect-error` that is the assertion: a refused call has no type, so the type-aware rules see `any` where the point is that there is nothing at all. The `specification.api()` calls are the same thing for A1: this file constructs no runner, it states what a construction may not say. */
import { mockOf, postgres, specification } from './index.js';
import type { Visitor } from './specification/ports/browser.port.js';
import type { MobileVisitor } from './specification/ports/device.port.js';

/**
 * The TYPE channel — the conventions the compiler refuses, stated as code.
 *
 * Six rows here are held by nothing else: no rule sees them, no pass walks
 * them, and the framework never gets the chance to refuse them at run time,
 * because the call they describe does not compile. Each `@ts-expect-error`
 * below IS the assertion — `typescript check` fails if the line it marks ever
 * starts compiling, which is exactly the day the convention stopped holding.
 *
 * The file is a `*.test-d.ts`: it declares no test, runs in no project, and is
 * judged by the typechecker the whole repository already runs. The W6 verb rows
 * have a fuller set of their own in
 * `src/specification/facets/component/component.types.test.ts`; one row is
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
            // @ts-expect-error A8 — `cache` is not a key of the services record
            services.cache,
        services: { db: postgres() },
    });

    // A11 — `server` and `url` state two different subjects (a site this run
    // Starts, a site already running), so the pair is inexpressible.
    await specification.website(
        // @ts-expect-error A11 — `server` and `url` are mutually exclusive
        { server: { command: 'npm start' }, url: 'https://site.test' },
    );

    const { api } = await specification.api({ server: () => ({}) as never });

    // B3 — a chain carries no label: the test's name is the sentence, and a
    // Second one inside the chain would be a second place to read it.
    // @ts-expect-error B3 — a chain carries no label
    api.label('the happy path');

    const result = await api.get('/orders/1');

    // B1 — exactly one terminal action closes a chain: what a terminal action
    // Answers is a RESULT, and a result has no verbs to continue with.
    // @ts-expect-error B1 — one terminal action closes the chain
    await result.get('/orders/2');

    // D1 — a result accessor is read-only: the answer a run produced is
    // Evidence, and a test that can rewrite its evidence proves nothing.
    // @ts-expect-error D1 — a result accessor is read-only
    result.status = 200;

    // M2 — `mockOf<Port>()` needs the port: the type argument IS the contract
    // The double stands for, and without it the double has no surface at all.
    const anonymous = mockOf();
    // @ts-expect-error M2 — a double with no port has nothing to call
    anonymous.send('reader@site.test');

    // The shape the row is written FOR, so the file also shows what passes.
    const mailer = mockOf<Mailer>();
    await mailer.send('reader@site.test');
}
