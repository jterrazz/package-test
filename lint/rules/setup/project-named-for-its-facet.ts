import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import type { AstNode, Visitor } from '../../reading/ast.js';
import { collectedSegments, facetOfSegments, projectLiterals } from '../../reading/config-shape.js';
import { FACETS } from '../../reading/facets.js';
import { identityOf } from '../../reading/linted-file.js';
import type { LintRule } from '../rule.js';

/** Read from the glob and the config's place in its package, never the absolute path: a checkout under a folder called `specs` collects nothing of the kind. */
export const projectNamedForItsFacet: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => identityOf(context).role === 'config',
            Program(program: AstNode) {
                const config = context.physicalFilename;
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
        docs: rowOf('project-named-for-its-facet'),
        messages: lessons('project-named-for-its-facet', {
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
