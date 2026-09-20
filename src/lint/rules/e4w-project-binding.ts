import { dirname, resolve } from 'node:path';

import { facetOfPath, FACETS, projectLiterals, staticPrefix, underSpecs } from '../config-shape.js';
import { RULE_DOCS } from '../manifest.js';
import { roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/**
 * CONVENTIONS E4w (warning) — a project that collects a facet root is NAMED for
 * it, and a project named for a facet collects that root.
 *
 * `--project component` has to mean the same thing in every repository: it is
 * the one word a CI job, a Makefile target and an agent all type. A project
 * called `components` collecting `specs/component/**` costs nothing here and
 * everything the first time someone reads a failure in another repository.
 *
 * Any other name is out of reach: a repository suite calls its projects what it
 * likes, and `unit` is only asked not to reach inside a specs tree.
 */
export const e4wProjectBinding: LintRule = {
    create(context: RuleContext): Visitor {
        if (roleOf(context.physicalFilename).role !== 'config') {
            return {};
        }
        const configDirectory = dirname(context.physicalFilename);
        return {
            Program(program: AstNode) {
                for (const project of projectLiterals(program)) {
                    const { name } = project;
                    const [first] = project.include;
                    if (name === undefined || first === undefined) {
                        continue;
                    }
                    const collected = resolve(configDirectory, staticPrefix(first.value));
                    const facet = facetOfPath(collected);
                    if (facet !== undefined && name.value !== facet) {
                        context.report({
                            data: { facet, name: name.value },
                            messageId: 'nameTheFacet',
                            node: name.node,
                        });
                        continue;
                    }
                    if (FACETS.has(name.value) && facet !== name.value) {
                        context.report({
                            data: { name: name.value },
                            messageId: 'rootTheFacet',
                            node: first.node,
                        });
                        continue;
                    }
                    if (name.value === 'unit' && underSpecs(collected)) {
                        context.report({ messageId: 'unitOutsideSpecs', node: first.node });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['e4w-project-binding'],
        messages: {
            nameTheFacet:
                '`{{name}}` collects `specs/{{facet}}/**` — name it `{{facet}}` so `--project` means the same in every repository ({ include, exclude } stay yours).',
            rootTheFacet:
                '`{{name}}` is a facet name — root its `{ include, exclude }` at `specs/{{name}}/`, or call the project something else.',
            unitOutsideSpecs:
                '`unit` collects the tests that sit beside their modules — a specs tree belongs to the facet that owns it.',
        },
        type: 'suggestion',
    },
};
