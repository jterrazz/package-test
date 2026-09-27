export const REFUSAL_WHY = {
    'database-named-only-when-several-at-runtime':
        'With two SQL databases or more, a seed or a table names the `database:` it reads, and with exactly one it names none.',
    'route-written-as-template-at-runtime':
        'A request written as its route template is handed exactly the parameters the template names.',
    'disk-named-by-relative-path-at-runtime':
        'A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.',
    'one-verb-per-meaning':
        '`toMatch` on a result the framework produced compares the WHOLE result, to a value written in place or to a `file()`/`directory()` golden.',
    'network-strict-after-first-stub':
        'From its first stub, a chain’s network is strict: every outgoing request matches a declared stub.',
    'descriptor-matches-one-element':
        'A verb acts on exactly ONE element: a descriptor that matches several is refused, never settled by the first.',
    'seam-is-an-optional-peer':
        'Every seam is an optional peer of @jterrazz/test, installed by the project that specifies through it.',
    'no-landmark-on-mobile':
        'An iOS screen has no ARIA landmark: a mobile verb is scoped with `within(testId(…), …)`.',
} as const;

export type RefusalRow = keyof typeof REFUSAL_WHY;
