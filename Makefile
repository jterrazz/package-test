.PHONY: install build lint fix test test-merge test-changed check test-mobile check-links mutation

# invariant: an install replaces the dependencies a running gate reads, so every path that installs (`install`, and any target that depends on `node_modules/.install`) asks the toolchain's `gate-lock` first, which refuses while another gate holds `.artifacts/gate.lock`; a checkout with no install yet holds no gate.
node_modules/.install: package-lock.json $(wildcard .artifacts/packages/*.tgz)
	@if [ -x node_modules/.bin/typescript ]; then npx typescript gate-lock; fi
	npm ci
	@touch node_modules/.install

install: node_modules/.install

build: node_modules/.install
	npm run build

lint: node_modules/.install
	npm run lint

fix: build
	npx typescript fix

# invariant: `SHARD=<index>/<count>` runs one shard; the route ratchet is judged once, by `test-merge`.
test: node_modules/.install
ifdef SHARD
	@if [ -f .artifacts/vitest/blob ]; then rm .artifacts/vitest/blob; fi
	rm -rf .artifacts/vitest/routes/shard-$(subst /,-,$(SHARD))
	npm test -- --shard=$(SHARD) --reporter=default --reporter=blob
else
	rm -rf .artifacts/vitest/blob
	npm test
endif

# invariant: the merge runs no global setup, so no teardown judges: the route ratchet is judged here.
test-merge: node_modules/.install
	npx vitest --merge-reports .artifacts/vitest/blob
	node .artifacts/dev/route-split.js

# invariant: the local loop, never a verdict.
test-changed: node_modules/.install
	npm test -- --changed

# value: `check` passes `--cold`, so the whole suite's run starts from no incremental report and a gate never stands on a verdict an earlier tree earned.
MUTATION = npx typescript mutation $(MUTATION_ARGS)

# invariant: the four targets CI runs, in its order, are one gate: `TYPESCRIPT_GATE` names this recipe's shell, which `check` and `mutation` hold the checkout in the name of, and whose own builds the lock never refuses; a run that fails midway leaves a lock no live process holds, which the next gate takes over.
check: node_modules/.install
	@TYPESCRIPT_GATE=$$$$:$(CURDIR) $(MAKE) --no-print-directory build lint test mutation MUTATION_ARGS=--cold

# outside: needs Xcode and a simulator; neither `check` nor any CI job calls it, so it is run by hand.
test-mobile: build
	node specs/__fixtures__/specimen-mobile/on-simulator.mjs

# outside: needs the network and a lychee on the machine; `check` never calls it.
check-links:
	@command -v lychee > /dev/null || { echo "check-links: lychee is not installed on this machine; brew install lychee"; exit 1; }
	lychee --no-progress README.md docs skills

mutation: build
	$(MUTATION)
