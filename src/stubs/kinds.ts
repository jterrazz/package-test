/**
 * The kinds a stub is built by — one per builder the package exports, each in
 * its own folder under `src/stubs/<kind>/`. A consumer's stub sits in the
 * folder of its kind (`stubs/<kind>/<name>.ts`), and the rules that read that
 * layout take the list from here: a kind the package does not export is no
 * folder a stub may sit in.
 */
export const STUB_KINDS = ['anthropic', 'http', 'openai'] as const;

/** One stub kind — the name of its builder, and of its folder. */
export type StubKind = (typeof STUB_KINDS)[number];

/** Is this name one of the stub kinds? */
export function isStubKind(name: string): name is StubKind {
    return (STUB_KINDS as readonly string[]).includes(name);
}
