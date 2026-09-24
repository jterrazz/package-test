.PHONY: install build lint fix test test-merge test-changed check test-mobile

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

install: node_modules/.install

# The bundle, through Turborepo's content-hash cache: an unchanged tree
# Restores `dist/` from `.artifacts/turbo/` instead of bundling again. The
# Script is the one path `docs` and `coverage` take too (docs/02).
build: node_modules/.install
	npm run build:cached

lint: node_modules/.install
	npm run lint

# Every fixer runs, whatever the one before it said, and the verdict is theirs
# Combined, at the end: the checker's (which `build` puts in `dist/`), then the
# Toolchain's, whose formatter runs last so what the checker wrote is formatted
# In the same run. Nothing judges after them — that is `lint`'s, run apart.
fix: build
	@status=0; \
	node dist/checker.js --fix || status=1; \
	npx typescript fix || status=1; \
	exit $$status

# What CI calls, so the floor is judged on every push: the suite runs WITH
# Coverage because `coverage:check` reads the report of the LAST `--coverage`
# Run — a plain `npm test` would leave it judging an older run, or nothing at
# All on a fresh clone, where `.artifacts/` does not exist yet.
#
# `SHARD=<index>/<count>` runs one shard of that suite, for a CI job that
# Splits the run: its blob report lands under `.artifacts/vitest/blob/`, its
# Route ledgers in a folder of their own it empties first, and the floor and the route ratchet
# Are judged once, on the merged run — `make test-merge`, run after every
# Shard, never on a shard's part of the run. A whole run empties both, so a
# Merge reads the shards of one split alone.
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

# The shards' blob reports read back as one run, then the floor and the route
# Ratchet judged on it — the merge runs no global setup, so no teardown judges.
test-merge: node_modules/.install
	npx vitest --merge-reports .artifacts/vitest/blob --coverage
	npm run coverage:check
	node dist/route-split.js

# The local loop: only the tests the uncommitted changes reach. Never a
# Verdict — `check` runs the whole suite.
test-changed: node_modules/.install
	npm test -- --changed

# The whole verdict, in the order a failure is cheapest to read: the build the
# lint and the specs both need, then the linters, then the suite and the floor
# it may not fall through — the same three targets CI runs, in the same order.
check: node_modules/.install
	$(MAKE) build
	npm run lint
	$(MAKE) test

# The mobile specs on a real iOS simulator — the proof the protocol double
# Tells the truth about a device. Needs Xcode and a simulator; no CI job runs
# It, and `check` never calls it (docs/03 § the mobile tree).
test-mobile: build
	node specs/shared/fixtures/specimen-mobile/on-simulator.mjs
