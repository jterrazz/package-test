import type { LintPlugin } from '../../engine/project/rule.js';
import { facetIsAComposition } from './architecture/facet-is-a-composition.js';
import { noFrameworkInternals } from './imports/no-framework-internals.js';

/** A plugin of its own name, since oxlint keys a rule by the plugin registering it: nothing a consumer composes can name `jterrazz-self/<rule>`. Left out of the tarball. */
const selfPlugin: LintPlugin = {
    meta: { name: 'jterrazz-self' },
    rules: {
        'no-framework-internals': noFrameworkInternals,
        'facet-is-a-composition': facetIsAComposition,
    },
};

export const selfPluginRules: Record<string, 'error'> = Object.fromEntries(
    Object.keys(selfPlugin.rules).map((name) => [`jterrazz-self/${name}`, 'error']),
);

export { ARCHITECTURE } from '../checks/architecture.js';
export { FRAMEWORK_LAYERS } from '../checks/layers.js';

export default selfPlugin;
