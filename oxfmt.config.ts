import { oxfmt } from '@jterrazz/typescript';
import { defineConfig } from 'oxfmt';

/**
 * `schema/spec.schema.json` joins `docs/reference/` in the ignore list: both are
 * GENERATED projections, written byte for byte by `npm run docs` and guarded by
 * a freshness meta-test. A formatter pass over one of them would only make the
 * generator and the formatter disagree about the same file.
 */
export default defineConfig({
    ...oxfmt,
    ignorePatterns: [...oxfmt.ignorePatterns, 'schema'],
});
