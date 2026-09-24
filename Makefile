.PHONY: install build lint fix test check

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

install: node_modules/.install

build: node_modules/.install
	npm run build

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
test: node_modules/.install
	npm test -- --coverage
	npm run coverage:check

# The whole verdict, in the order a failure is cheapest to read: the build the
# lint and the specs both need, then the linters, then the suite and the floor
# it may not fall through — the same three targets CI runs, in the same order.
check: node_modules/.install
	npm run build
	npm run lint
	$(MAKE) test
