.PHONY: install build lint fix test test-merge test-changed check test-mobile check-links mutation

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

# invariant: an install replaces the dependencies a running gate reads; `check` holds `.artifacts/gate.lock` with its own pid, and an install while that process lives is refused.
install:
	@if [ -f .artifacts/gate.lock ] && kill -0 "$$(cat .artifacts/gate.lock)" 2> /dev/null; then echo "install: the gate of pid $$(cat .artifacts/gate.lock) holds this checkout - wait for it to end, or install in a worktree of its own"; exit 1; fi
	@$(MAKE) --no-print-directory node_modules/.install

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

MUTATION = npx typescript mutation

# invariant: the four targets CI runs, in its order; the lock names make's own pid, so a run that fails midway leaves a lock no live process holds, which `install` ignores.
check: node_modules/.install
	@mkdir -p .artifacts && echo $$PPID > .artifacts/gate.lock
	$(MAKE) build
	npm run lint
	$(MAKE) test
	$(MUTATION)
	@rm -f .artifacts/gate.lock

# outside: needs Xcode and a simulator — `check` never calls it, and CI runs it on macOS when a change reaches the mobile specs.
test-mobile: build
	node specs/__fixtures__/specimen-mobile/on-simulator.mjs

# outside: needs the network and a lychee on the machine — `check` never calls it.
check-links:
	@command -v lychee > /dev/null || { echo "check-links: lychee is not installed on this machine — brew install lychee"; exit 1; }
	lychee --no-progress README.md docs skills

mutation: build
	$(MUTATION)
