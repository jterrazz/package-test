.PHONY: build check coverage docs lint test install

node_modules/.install: package-lock.json
	npm ci
	@touch node_modules/.install

install: node_modules/.install

build: node_modules/.install
	npm run build

docs: node_modules/.install
	npm run docs

lint: node_modules/.install
	npm run lint

test: node_modules/.install
	npm test

coverage: node_modules/.install
	npm run coverage

# The whole verdict, in the order a failure is cheapest to read: the build the
# lint and the specs both need, then the linters, then the suite, then the
# floor the suite may not fall through.
check: node_modules/.install
	npm run build
	npm run lint
	npm test
	npm run coverage:check
