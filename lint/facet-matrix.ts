/**
 * The rows of the capability matrix the engines own — WHICH golden kind and
 * which module-scope double each kind of test has, and the literal a test
 * exercising it carries — and the vocabulary every row is written in. A
 * facet's own rows (its options, setups, actions, verbs, descriptors and
 * accessors) are stated by the definitions its composition lists
 * (`self/compositions.ts`), never here.
 *
 * A pure module with zero framework imports, so the tool-facing lint layer
 * stays runtime-free (CONVENTIONS I1).
 */

/** The columns of the capability matrix: the seven facets, plus the module test. */
export const COLUMNS = [
    'api',
    'jobs',
    'cli',
    'integration',
    'website',
    'mobile',
    'component',
    'module',
] as const;

/** One column of the capability matrix. */
export type Column = (typeof COLUMNS)[number];

/** What kind of thing a capability is — the sections the matrix is grouped into. */
export type CapabilityGroup =
    | 'Constructor option'
    | 'Descriptor'
    | 'Golden'
    | 'Result accessor'
    | 'Route option'
    | 'Setup'
    | 'Terminal action'
    | 'Time & doubles'
    | 'Token'
    | 'Verb';

/**
 * One thing the framework can do, and where it is declared.
 *
 * `probe` is what a test that EXERCISES the capability writes, spelled as it
 * reads. A CALL — `button(`, `.seed(file(`, `.get('/`, `result.table(` — is
 * read as a shape and matched against the calls of each file's syntax tree
 * (`matrix-calls.ts` owns its grammar), so a formatter splitting the call
 * across lines leaves the count as it was, and the landmark `table(` is never
 * the accessor `.table(`. Any other probe — a key, an accessor, a golden's
 * extension, a token — is matched as its literal, on a word boundary when it
 * starts with an identifier character.
 *
 * `member` is the key of the facet interface, the result class or the options
 * type this row answers for, where the row's `name` spells it differently
 * (`.request()` → `request`). It is what the sibling test pins against `keyof`.
 *
 * `exempt` is what a declared-but-empty cell is allowed to say, per column: a
 * hole this package owes itself, named where it is rather than hidden by a
 * blank.
 */
export type Capability = {
    /** The columns that DECLARE it. Every other column's cell is blank. */
    columns: readonly Column[];
    /** Per column: why an empty cell is accepted there. */
    exempt?: Partial<Record<Column, string>>;
    group: CapabilityGroup;
    /** The interface key this row answers for, when `name` is not it verbatim. */
    member?: string;
    /** How the capability is written in a spec, e.g. `.seed()`. */
    name: string;
    /** What a test exercising it writes: a call's shape, or a literal. */
    probe: string;
    /**
     * Where one column writes the capability differently. A `{{token}}` family
     * is a placeholder inside a golden for a facet, and `match.<kind>()` in a
     * module test that asserts on a value — the same family, two spellings,
     * and a single probe would have to call one of them absent.
     */
    probeByColumn?: Partial<Record<Column, string>>;
};

/** The interface key a row answers for — its `member`, or its name without punctuation. */
export function memberOf(capability: Pick<Capability, 'member' | 'name'>): string {
    return capability.member ?? capability.name.replace(/^\./u, '').replace(/\(\)$/u, '');
}

/** Why a column holds no golden FILE: every golden of its tree is read by one test, and written in place. */
const IN_PLACE =
    "every golden of this facet's tree is read by one test, so it is written in place (C28); the file form is proven where goldens are shared";

/**
 * The rows the engines own — the goldens and the doubles — each with the
 * columns that carry it. A facet's own rows are its composition's.
 */
export const CAPABILITIES: Capability[] = [
    // ── Goldens ──
    {
        columns: ['api', 'cli', 'integration', 'website', 'component', 'module'],
        exempt: { component: IN_PLACE, website: IN_PLACE },
        group: 'Golden',
        name: 'toMatch(file())',
        probe: '.toMatch(file(',
    },
    {
        columns: ['api', 'cli', 'integration', 'module'],
        group: 'Golden',
        name: 'toMatch(directory())',
        probe: '.toMatch(directory(',
    },
    {
        columns: ['api', 'jobs', 'cli', 'integration'],
        group: 'Golden',
        name: 'toMatch(<rows>)',
        probe: ')).toMatch([',
    },
    {
        columns: ['api', 'module'],
        group: 'Golden',
        name: '.http exchange',
        probe: ".http'",
    },
    {
        columns: ['website', 'component'],
        exempt: { component: IN_PLACE, website: IN_PLACE },
        group: 'Golden',
        name: '.aria.yaml tree',
        probe: ".aria.yaml'",
    },
    {
        columns: ['api', 'cli', 'integration', 'website', 'module'],
        exempt: { website: IN_PLACE },
        group: 'Golden',
        name: '.json body',
        probe: ".json'",
    },
    {
        columns: ['api', 'cli', 'integration', 'website', 'module'],
        group: 'Golden',
        name: '.txt stream',
        probe: ".txt'",
    },
    {
        columns: ['api', 'cli', 'component', 'module'],
        group: 'Golden',
        name: '{ frozen }',
        probe: 'frozen',
    },

    // ── Time and doubles, in module scope ──
    { columns: ['module'], group: 'Time & doubles', name: 'clock()', probe: 'clock.' },
    { columns: ['module'], group: 'Time & doubles', name: 'intercept()', probe: 'intercept(' },
    { columns: ['module'], group: 'Time & doubles', name: 'mockOf()', probe: 'mockOf' },
    { columns: ['module'], group: 'Time & doubles', name: 'match.*', probe: 'match.' },
];
