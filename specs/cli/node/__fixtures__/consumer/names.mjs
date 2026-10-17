import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const installed = join('node_modules', '@jterrazz', 'test');
const { exports } = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
const subpaths = Object.keys(exports).filter((subpath) => !subpath.endsWith('schema'));
const specifiers = subpaths.map((subpath) => join('@jterrazz/test', subpath));
const paged = subpaths.filter((subpath) => typeof exports[subpath].browser === 'string');
const pages = paged.map((subpath) => join(installed, exports[subpath].browser));

writeFileSync(
    'names.ts',
    `${specifiers.map((specifier, index) => `import * as entry${index} from '${specifier}';`).join('\n')}\n${pages.map((page, index) => `import * as page${index} from './${page}';`).join('\n')}\nexport { ${[...specifiers.map((_, index) => `entry${index}`), ...pages.map((_, index) => `page${index}`)].join(', ')} };\n`,
);
const program = ts.createProgram(['names.ts'], {
    allowJs: true,
    maxNodeModuleJsDepth: 1,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ESNext,
});
const checker = program.getTypeChecker();
const source = program.getSourceFile('names.ts');

function namesOf(declaration) {
    const symbol = checker.getSymbolAtLocation(declaration.moduleSpecifier);
    return symbol === undefined
        ? ['(unresolved)']
        : checker.getExportsOfModule(symbol).map((exported) => exported.name).toSorted();
}

const declarations = source.statements.filter(ts.isImportDeclaration);
const blocks = declarations.map((declaration, index) => {
    const title =
        index < specifiers.length
            ? specifiers[index]
            : `${join('@jterrazz/test', paged[index - specifiers.length])} (browser)`;
    return [`${title}:`, ...namesOf(declaration).map((name) => `    ${name}`)].join('\n');
});
const lacks = [];
for (const [index, subpath] of paged.entries()) {
    const specifier = join('@jterrazz/test', subpath);
    const pageNames = new Set(namesOf(declarations[specifiers.length + index]));
    const nodeValues = Object.keys(await import(specifier));
    const lacking = nodeValues.filter((name) => !pageNames.has(name));
    lacks.push(`the page build of ${specifier} lacks of the node build's values: ${lacking.length === 0 ? 'none' : lacking.join(', ')}`);
}
process.stdout.write(`${blocks.join('\n\n')}\n\n${lacks.join('\n')}\n`);
