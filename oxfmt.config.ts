import { base, defineConfig } from '@jterrazz/typescript/oxfmt';
import type { OxfmtConfig } from '@jterrazz/typescript/oxfmt';

/**
 * `schema/spec.schema.json` joins `docs/reference/` in the ignore list: both are
 * GENERATED projections, written byte for byte by `npm run docs` and guarded by
 * a freshness meta-test. A formatter pass over one of them would only make the
 * generator and the formatter disagree about the same file. The four ground
 * folders join them: an input broken on purpose and a golden compared byte for
 * byte are not source to format.
 */
const config: OxfmtConfig = defineConfig({
    ...base,
    ignorePatterns: [
        ...(base.ignorePatterns ?? []),
        'schema',
        'specs/**/{fixtures,expected,seeds,requests}/**',
        'src/**/{fixtures,expected}/**',
    ],
});

export default config;
