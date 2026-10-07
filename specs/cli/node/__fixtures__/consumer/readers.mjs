import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(join(process.cwd(), 'package.json'));
const builds = {
    import: await import('@jterrazz/test/oxlint'),
    require: require('@jterrazz/test/oxlint'),
};
const questions = [
    ['materialAt', join(process.cwd(), 'src/orders.test.ts')],
    ['materialAt', join(process.cwd(), 'specs/api/__fixtures__/app.ts')],
    ['materialAt', join(process.cwd(), 'specs')],
    ['materialAt', join(process.cwd(), 'src/orders.ts')],
    ['testPackageOf', 'vitest/config'],
    ['testPackageOf', '@testing-library/react'],
    ['testPackageOf', '@jterrazz/test/oxlint'],
    ['testPackageOf', 'hono'],
];
for (const [build, readers] of Object.entries(builds)) {
    for (const [reader, question] of questions) {
        const asked = question.startsWith(process.cwd()) ? question.slice(process.cwd().length + 1) : question;
        const answer = reader === 'materialAt' && asked === 'specs' ? readers[reader](question, true) : readers[reader](question);
        process.stdout.write(`${build} ${reader}(${asked}): ${answer ?? 'none'}\n`);
    }
}
