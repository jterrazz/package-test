# test-in-its-tests-folder-repository-suite

A REPOSITORY suite: a `*.test.ts` under a `specs/` tree that covers the whole
repository (the build, the published package, the corpus) rather than one
module. It has no neighbour module to sit beside, so the orphan clause of `test-in-its-tests-folder` — which
requires `role === 'module' && !inSpecs` — never reaches it.
