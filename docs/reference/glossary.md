# Glossary

The words this manual uses, one meaning each.

| Word        | Means                                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| kind, facet | A kind of test — api, cli, website … A **facet** is the code behind one kind: its constructor, its chain and its result                                                                 |
| runner      | What a constructor returns, such as `api` from `specification.api()`: the object every chain of the suite starts from                                                                   |
| handle      | What a service factory returns, such as `postgres()`: the service before it starts, then its `connectionString` once it runs                                                            |
| chain       | One test's sentence on a runner: zero or more setups (`.seed()`, `.intercept()` …), then exactly one action (`.get()`, `.exec()` …) that resolves to a result                           |
| oracle      | What a test compares the result against: the value inside `expect(…).toMatch(…)`                                                                                                        |
| golden      | An oracle kept in a file under `_expected/`, compared whole and rewritten by `TEST_UPDATE=1`                                                                                            |
| ground      | The files a test stands on, in the `_seeds/`, `_requests/`, `_fixtures/` and `_expected/` folders                                                                                       |
| seam        | A place where the framework meets an outside tool it loads on demand: a database driver, a browser, a simulator. Each is an optional peer                                               |
| ratchet     | A count of debt kept in `.jterrazz/baseline.json` that may only fall: an unreached route, a convention not yet followed. A run that raises it fails, and `TEST_UPDATE=1` records a fall |
| specimen    | A small sample app a testing tool keeps under `specs/_shared/_fixtures/` to test itself against. Only a repository that tests a testing tool has one                                    |
| door        | Where a test file may sit: beside its module (a unit), under `specs/<kind>/` (an assembled product), or in a repository suite (the third door)                                          |

The examples use made-up products: `shoply`, a shop CLI; a news app with an events feed; and hosts under `.test` and `.example`, which never resolve on the internet.
