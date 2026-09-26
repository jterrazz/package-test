import type { LintPlugin } from '../../rules/rule.js';
import { i6FacetIsComposition } from './architecture/facet-is-a-composition.js';
import { f7NoFrameworkInternals } from './imports/no-framework-internals.js';

/** A plugin of its own name, since oxlint keys a rule by the plugin registering it: nothing a consumer composes can name `jterrazz-self/<rule>`. Left out of the tarball. */
const selfPlugin: LintPlugin = {
    meta: { name: 'jterrazz-self' },
    rules: {
        'f7-no-framework-internals': f7NoFrameworkInternals,
        'i6-facet-is-composition': i6FacetIsComposition,
    },
};

export const selfRules: Record<string, 'error' | 'warn'> = Object.fromEntries(
    Object.keys(selfPlugin.rules).map((rule) => [
        `jterrazz-self/${rule}`,
        /^\w+w-/u.test(rule) ? 'warn' : 'error',
    ]),
);

export { FRAMEWORK_LAYERS } from '../checks/layers.js';

export default selfPlugin;
