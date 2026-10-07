// The project's configs, laid down from files under names oxlint never discovers, so the repository's own lint never takes them for nested ones.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

for (const [from, to] of [
    ['oxlintrc.json', '.oxlintrc.json'],
    ['web/oxlintrc.jsonc', 'web/.oxlintrc.jsonc'],
]) {
    const target = join(import.meta.dirname, to);
    if (!existsSync(target)) {
        const template = readFileSync(join(import.meta.dirname, from), 'utf8');
        writeFileSync(target, template.replaceAll('JTERRAZZ_TEST_REPO', process.env.JTERRAZZ_TEST_REPO ?? ''));
    }
}
