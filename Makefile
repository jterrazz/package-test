.PHONY: install build lint fix test test-merge test-changed check test-mobile check-links mutation

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

install: node_modules/.install

# Through Turborepo's content-hash cache: an unchanged tree restores `dist/` instead of bundling again.
build: node_modules/.install
	npm run build:cached

lint: node_modules/.install
	npm run lint

# Every fixer runs whatever the one before said; the toolchain's formatter runs last, so what the checker wrote is formatted.
fix: build
	@status=0; \
	node dist/checker.js --fix || status=1; \
	npx typescript fix || status=1; \
	exit $$status

# With coverage, since `coverage:check` reads the last `--coverage` report. `SHARD=<index>/<count>` runs one shard; the floor and the route ratchet are judged once, by `test-merge`.
test: node_modules/.install
ifdef SHARD
	@if [ -f .artifacts/vitest/blob ]; then rm .artifacts/vitest/blob; fi
	rm -rf .artifacts/vitest/routes/shard-$(subst /,-,$(SHARD))
	npm test -- --coverage --shard=$(SHARD) --reporter=default --reporter=blob
else
	rm -rf .artifacts/vitest/blob
	npm test -- --coverage
	npm run coverage:check
endif

# The merge runs no global setup, so no teardown judges: the floor and the route ratchet are judged here.
test-merge: node_modules/.install
	npx vitest --merge-reports .artifacts/vitest/blob --coverage
	npm run coverage:check
	node dist/route-split.js

# The local loop, never a verdict.
test-changed: node_modules/.install
	npm test -- --changed

# The three targets CI runs, in its order.
check: node_modules/.install
	$(MAKE) build
	npm run lint
	$(MAKE) test

# Needs Xcode and a simulator: no CI job runs it, and `check` never calls it.
test-mobile: build
	node specs/_shared/_fixtures/specimen-mobile/on-simulator.mjs

# Needs the network and a lychee on the machine: `check` never calls it.
check-links:
	@command -v lychee > /dev/null || { echo "check-links: lychee is not installed on this machine — brew install lychee"; exit 1; }
	lychee --no-progress README.md docs skills

# Rewrites the sources in place for its whole run, so nothing else runs beside it; a measure, never a verdict: `check` never calls it.
mutation: build
	npx stryker run
