/**
 * Support for the facet capability-matrix guard (`facet-matrix.test.ts`, the K1
 * guard that stops the documented `specification.{api,jobs,cli}` method matrix
 * from drifting from the real facet interfaces).
 *
 * The role vocabulary and the tiny projection helper live here — a pure module
 * with zero framework imports, so the tool-facing lint layer stays runtime-free
 * (CONVENTIONS I1). The compile-time exhaustiveness assertion itself lives in
 * the sibling test (which alone may import the facet types).
 */

/** The role a facet chain method plays: a chainable setup, or a terminal action. */
export type FacetRole = 'action' | 'setup';

/** The keys of a facet matrix that play the given role, sorted for stable comparison. */
export function methodsByRole(matrix: Record<string, FacetRole>, role: FacetRole): string[] {
    return Object.keys(matrix)
        .filter((key) => matrix[key] === role)
        .sort();
}

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
    | 'Golden'
    | 'Result accessor'
    | 'Setup'
    | 'Terminal action'
    | 'Time & doubles'
    | 'Token'
    | 'Verb';

/**
 * One thing the framework can do, and where it is declared.
 *
 * `probe` is the substring a test that EXERCISES the capability carries. It is
 * deliberately literal: a regex over test sources would answer a question about
 * the regex, and the point of the matrix is that a reader can grep the same
 * string and land on the same files.
 *
 * `exempt` is what a declared-but-empty cell is allowed to say, per column. It
 * exists for the shape M1 already sanctions — a surface the package publishes
 * and cannot prove on its own machine — and for the holes this package owes
 * itself, each named where it is rather than hidden by a blank.
 */
export type Capability = {
    /** The columns that DECLARE it. Every other column's cell is blank. */
    columns: readonly Column[];
    /** Per column: why an empty cell is accepted there. */
    exempt?: Partial<Record<Column, string>>;
    group: CapabilityGroup;
    /** How the capability is written in a spec, e.g. `.seed()`. */
    name: string;
    /** The literal a test exercising it carries. */
    probe: string;
    /**
     * Where one column writes the capability differently. A `{{token}}` family
     * is a placeholder inside a golden for a facet, and `match.<kind>()` in a
     * module test that asserts on a value — the same family, two spellings,
     * and a single probe would have to call one of them absent.
     */
    probeByColumn?: Partial<Record<Column, string>>;
};

/** The one reason the mobile column is empty, stated once (M1, chapter 03). */
const NO_SIMULATOR = 'no mobile tree: an iOS simulator is not something CI provisions (M1)';

/** Every mobile cell carries the same reason; written once, spread per row. */
const MOBILE_EXEMPT = { mobile: NO_SIMULATOR } as const;

/** A hole this package owes itself — the capability ships, the proof does not. */
const OWED = 'owed: the surface ships and this package does not specify it here yet';

/**
 * The declared capability matrix — the facet surfaces, the element vocabulary,
 * the results, the goldens and the doubles, each with the columns that carry it.
 *
 * The setups and terminal actions here are the same claims `facet-matrix.test.ts`
 * pins to the real `keyof` of every facet interface, so a method added to a facet
 * and forgotten here fails that test rather than going quietly missing from the
 * table.
 */
export const CAPABILITIES: Capability[] = [
    // ── Constructor options (stated in a `*.specification.ts`, rule A1) ──
    {
        columns: ['api', 'jobs', 'cli', 'integration', 'website'],
        group: 'Constructor option',
        name: 'services',
        probe: 'services:',
    },
    { columns: ['api', 'website'], group: 'Constructor option', name: 'server', probe: 'server:' },
    { columns: ['jobs'], group: 'Constructor option', name: 'jobs', probe: 'jobs:' },
    {
        columns: ['website'],
        exempt: {
            website:
                'the package serves its own fixture site, so `server` is what it proves; `url` targets an already-running deployment, which is a consumer shape (A11 states the XOR)',
        },
        group: 'Constructor option',
        name: 'url',
        probe: 'url:',
    },
    {
        columns: ['mobile'],
        exempt: MOBILE_EXEMPT,
        group: 'Constructor option',
        name: 'device',
        probe: 'device:',
    },
    {
        columns: ['mobile'],
        exempt: MOBILE_EXEMPT,
        group: 'Constructor option',
        name: 'app',
        probe: 'app:',
    },
    { columns: ['cli'], group: 'Constructor option', name: 'defaults', probe: 'defaults:' },
    { columns: ['component'], group: 'Constructor option', name: 'wrap', probe: 'wrap' },

    // ── Setups ──
    {
        columns: ['api', 'jobs', 'integration', 'component'],
        exempt: { jobs: OWED },
        group: 'Setup',
        name: '.clock()',
        probe: '.clock(',
    },
    {
        columns: ['api', 'jobs', 'integration', 'website', 'component'],
        exempt: { website: OWED },
        group: 'Setup',
        name: '.intercept()',
        probe: '.intercept(',
    },
    {
        columns: ['api', 'jobs', 'cli', 'integration'],
        group: 'Setup',
        name: '.seed()',
        probe: '.seed(',
    },
    { columns: ['api'], group: 'Setup', name: '.headers()', probe: '.headers(' },
    { columns: ['cli'], group: 'Setup', name: '.fixture()', probe: '.fixture(' },
    { columns: ['cli'], group: 'Setup', name: '.env()', probe: '.env(' },
    { columns: ['component'], group: 'Setup', name: '.wrap()', probe: '.wrap(' },
    { columns: ['component'], group: 'Setup', name: '.viewport()', probe: '.viewport(' },

    // ── Terminal actions ──
    { columns: ['api'], group: 'Terminal action', name: '.get()', probe: '.get(' },
    { columns: ['api'], group: 'Terminal action', name: '.post()', probe: '.post(' },
    { columns: ['api'], group: 'Terminal action', name: '.put()', probe: '.put(' },
    { columns: ['api'], group: 'Terminal action', name: '.delete()', probe: '.delete(' },
    { columns: ['api'], group: 'Terminal action', name: '.request()', probe: '.request(' },
    { columns: ['jobs'], group: 'Terminal action', name: '.trigger()', probe: '.trigger(' },
    { columns: ['integration'], group: 'Terminal action', name: '.call()', probe: '.call(' },
    { columns: ['cli'], group: 'Terminal action', name: '.exec()', probe: '.exec(' },
    { columns: ['cli'], group: 'Terminal action', name: '.run()', probe: '.run(' },
    { columns: ['website'], group: 'Terminal action', name: '.visit()', probe: '.visit(' },
    { columns: ['website'], group: 'Terminal action', name: '.fetch()', probe: '.fetch(' },
    {
        columns: ['mobile'],
        exempt: MOBILE_EXEMPT,
        group: 'Terminal action',
        name: '.open()',
        probe: '.open(',
    },
    { columns: ['component'], group: 'Terminal action', name: '.render()', probe: '.render(' },

    // ── The verbs a scenario drives ──
    {
        columns: ['website', 'mobile', 'component'],
        exempt: MOBILE_EXEMPT,
        group: 'Verb',
        name: 'see',
        probe: 'see(',
    },
    {
        columns: ['website', 'mobile', 'component'],
        exempt: MOBILE_EXEMPT,
        group: 'Verb',
        name: 'click',
        probe: 'click(',
    },
    {
        columns: ['website', 'mobile', 'component'],
        exempt: MOBILE_EXEMPT,
        group: 'Verb',
        name: 'fill',
        probe: 'fill(',
    },
    {
        columns: ['website', 'mobile', 'component'],
        exempt: { mobile: NO_SIMULATOR, website: OWED },
        group: 'Verb',
        name: 'press',
        probe: 'press(',
    },
    {
        columns: ['website', 'mobile', 'component'],
        exempt: MOBILE_EXEMPT,
        group: 'Verb',
        name: 'gone',
        probe: 'gone(',
    },
    { columns: ['component'], group: 'Verb', name: 'rerender', probe: 'rerender(' },
    { columns: ['component'], group: 'Verb', name: 'unmount', probe: 'unmount(' },

    // ── The element vocabulary ──
    {
        columns: ['website', 'mobile', 'component'],
        exempt: MOBILE_EXEMPT,
        group: 'Verb',
        name: 'button',
        probe: 'button(',
    },
    {
        columns: ['website', 'mobile', 'component'],
        exempt: MOBILE_EXEMPT,
        group: 'Verb',
        name: 'field',
        probe: 'field(',
    },
    {
        columns: ['website', 'mobile', 'component'],
        exempt: { mobile: NO_SIMULATOR, website: OWED },
        group: 'Verb',
        name: 'heading',
        probe: 'heading(',
    },
    {
        columns: ['website', 'mobile', 'component'],
        exempt: MOBILE_EXEMPT,
        group: 'Verb',
        name: 'link',
        probe: 'link(',
    },
    {
        columns: ['website', 'mobile', 'component'],
        exempt: MOBILE_EXEMPT,
        group: 'Verb',
        name: 'content',
        probe: 'content(',
    },
    {
        columns: ['website', 'mobile', 'component'],
        exempt: { mobile: NO_SIMULATOR, website: OWED },
        group: 'Verb',
        name: 'testId',
        probe: 'testId(',
    },
    { columns: ['website', 'component'], group: 'Verb', name: 'within', probe: 'within(' },
    { columns: ['website', 'component'], group: 'Verb', name: 'focused', probe: 'focused(' },
    { columns: ['website', 'component'], group: 'Verb', name: 'selected', probe: 'selected(' },
    { columns: ['website', 'component'], group: 'Verb', name: 'valued', probe: 'valued(' },

    // ── Result accessors ──
    { columns: ['api'], group: 'Result accessor', name: '.response', probe: '.response' },
    { columns: ['api', 'cli'], group: 'Result accessor', name: '.json', probe: '.json' },
    { columns: ['component'], group: 'Result accessor', name: '.text', probe: '.text' },
    {
        columns: ['api', 'jobs', 'cli', 'integration'],
        group: 'Result accessor',
        name: '.table()',
        probe: '.table(',
    },
    { columns: ['cli'], group: 'Result accessor', name: '.file()', probe: '.file(' },
    { columns: ['cli'], group: 'Result accessor', name: '.directory()', probe: '.directory(' },
    { columns: ['integration'], group: 'Result accessor', name: '.value', probe: '.value' },
    { columns: ['api', 'integration'], group: 'Result accessor', name: '.error', probe: '.error' },
    {
        columns: ['website', 'mobile', 'component'],
        exempt: MOBILE_EXEMPT,
        group: 'Result accessor',
        name: '.tree',
        probe: '.tree',
    },
    { columns: ['component'], group: 'Result accessor', name: '.html', probe: '.html' },
    { columns: ['website'], group: 'Result accessor', name: '.console', probe: '.console' },
    { columns: ['website'], group: 'Result accessor', name: '.content', probe: '.content' },
    { columns: ['cli'], group: 'Result accessor', name: '.stdout', probe: '.stdout' },
    { columns: ['cli'], group: 'Result accessor', name: '.stderr', probe: '.stderr' },
    { columns: ['cli'], group: 'Result accessor', name: '.exitCode', probe: '.exitCode' },
    { columns: ['api', 'website'], group: 'Result accessor', name: '.status', probe: '.status' },

    // ── Goldens ──
    {
        columns: ['api', 'jobs', 'cli', 'integration', 'website', 'component', 'module'],
        exempt: {
            jobs: "a job's oracle is the table it wrote (`toMatchRows`): its result carries no file and no directory",
        },
        group: 'Golden',
        name: "toMatch('<name>')",
        probe: 'toMatch(',
    },
    { columns: ['api'], group: 'Golden', name: '.http exchange', probe: ".http'" },
    {
        columns: ['website', 'component'],
        group: 'Golden',
        name: '.aria.yaml tree',
        probe: ".aria.yaml'",
    },
    { columns: ['cli'], group: 'Golden', name: 'directory golden', probe: '.directory(' },
    { columns: ['api', 'cli'], group: 'Golden', name: '{ frozen }', probe: 'frozen' },

    // ── Time and doubles, in module scope ──
    { columns: ['module'], group: 'Time & doubles', name: 'clock()', probe: 'clock(' },
    { columns: ['module'], group: 'Time & doubles', name: 'intercept()', probe: 'intercept(' },
    { columns: ['module'], group: 'Time & doubles', name: 'mockOf()', probe: 'mockOf' },
    { columns: ['module'], group: 'Time & doubles', name: 'match.*', probe: 'match.' },
];
