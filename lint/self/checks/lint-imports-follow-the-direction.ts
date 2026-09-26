import type { Finding } from '../../checks/checker.js';
import type { SelfPassId } from './checker.js';
import { byPosition, finding, productionReferences, targetOf } from './source.js';

const LINT_DIRECTION: Record<string, readonly string[]> = {
    catalogue: ['catalogue', 'reading'],
    checks: ['checks', 'catalogue', 'ratchet', 'reading'],
    index: ['catalogue', 'checks', 'ratchet', 'reading', 'rulebook', 'rules'],
    ratchet: ['ratchet', 'catalogue', 'reading'],
    reading: ['reading'],
    rulebook: ['rulebook', 'catalogue', 'reading'],
    rules: ['rules', 'catalogue', 'reading'],
};

function lintFolderOf(path: string): string | undefined {
    const [tree, folder, next] = path.split('/');
    if (tree !== 'lint' || folder === undefined) {
        return undefined;
    }
    return next === undefined ? 'index' : folder;
}

export function checkLintImportsFollowTheDirection(root: string): Finding<SelfPassId>[] {
    return productionReferences(root)
        .filter(({ reference }) => reference.specifier.startsWith('.'))
        .flatMap(({ from, reference }) => {
            const own = lintFolderOf(from);
            const target = targetOf(from, reference.specifier);
            const into = lintFolderOf(target);
            const allowed = own === undefined ? undefined : LINT_DIRECTION[own];
            if (allowed === undefined || into === undefined || allowed.includes(into)) {
                return [];
            }
            return [
                finding(
                    'lint-imports-follow-the-direction',
                    from,
                    {
                        fix: `move what \`${own}/\` needs into a folder it may import — ${allowed.join(', ')} — or move the importer up the tree`,
                        found: `\`${from}\` imports \`${target}\`, from \`${into}/\`, which \`${own}/\` sits below`,
                    },
                    reference,
                ),
            ];
        })
        .toSorted(byPosition);
}
