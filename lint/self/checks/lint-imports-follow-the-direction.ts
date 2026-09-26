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

const SELF_READS = [...SELF_ABOVE_CATALOGUE, 'self/catalogue', ...CONSUMER, 'engine', 'src'];

const LINT_DIRECTION: Record<string, readonly string[]> = {
    'consumer/catalogue': ['consumer/catalogue', 'engine'],
    'consumer/checks': ['consumer/checks', 'consumer/catalogue', 'engine'],
    'consumer/rulebook': ['consumer/rulebook', 'consumer/catalogue', 'engine'],
    'consumer/rules': ['consumer/rules', 'consumer/catalogue', 'engine'],
    engine: ['engine'],
    index: [...CONSUMER, 'engine'],
    'self/catalogue': ['self/catalogue', ...CONSUMER, 'engine'],
    'self/checks': SELF_READS,
    'self/corpus': SELF_READS,
    'self/index': SELF_READS,
    'self/rules': SELF_READS,
    src: ['src', 'engine', 'index'],
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

const isIndex = (place: string): boolean => place === 'index' || place.endsWith('/index');

function shownPlace(place: string, file: string): string {
    return isIndex(place) ? file : `${place}/`;
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
                own === undefined ||
                allowed === undefined ||
                into === undefined ||
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
                            into === 'src'
                                ? 'move what it needs out of `src/` into `lint/engine/`, or compose it in a `lint/` index, and let `src/` import it from there: the shipped `lint/` never reads the product'
                                : `move what \`${shownPlace(own, from)}\` needs into a folder it may import — ${allowed.join(', ')} — or move the importer up the tree`,
                        found: `\`${from}\` imports \`${target}\`, from \`${shownPlace(into, target)}\`, which \`${shownPlace(own, from)}\` sits below`,
                    },
                    reference,
                ),
            ];
        })
        .toSorted(byPosition);
}
