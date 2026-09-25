import type { LintPlugin } from './rule-shape.js';
import { f7NoFrameworkInternals } from './rules/model/f7-no-framework-internals.js';

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
    },
};

/** Every self rule at its severity — what this repository's config spreads. */
export const selfRules: Record<string, 'error' | 'warn'> = Object.fromEntries(
    Object.keys(selfPlugin.rules).map((rule) => [
        `jterrazz-self/${rule}`,
        /^\w+w-/u.test(rule) ? 'warn' : 'error',
    ]),
);

export default selfPlugin;
