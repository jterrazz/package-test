import { segments, stringValue } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** Providers a contract file may declare (C4 — see docs/10-linting.md). */
const PROVIDERS = new Set(['anthropic', 'http', 'openai']);

const CONTRACT_NAME = /^[A-Za-z0-9][\w-]*\.(?<provider>[a-z]+)\.[cm]?ts$/;

/** Is the import source the framework's public entry (`@jterrazz/test` / `src/index`)? */
function isPublicEntry(source: string): boolean {
    return (
        source === '@jterrazz/test' ||
        source.endsWith('/src/index.js') ||
        source.endsWith('/src/index.ts')
    );
}

/**
 * CONVENTIONS C4 — a contract file (`contracts/<name>.<provider>.ts`) has a
 * rigid shape: flat under `contracts/` (no subfolders), `provider ∈ { openai,
 * anthropic, http }`, a single `export default defineContract(...)`, no named
 * exports, and imports only from the public entry. The runtime channel (the
 * loader) only catches a bad default export; this rule closes the rest.
 */
export const c4ContractShape: LintRule = {
    create(context: RuleContext): Visitor {
        const parts = segments(context.physicalFilename);
        const contractsIndex = parts.lastIndexOf('contracts');
        // Only the feature contract files under a specs/ tree — `src/**/contracts/`
        // Is the framework's own contract MODULE, not user contract fixtures.
        if (
            contractsIndex === -1 ||
            contractsIndex >= parts.length - 1 ||
            !parts.includes('specs')
        ) {
            return {};
        }
        const base = parts.at(-1) ?? '';
        return {
            Program(node: AstNode) {
                // No subfolders: the file must sit directly under contracts/.
                if (contractsIndex !== parts.length - 2) {
                    context.report({ data: { base }, messageId: 'subfolder', node });
                }
                const match = CONTRACT_NAME.exec(base);
                if (match === null || !PROVIDERS.has(match.groups?.provider ?? '')) {
                    context.report({ data: { base }, messageId: 'badName', node });
                }
                let hasDefault = false;
                for (const statement of (node.body as AstNode[] | undefined) ?? []) {
                    if (statement.type === 'ImportDeclaration') {
                        const source = stringValue(statement.source as AstNode | undefined);
                        if (source !== undefined && !isPublicEntry(source)) {
                            context.report({
                                data: { source },
                                messageId: 'foreignImport',
                                node: statement,
                            });
                        }
                    } else if (
                        statement.type === 'ExportNamedDeclaration' ||
                        statement.type === 'ExportAllDeclaration'
                    ) {
                        context.report({ messageId: 'namedExport', node: statement });
                    } else if (statement.type === 'ExportDefaultDeclaration') {
                        hasDefault = true;
                        const declaration = statement.declaration as AstNode | undefined;
                        const callee =
                            declaration?.type === 'CallExpression'
                                ? (declaration.callee as AstNode | undefined)
                                : undefined;
                        if (callee?.type !== 'Identifier' || callee.name !== 'defineContract') {
                            context.report({ messageId: 'notDefineContract', node: statement });
                        }
                    }
                }
                if (!hasDefault) {
                    context.report({ messageId: 'missingDefault', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c4-contract-shape'],
        messages: {
            badName:
                'Contract file "{{base}}" must be named <name>.<provider>.ts with provider ∈ openai | anthropic | http (C4 — see docs/10-linting.md).',
            foreignImport:
                'Contract imports "{{source}}" — a contract imports only from the public entry (@jterrazz/test) (C4 — see docs/10-linting.md).',
            missingDefault:
                'Contract file has no `export default defineContract(...)` (C4 — see docs/10-linting.md).',
            namedExport:
                'Contract files have no named exports — only `export default defineContract(...)` (C4 — see docs/10-linting.md).',
            notDefineContract:
                'The default export of a contract file must be `defineContract(...)` syntactically (C4 — see docs/10-linting.md).',
            subfolder:
                'Contract file "{{base}}" is nested — contracts/ is flat, no subfolders (C4 — see docs/10-linting.md).',
        },
        type: 'problem',
    },
};
