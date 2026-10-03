/** A consumer's stub sits in `stubs/<kind>/`; the layout rules read the kinds from here. */
export const STUB_KINDS = ['anthropic', 'http', 'openai'] as const;

export type StubKind = (typeof STUB_KINDS)[number];

export function isStubKind(name: string): name is StubKind {
    return (STUB_KINDS as readonly string[]).includes(name);
}
