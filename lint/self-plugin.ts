import type { LintPlugin } from './rule-shape.js';
import { f7NoFrameworkInternals } from './rules/model/f7-no-framework-internals.js';
import { i6FacetIsComposition } from './rules/model/i6-facet-is-composition.js';

/**
 * The self plugin — the static rules whose audience is `self`: this
 * package's own suite discipline, judged over this repository alone.
 *
 * Bundled as `dist/self-oxlint.js`, which `files` leaves out of the tarball,
 * and loaded beside the published plugin by this repository's own
 * `oxlint.config.ts` and by the lint documents' configs. It is a plugin of
 * its own name, `jterrazz-self`, because oxlint keys a rule by the plugin
 * that registers it: a config names `jterrazz-self/<rule>`, and nothing a
 * consumer composes can name one.
 */
const selfPlugin: LintPlugin = {
    meta: { name: 'jterrazz-self' },
    rules: {
        'f7-no-framework-internals': f7NoFrameworkInternals,
        'i6-facet-is-composition': i6FacetIsComposition,
    },
};

/** Every self rule at its severity — what this repository's config spreads. */
export const selfRules: Record<string, 'error' | 'warn'> = Object.fromEntries(
    Object.keys(selfPlugin.rules).map((rule) => [
        `jterrazz-self/${rule}`,
        /^\w+w-/u.test(rule) ? 'warn' : 'error',
    ]),
);

/** This package's layer map, for the config that wires `i1-layer-boundaries`. */
export { FRAMEWORK_LAYERS } from './self-layers.js';

export default selfPlugin;
