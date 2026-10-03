import type { LintPlugin } from '../../kit/project/rule.js';
import { facetIsAComposition } from './architecture/facet-is-a-composition.js';

/** A plugin of its own name, since oxlint keys a rule by the plugin registering it: nothing a consumer composes can name `jterrazz-self/<rule>`. Left out of the tarball. */
const selfPlugin: LintPlugin = {
    meta: { name: 'jterrazz-self' },
    rules: {
        'facet-is-a-composition': facetIsAComposition,
    },
};

export const selfPluginRules: Record<string, 'error'> = Object.fromEntries(
    Object.keys(selfPlugin.rules).map((name) => [`jterrazz-self/${name}`, 'error']),
);

export default selfPlugin;
