import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import type { Visitor } from '../../../kit/project/ast.js';
import { segments } from '../../../kit/project/specs-anchor.js';
import { SELF_CHAPTER, selfRows } from '../../catalogue/manifest.js';
import { compositionFileFindings } from './specification-is-a-composition.file.js';
import { handleFileFindings } from './specification-is-a-composition.handle.js';

type SpecificationFile = 'composition' | 'constructor' | undefined;

function specificationFileOf(filename: string): SpecificationFile {
    const [file = '', specification = '', specifications = '', src = ''] =
        segments(filename).toReversed();
    if (src !== 'src' || specifications !== 'specifications') {
        return undefined;
    }
    if (file === `${specification}.composition.ts`) {
        return 'composition';
    }
    return file === `${specification}.handle.ts` ? 'constructor' : undefined;
}

const row = rowNamed(selfRows, 'specification-is-a-composition');

/** A `self` rule: these folders are this package's architecture. */
export const specificationIsAComposition = defineRule(
    {
        docs: row,
        messages: {
            adapter: {
                found: 'the adapter `{{port}}` is a {{what}} written in the specification, not one its adapter module builds',
                fix: 'name the adapter, or call the constructor its adapter module exports (under the notion it adapts, `src/stubs/`, `src/services/`, `src/disk/`, `src/clock/`, `src/mocks/`, or in a concept folder of the specification) on the config alone',
            },
            buildsResult: {
                found: 'the constructor builds a `{{built}}`, a result',
                fix: 'let the action the chain ends on construct what it hands back; the constructor opens the specification (`<name>Definition.open(config)`)',
            },
            defined: {
                found: '`defineSpecification` is handed a {{what}}, and it takes nothing but the chain type',
                fix: 'write `defineSpecification<Chain>()({ ... })`: the specification object carries everything the specification composes',
            },
            adapters: {
                found: "the specification's `adapters` is not an arrow handing back the object of its adapters",
                fix: 'write `adapters: (config) => ({ <port>: <adapter>, ... })`, its parameter a bare name; what builds an adapter is its adapter module',
            },
            inline: {
                found: "the specification's `{{key}}` is a {{what}} written in the specification, not a reference imported from its module",
                fix: 'import what the specification hands the chain from the module that owns it, and name it here',
            },
            listed: {
                found: '`{{key}}` lists a {{what}}, not a definition imported from a `*.capability.ts` or `*.action.ts` module',
                fix: 'define the setup or the action in its own module, import it, and list it by its name',
            },
            member: {
                found: 'the composition holds `{{key}}`, which is none of its `capabilities`, `actions` or `options`',
                fix: 'a composition lists definitions and the matrix rows of its options; move the rest to the module that owns it',
            },
            option: {
                found: 'the option `{{name}}` is not a matrix row written as string literals',
                fix: 'write the option as `{ group: ..., name: ..., probe: ... }`, each a string literal',
            },
            runsStep: {
                found: 'the constructor calls `{{owner}}.{{step}}()`, a step of a definition',
                fix: 'open the specification (`<name>Definition.open(config)`) and let the chain run the definitions it composes',
            },
            stray: {
                found: 'a {{stray}} in a composition file, which holds its composition alone',
                fix: 'move the logic to the capability, the action or the adapter that owns it; a composition file lists definitions and wires adapters',
            },
        },
        read: readAt(row, SELF_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            let file: SpecificationFile;
            return {
                before: () => {
                    file = specificationFileOf(context.filename);
                    return file !== undefined;
                },
                Program: (node) => {
                    const findings =
                        file === 'composition'
                            ? compositionFileFindings(node)
                            : handleFileFindings(node);
                    for (const finding of findings) {
                        context.report(finding);
                    }
                },
            };
        },
    },
);
