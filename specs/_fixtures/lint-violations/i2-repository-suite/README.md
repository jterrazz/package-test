# i2-repository-suite

A REPOSITORY suite: a `*.test.ts` under a `specs/` tree that covers the whole
repository (the build, the published package, the corpus) rather than one
module. It has no neighbour module to sit beside, so I2's orphan clause — which
requires `role === 'module' && !inSpecs` — never reaches it.
