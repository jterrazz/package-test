# ADR-022: A deployed api is an api spec with a `url`

**Status:** Accepted
**Date:** 2026-10-24

The owner decided it on 2026-10-24, folding the 18.2.0 `deployment()`
constructor into `api({ url })`, and approved this record.

## Context

Every specification met its subject where the test started it, or in a
browser. `api` ran the app in this process and said so: what the shipped
artefact does (its image, its wiring, its networking) "is a deployment
probe, and this specification does not claim it". Two consumers needed that
probe. An infrastructure repository (a k3s cluster behind Traefik, a
Cloudflare tunnel and a tailnet) wants a conformance suite: every route it
discovers asked what it answers, and the negative half too, a private host
unreachable from the internet, a NodePort closed, a public host asked for an
internal `Host` refused with a 403.

Every application repository wants the check its CI runs after a deploy: its URL's status, redirects, security
headers and health body. Both wrote it by hand, with `curl` or a `fetch`
wrapped in `try`/`catch`: nothing compared whole, and a negative probe that
passes when anything throws.

18.2.0 answered with an eighth constructor, `specification.deployment()`.
The owner reversed it before any consumer adopted it. A specification is
chosen by its SUBJECT: an HTTP API, a website, a binary. Whether that
subject runs in this process or is already deployed is its TARGET, and the
package already spells a target as an option: `specification.website()`
takes `server` or `url`, exclusive by type. A deployed HTTP API is an HTTP
API; a constructor named for where it runs splits one subject in two and
asks every reader which kind a health check is.

## Decision

`specification.api()` takes exactly one of `server` and `url`, with the
contract `website` has: both, neither, or an empty `url` is refused before
anything starts, and what one target cannot carry beside the other is
refused by the type and at run time (`services` or `root` beside a `url`;
`timeout`, `insecure`, `ca` or `recordedHeaders` beside a `server`), as
`website` refuses `backend` beside a `url`.

- **A deployed chain offers what a request can do.** `.get(url)`,
  `.request(<.http> | file())`, `.headers()`, `.with({ headers })`, and
  `.connect(address)`. `.seed()`, `.intercept()`, `.clock()` (the deployed
  app's database, network and clock are its own) and `.post()`, `.put()`,
  `.delete()` (a request other than a GET is written whole) are absent from
  its type and refused at run time, in four parts naming the target; its
  result has no `table()`, `file()` or `directory()`.
- **The result is the api's response.** `result.response` is the same
  `ResponseAccessor`, so the golden, the header subset, the tokens,
  `{ frozen }` and `TEST_UPDATE=1` are unchanged. A redirect is the answer,
  never followed. A URL is written whole or as a path from `url`, so one
  specification reaches every host of a platform.
- **`.connect(address)` opens the socket elsewhere,** as curl's
  `--connect-to`: the `Host` header and the TLS server name stay the URL's.
- **Unreachable is a result.** A request that never answered is the one line
  `unreachable: <reason>` (`refused`, `timeout`, `dns`, `reset`,
  `no route`, `tls <CODE>`), which the response grammar reads as it reads a
  status line, for every specification.
- **The certificate is a fact.** `result.tls` carries the subject, the
  names, the issuer, the dates, `daysRemaining`, `covers(host)` and the trust
  check's verdict, read even when the check refused it.
- **A fresh golden records what a probe is about** (`recordedHeaders`), and
  a golden that states no body keeps stating none.
- **The transport is node's own** `http`, `tls` and `net`: a builtin is no
  library ([ADR-009](009-node-builtins-are-not-libraries.md)), so no owner
  and no peer is added.

`specification.deployment()`, its project helper and its `specs/deployment/`
folder are removed in 18.3.0, a minor by the owner's choice: 18.2.0 has no
consumer, and is deprecated on npm pointing at `api({ url })`.

## Consequences

- The constructors stay seven; the api guide carries a "Deployed target
  (`url`)" section, and the fork's api question covers both targets.
- msw's server, which takes over every socket the process dials, now listens
  only while a chain's stubs are armed: a deployed request in a worker that
  ran an intercepting spec reaches the network untouched, its certificate
  readable.
- The response grammar gains the `unreachable:` line and the request grammar
  HTTP's absolute form, for every specification; the request-file parser
  lives in `expectations/http/`.
- `website`'s `url` mode keeps its browser-first surface: `.connect()` and
  `result.tls` are the api's, and a website gains them when a consumer
  needs them.
- Proxies are not read, a body is never decompressed, and an endpoint that
  streams forever reads `unreachable: timeout`.
