import { registerHooks } from 'node:module';

const urls = new Set();
registerHooks({
    resolve(specifier, context, next) {
        const resolved = next(specifier, context);
        urls.add(resolved.url);
        return resolved;
    },
});
const entry = process.argv[2] ?? '@jterrazz/test';
await import(entry);
const names = new Set();
for (const url of urls) {
    const inside = url.split('/node_modules/').at(-1);
    if (inside !== url) {
        const [scope, name] = inside.split('/');
        names.add(scope.startsWith('@') ? `${scope}/${name}` : scope);
    }
}
names.delete('@jterrazz/test');
process.stdout.write(`${[...names].toSorted().join('\n')}\n`);
