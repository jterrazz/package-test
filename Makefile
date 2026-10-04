.PHONY: install build lint fix test test-merge test-changed check test-mobile check-links mutation

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

install: node_modules/.install

build: node_modules/.install
	npm run build

lint: node_modules/.install
	npm run lint

fix: build
	npx typescript fix

# `SHARD=<index>/<count>` runs one shard; the route ratchet is judged once, by `test-merge`.
test: node_modules/.install
ifdef SHARD
	@if [ -f .artifacts/vitest/blob ]; then rm .artifacts/vitest/blob; fi
	rm -rf .artifacts/vitest/routes/shard-$(subst /,-,$(SHARD))
	npm test -- --shard=$(SHARD) --reporter=default --reporter=blob
else
	rm -rf .artifacts/vitest/blob
	npm test
endif

# The merge runs no global setup, so no teardown judges: the route ratchet is judged here.
test-merge: node_modules/.install
	npx vitest --merge-reports .artifacts/vitest/blob
	node .artifacts/dev/route-split.js

# The local loop, never a verdict.
test-changed: node_modules/.install
	npm test -- --changed

MUTATION = npx typescript mutation

# The four targets CI runs, in its order.
check: node_modules/.install
	$(MAKE) build
	npm run lint
	$(MAKE) test
	$(MUTATION)

# Needs Xcode and a simulator: `check` never calls it, and CI runs it on macOS when a change reaches the mobile specs.
test-mobile: build
	node specs/_shared/_fixtures/specimen-mobile/on-simulator.mjs

# Needs the network and a lychee on the machine: `check` never calls it.
check-links:
	@command -v lychee > /dev/null || { echo "check-links: lychee is not installed on this machine — brew install lychee"; exit 1; }
	lychee --no-progress README.md docs skills

mutation: build
	$(MUTATION)
