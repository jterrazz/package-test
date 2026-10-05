import type { LintPlugin } from '../../kit/project/rule.js';
import { specificationIsAComposition } from './architecture/specification-is-a-composition.js';

/** A plugin of its own name, since oxlint keys a rule by the plugin registering it: nothing a consumer composes can name `jterrazz-self/<rule>`. Left out of the tarball. */
const selfPlugin: LintPlugin = {
    meta: { name: 'jterrazz-self' },
    rules: {
        'specification-is-a-composition': specificationIsAComposition,
    },
};

export const selfPluginRules: Record<string, 'error'> = Object.fromEntries(
    Object.keys(selfPlugin.rules).map((name) => [`jterrazz-self/${name}`, 'error']),
);

export default selfPlugin;
