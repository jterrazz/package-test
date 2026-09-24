import type { Context } from '@oxlint/plugins';

import { collectedSegments, facetOfSegments, FACETS, projectLiterals } from '../../config-shape.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

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
 *
 * What the include collects is read from the GLOB and the config's own place in
 * its package, never from the absolute path: a checkout living under a folder
 * called `specs` collects nothing of the kind.
 */
export const e4wProjectBinding: LintRule = {
    create(context: Context): Visitor {
        if (identityOf(context).role !== 'config') {
            return {};
        }
        const config = context.physicalFilename;
        return {
            Program(program: AstNode) {
                for (const project of projectLiterals(program)) {
                    const { name } = project;
                    const [first] = project.include;
                    if (name === undefined || first === undefined) {
                        continue;
                    }
                    const collected = collectedSegments(config, first.value);
                    const facet = facetOfSegments(collected);
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
                    if (name.value === 'unit' && collected !== undefined) {
                        context.report({ messageId: 'unitOutsideSpecs', node: first.node });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['e4w-project-binding'],
        messages: lessons('e4w-project-binding', {
            nameTheFacet: {
                found: 'the project `{{name}}` collects `specs/{{facet}}/**`',
                fix: 'name it `{{facet}}`, so `--project {{facet}}` means the same in every repository',
            },
            rootTheFacet: {
                found: 'the project `{{name}}` carries a facet name and collects elsewhere',
                fix: 'root its `include` at `specs/{{name}}/`, or call the project something else',
            },
            unitOutsideSpecs: {
                found: 'the `unit` project collects under `specs/`',
                fix: 'move the specs tree to the project of the facet that owns it; `unit` collects the tests beside their modules',
            },
        }),
        type: 'suggestion',
    },
};
