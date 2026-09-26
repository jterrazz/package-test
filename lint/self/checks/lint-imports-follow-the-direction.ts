import type { Finding } from '../../engine/checker/finding.js';
import {
    byPosition,
    finding,
    productionReferences,
    targetOf,
} from '../../engine/project/source.js';
import type { SelfPassId } from './checker.js';

const CONSUMER = ['consumer/catalogue', 'consumer/rulebook', 'consumer/rules', 'consumer/checks'];

const SELF_ABOVE_CATALOGUE = ['self/rules', 'self/checks', 'self/corpus'];

const LINT_DIRECTION: Record<string, readonly string[]> = {
    'consumer/catalogue': ['consumer/catalogue', 'engine'],
    'consumer/checks': ['consumer/checks', 'consumer/catalogue', 'engine'],
    'consumer/rulebook': ['consumer/rulebook', 'consumer/catalogue', 'engine'],
    'consumer/rules': ['consumer/rules', 'consumer/catalogue', 'engine'],
    engine: ['engine'],
    index: [...CONSUMER, 'engine'],
    'self/catalogue': ['self/catalogue', ...CONSUMER, 'engine'],
    'self/checks': [...SELF_ABOVE_CATALOGUE, 'self/catalogue', ...CONSUMER, 'engine'],
    'self/corpus': [...SELF_ABOVE_CATALOGUE, 'self/catalogue', ...CONSUMER, 'engine'],
    'self/index': [...SELF_ABOVE_CATALOGUE, 'self/catalogue', ...CONSUMER, 'engine'],
    'self/rules': [...SELF_ABOVE_CATALOGUE, 'self/catalogue', ...CONSUMER, 'engine'],
    src: [],
};

function placeOf(path: string): string | undefined {
    const [tree, audience, folder, next] = path.split('/');
    if (tree === 'src') {
        return 'src';
    }
    if (tree !== 'lint' || audience === undefined) {
        return undefined;
    }
    if (folder === undefined) {
        return 'index';
    }
    if (audience === 'engine') {
        return 'engine';
    }
    return next === undefined ? `${audience}/index` : `${audience}/${folder}`;
}

export function checkLintImportsFollowTheDirection(root: string): Finding<SelfPassId>[] {
    return productionReferences(root)
        .filter(({ reference }) => reference.specifier.startsWith('.'))
        .flatMap(({ from, reference }) => {
            const own = placeOf(from);
            const target = targetOf(from, reference.specifier);
            const into = placeOf(target);
            const allowed = own === undefined ? undefined : LINT_DIRECTION[own];
            if (
                allowed === undefined ||
                into === undefined ||
                into === 'src' ||
                allowed.includes(into)
            ) {
                return [];
            }
            return [
                finding(
                    'lint-imports-follow-the-direction',
                    from,
                    {
                        fix:
                            allowed.length === 0
                                ? 'take what `src/` needs from `src/` itself: `lint/` reads the product, never the reverse'
                                : `move what \`${own}/\` needs into a folder it may import — ${allowed.join(', ')} — or move the importer up the tree`,
                        found: `\`${from}\` imports \`${target}\`, from \`${into}/\`, which \`${own}/\` sits below`,
                    },
                    reference,
                ),
            ];
        })
        .toSorted(byPosition);
}
