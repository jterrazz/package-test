/**
 * The facet capability declaration — the one statement of WHICH capability
 * each kind of test has, and the literal a test exercising it carries.
 *
 * It is not a third copy of the surface: every row of the four groups a facet
 * interface can answer for (constructor options, setups, terminal actions,
 * result accessors) and every verb of a visitor is pinned to the real `keyof`
 * of that interface by `facet-matrix.test.ts`, in BOTH directions — a member
 * added to a facet and forgotten here fails the build, and a row naming a
 * member no interface has fails it too. The element vocabulary is pinned to
 * the exports of `model/elements/elements.ts` the same way.
 *
 * The role vocabulary and the tiny projection helper live here — a pure module
 * with zero framework imports, so the tool-facing lint layer stays runtime-free
 * (CONVENTIONS I1). The compile-time exhaustiveness assertions themselves live
 * in the sibling test (which alone may import the facet types).
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
    | 'Descriptor'
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
 * `probe` is the literal a test that EXERCISES the capability carries. It is
 * deliberately literal: a regex over test sources would answer a question about
 * the regex, and the point of the matrix is that a reader can grep the same
 * string and land on the same files. A probe that starts with an identifier
 * character is matched on a word boundary, so `row(` is not found inside
 * `narrow(` and the landmark `table(` is not found in the accessor `.table(`.
 *
 * `member` is the key of the facet interface, the result class or the options
 * type this row answers for, where the row's `name` spells it differently
 * (`.seed()` → `seed`). It is what the sibling test pins against `keyof`.
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
    /** The interface key this row answers for, when `name` is not it verbatim. */
    member?: string;
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

/** The interface key a row answers for — its `member`, or its name without punctuation. */
export function memberOf(capability: Capability): string {
    return capability.member ?? capability.name.replace(/^\./u, '').replace(/\(\)$/u, '');
}

/** The one reason the mobile column is empty, stated once (M1, chapter 03). */
const NO_SIMULATOR = 'no mobile tree: an iOS simulator is not something CI provisions (M1)';

/** Every mobile cell carries the same reason; written once, spread per row. */
const MOBILE_EXEMPT = { mobile: NO_SIMULATOR } as const;

/** A hole this package owes itself — the capability ships, the proof does not. */
const OWED = 'the surface ships and this package does not specify it here yet';

/** Why website's `url` is empty, and will stay so. */
const SERVES_ITS_OWN_SITE =
    'the package serves its own fixture site, so `server` is what it proves; `url` targets an already-running deployment, which is a consumer shape (A11 states the XOR)';

/** The three surfaces that draw, and their shared vocabulary. */
const DRAWS = ['website', 'mobile', 'component'] as const;

/** The two browser surfaces — the full element vocabulary is theirs. */
const BROWSERS = ['website', 'component'] as const;

/**
 * The declared capability matrix — the facet surfaces, the element vocabulary,
 * the results, the goldens and the doubles, each with the columns that carry it.
 */
export const CAPABILITIES: Capability[] = [
    // ── Constructor options (stated in a `*.specification.ts`, rule A1) ──
    {
        columns: ['api', 'jobs', 'cli', 'integration', 'website', 'mobile'],
        exempt: MOBILE_EXEMPT,
        group: 'Constructor option',
        name: 'services',
        probe: 'services:',
    },
    {
        columns: ['api', 'jobs', 'cli', 'integration', 'website', 'mobile', 'component'],
        exempt: { cli: OWED, component: OWED, mobile: NO_SIMULATOR, website: OWED },
        group: 'Constructor option',
        name: 'root',
        probe: 'root:',
    },
    { columns: ['api', 'website'], group: 'Constructor option', name: 'server', probe: 'server:' },
    { columns: ['jobs'], group: 'Constructor option', name: 'jobs', probe: 'jobs:' },
    {
        columns: ['website'],
        exempt: { website: SERVES_ITS_OWN_SITE },
        group: 'Constructor option',
        name: 'url',
        probe: 'url:',
    },
    {
        columns: ['website', 'mobile'],
        exempt: { mobile: NO_SIMULATOR, website: OWED },
        group: 'Constructor option',
        name: 'backend',
        probe: 'backend:',
    },
    {
        columns: ['website'],
        exempt: { website: OWED },
        group: 'Constructor option',
        name: 'external',
        probe: 'external:',
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
    {
        columns: ['mobile'],
        exempt: MOBILE_EXEMPT,
        group: 'Constructor option',
        name: 'timeouts',
        probe: 'timeouts:',
    },
    { columns: ['cli'], group: 'Constructor option', name: 'defaults', probe: 'defaults:' },
    { columns: ['cli'], group: 'Constructor option', name: 'env', probe: 'env:' },
    { columns: ['cli'], group: 'Constructor option', name: 'docker', probe: 'docker:' },
    { columns: ['cli'], group: 'Constructor option', name: 'serve', probe: 'serve:' },
    {
        columns: ['cli', 'website'],
        group: 'Constructor option',
        name: 'transform',
        probe: 'transform:',
    },
    { columns: ['component'], group: 'Constructor option', name: 'wrap', probe: 'wrap:' },
    { columns: ['component'], group: 'Constructor option', name: 'vite', probe: 'vite:' },
    {
        columns: ['component'],
        exempt: { component: OWED },
        group: 'Constructor option',
        name: 'clock',
        probe: 'clock:',
    },
    {
        columns: ['component'],
        exempt: { component: OWED },
        group: 'Constructor option',
        name: 'locale',
        probe: 'locale:',
    },
    {
        columns: ['component'],
        exempt: { component: OWED },
        group: 'Constructor option',
        name: 'timezone',
        probe: 'timezone:',
    },
    {
        columns: ['component'],
        exempt: { component: OWED },
        group: 'Constructor option',
        name: 'viewport',
        probe: 'viewport:',
    },

    // ── Setups ──
    {
        columns: ['api', 'jobs', 'integration', 'website', 'component'],
        exempt: { jobs: OWED },
        group: 'Setup',
        name: '.clock()',
        probe: '.clock(',
    },
    {
        columns: ['api', 'jobs', 'integration', 'website', 'mobile', 'component'],
        exempt: { mobile: NO_SIMULATOR, website: OWED },
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
    { columns: ['api', 'website'], group: 'Setup', name: '.headers()', probe: '.headers(' },
    { columns: ['cli'], group: 'Setup', name: '.fixture()', probe: '.fixture(' },
    { columns: ['cli'], group: 'Setup', name: '.env()', probe: '.env(' },
    { columns: ['component'], group: 'Setup', name: '.wrap()', probe: '.wrap(' },
    { columns: ['component'], group: 'Setup', name: '.viewport()', probe: '.viewport(' },

    // ── Terminal actions ──
    { columns: ['api'], group: 'Terminal action', name: '.get()', probe: ".get('/" },
    { columns: ['api'], group: 'Terminal action', name: '.post()', probe: ".post('" },
    { columns: ['api'], group: 'Terminal action', name: '.put()', probe: ".put('" },
    { columns: ['api'], group: 'Terminal action', name: '.delete()', probe: ".delete('" },
    { columns: ['api'], group: 'Terminal action', name: '.request()', probe: ".request('" },
    { columns: ['jobs'], group: 'Terminal action', name: '.trigger()', probe: ".trigger('" },
    { columns: ['integration'], group: 'Terminal action', name: '.call()', probe: '.call(' },
    { columns: ['cli'], group: 'Terminal action', name: '.exec()', probe: '.exec(' },
    { columns: ['cli'], group: 'Terminal action', name: '.run()', probe: ".run('" },
    { columns: ['website'], group: 'Terminal action', name: '.visit()', probe: ".visit('" },
    { columns: ['website'], group: 'Terminal action', name: '.fetch()', probe: ".fetch('" },
    {
        columns: ['mobile'],
        exempt: MOBILE_EXEMPT,
        group: 'Terminal action',
        name: '.open()',
        probe: '.open(',
    },
    { columns: ['component'], group: 'Terminal action', name: '.render()', probe: '.render(' },

    // ── The verbs a scenario drives (the visitor's own members) ──
    { columns: DRAWS, exempt: MOBILE_EXEMPT, group: 'Verb', name: 'see', probe: '.see(' },
    { columns: DRAWS, exempt: MOBILE_EXEMPT, group: 'Verb', name: 'fill', probe: '.fill(' },
    { columns: BROWSERS, group: 'Verb', name: 'click', probe: '.click(' },
    { columns: BROWSERS, group: 'Verb', name: 'gone', probe: '.gone(' },
    {
        columns: BROWSERS,
        exempt: { website: OWED },
        group: 'Verb',
        name: 'press',
        probe: '.press(',
    },
    {
        columns: BROWSERS,
        exempt: { website: OWED },
        group: 'Verb',
        name: 'hover',
        probe: '.hover(',
    },
    {
        columns: BROWSERS,
        exempt: { website: OWED },
        group: 'Verb',
        name: 'check',
        probe: '.check(',
    },
    { columns: BROWSERS, group: 'Verb', name: 'select', probe: '.select(' },
    {
        columns: ['website'],
        exempt: { website: OWED },
        group: 'Verb',
        name: 'goto',
        probe: '.goto(',
    },
    {
        columns: ['mobile'],
        exempt: MOBILE_EXEMPT,
        group: 'Verb',
        name: 'tap',
        probe: '.tap(',
    },
    { columns: ['component'], group: 'Verb', name: 'rerender', probe: '.rerender(' },
    { columns: ['component'], group: 'Verb', name: 'unmount', probe: '.unmount(' },

    // ── The element vocabulary (chapter 13 owns the words) ──
    {
        columns: DRAWS,
        exempt: MOBILE_EXEMPT,
        group: 'Descriptor',
        name: 'button',
        probe: 'button(',
    },
    { columns: DRAWS, exempt: MOBILE_EXEMPT, group: 'Descriptor', name: 'field', probe: 'field(' },
    {
        columns: DRAWS,
        exempt: MOBILE_EXEMPT,
        group: 'Descriptor',
        member: 'content',
        name: 'content',
        probe: 'content(',
    },
    {
        columns: DRAWS,
        exempt: { mobile: NO_SIMULATOR, website: OWED },
        group: 'Descriptor',
        name: 'testId',
        probe: 'testId(',
    },
    {
        columns: BROWSERS,
        exempt: { website: OWED },
        group: 'Descriptor',
        name: 'heading',
        probe: 'heading(',
    },
    { columns: BROWSERS, group: 'Descriptor', name: 'link', probe: 'link(' },
    {
        columns: BROWSERS,
        exempt: { website: OWED },
        group: 'Descriptor',
        name: 'dialog',
        probe: 'dialog(',
    },
    {
        columns: BROWSERS,
        exempt: { website: OWED },
        group: 'Descriptor',
        name: 'status',
        probe: 'status(',
    },
    {
        columns: BROWSERS,
        exempt: { website: OWED },
        group: 'Descriptor',
        name: 'table',
        probe: 'table(',
    },
    {
        columns: BROWSERS,
        exempt: { website: OWED },
        group: 'Descriptor',
        name: 'row',
        probe: 'row(',
    },
    {
        columns: BROWSERS,
        exempt: { website: OWED },
        group: 'Descriptor',
        name: 'listitem',
        probe: 'listitem(',
    },
    { columns: BROWSERS, group: 'Descriptor', name: 'option', probe: 'option(' },
    {
        columns: BROWSERS,
        exempt: { component: OWED, website: OWED },
        group: 'Descriptor',
        name: 'banner',
        probe: 'banner(',
    },
    {
        columns: BROWSERS,
        exempt: { component: OWED, website: OWED },
        group: 'Descriptor',
        name: 'complementary',
        probe: 'complementary(',
    },
    {
        columns: BROWSERS,
        exempt: { component: OWED },
        group: 'Descriptor',
        name: 'contentinfo',
        probe: 'contentinfo(',
    },
    {
        columns: BROWSERS,
        exempt: { component: OWED, website: OWED },
        group: 'Descriptor',
        name: 'form',
        probe: 'form(',
    },
    { columns: BROWSERS, group: 'Descriptor', name: 'main', probe: 'main(' },
    { columns: BROWSERS, group: 'Descriptor', name: 'navigation', probe: 'navigation(' },
    { columns: BROWSERS, group: 'Descriptor', name: 'region', probe: 'region(' },
    {
        columns: BROWSERS,
        exempt: { component: OWED, website: OWED },
        group: 'Descriptor',
        name: 'search',
        probe: 'search(',
    },
    { columns: BROWSERS, group: 'Descriptor', name: 'within', probe: 'within(' },
    { columns: BROWSERS, group: 'Descriptor', name: 'focused', probe: 'focused(' },
    { columns: BROWSERS, group: 'Descriptor', name: 'selected', probe: 'selected(' },
    { columns: BROWSERS, group: 'Descriptor', name: 'valued', probe: 'valued(' },
    { columns: BROWSERS, group: 'Descriptor', name: 'disabled', probe: 'disabled(' },
    { columns: BROWSERS, group: 'Descriptor', name: 'enabled', probe: 'enabled(' },

    // ── Result accessors ──
    { columns: ['api'], group: 'Result accessor', name: '.response', probe: 'result.response' },
    {
        columns: ['api', 'website'],
        group: 'Result accessor',
        name: '.status',
        probe: 'result.status',
    },
    {
        columns: ['api', 'jobs', 'cli', 'integration'],
        group: 'Result accessor',
        member: 'table',
        name: '.table()',
        probe: 'result.table(',
    },
    {
        columns: ['api', 'cli', 'integration'],
        exempt: { api: OWED, integration: OWED },
        group: 'Result accessor',
        member: 'file',
        name: '.file()',
        probe: '.file(',
    },
    {
        columns: ['api', 'cli', 'integration'],
        exempt: { api: OWED, integration: OWED },
        group: 'Result accessor',
        member: 'directory',
        name: '.directory()',
        probe: '.directory(',
    },
    { columns: ['cli'], group: 'Result accessor', name: '.stdout', probe: 'result.stdout' },
    { columns: ['cli'], group: 'Result accessor', name: '.stderr', probe: 'result.stderr' },
    { columns: ['cli'], group: 'Result accessor', name: '.exitCode', probe: 'result.exitCode' },
    { columns: ['cli'], group: 'Result accessor', name: '.filesystem', probe: 'result.filesystem' },
    {
        columns: ['cli'],
        group: 'Result accessor',
        member: 'container',
        name: '.container()',
        probe: 'result.container(',
    },
    {
        columns: ['cli'],
        group: 'Result accessor',
        name: '.containerIds',
        probe: 'result.containerIds',
    },
    { columns: ['integration'], group: 'Result accessor', name: '.value', probe: 'result.value' },
    { columns: ['integration'], group: 'Result accessor', name: '.error', probe: 'result.error' },
    {
        columns: ['website', 'component'],
        group: 'Result accessor',
        name: '.tree',
        probe: 'result.tree',
    },
    {
        columns: ['website', 'mobile', 'component'],
        exempt: MOBILE_EXEMPT,
        group: 'Result accessor',
        name: '.content',
        probe: 'result.content',
    },
    {
        columns: ['website', 'component'],
        group: 'Result accessor',
        name: '.console',
        probe: 'result.console',
    },
    {
        columns: ['website', 'component'],
        group: 'Result accessor',
        name: '.errors',
        probe: 'result.errors',
    },
    {
        columns: ['website', 'component'],
        exempt: { website: OWED },
        group: 'Result accessor',
        name: '.html',
        probe: 'result.html',
    },
    {
        columns: ['website'],
        exempt: { website: OWED },
        group: 'Result accessor',
        name: '.title',
        probe: 'result.title',
    },
    { columns: ['website'], group: 'Result accessor', name: '.url', probe: 'result.url' },
    { columns: ['website'], group: 'Result accessor', name: '.head', probe: 'result.head' },
    { columns: ['website'], group: 'Result accessor', name: '.jsonLd', probe: 'result.jsonLd' },
    {
        columns: ['website'],
        group: 'Result accessor',
        name: '.canonical',
        probe: 'result.canonical',
    },
    {
        columns: ['website'],
        group: 'Result accessor',
        name: '.alternates',
        probe: 'result.alternates',
    },
    {
        columns: ['website'],
        exempt: { website: OWED },
        group: 'Result accessor',
        name: '.links',
        probe: 'result.links',
    },
    {
        columns: ['website'],
        group: 'Result accessor',
        member: 'meta',
        name: '.meta()',
        probe: 'result.meta',
    },
    { columns: ['website'], group: 'Result accessor', name: '.body', probe: 'result.body' },
    {
        columns: ['cli', 'website'],
        group: 'Result accessor',
        name: '.json',
        probe: 'result.json',
    },
    { columns: ['website'], group: 'Result accessor', name: '.headers', probe: 'result.headers' },
    { columns: ['website'], group: 'Result accessor', name: '.location', probe: 'result.location' },
    {
        columns: ['mobile'],
        exempt: MOBILE_EXEMPT,
        group: 'Result accessor',
        name: '.screen',
        probe: 'result.screen',
    },

    // ── Goldens ──
    {
        columns: ['api', 'jobs', 'cli', 'integration', 'website', 'component', 'module'],
        exempt: {
            jobs: "a job's oracle is the table it wrote (`toMatchRows`): its result carries no file and no directory",
        },
        group: 'Golden',
        name: "toMatch('<name>')",
        probe: ".toMatch('",
    },
    {
        columns: ['api', 'jobs', 'cli', 'integration', 'component', 'module'],
        exempt: { component: OWED },
        group: 'Golden',
        name: 'toMatchRows()',
        probe: '.toMatchRows(',
    },
    { columns: ['api', 'module'], group: 'Golden', name: '.http exchange', probe: ".http'" },
    {
        columns: ['website', 'component'],
        group: 'Golden',
        name: '.aria.yaml tree',
        probe: ".aria.yaml'",
    },
    {
        columns: ['api', 'cli', 'integration', 'website', 'module'],
        exempt: { api: OWED },
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
