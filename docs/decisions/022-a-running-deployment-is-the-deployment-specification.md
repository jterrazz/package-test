# ADR-022: A running deployment is the deployment specification

**Status:** Proposed
**Date:** 2026-10-24

## Context

Every specification met its subject where the test started it, or in a
browser. `api` runs the app in this process and says so: what the shipped
artefact does (its image, its wiring, its networking) "is a deployment probe,
and this specification does not claim it". `website` takes a deployed `url`,
but it drives Chromium and reads a rendered page; its `.fetch()` is a side
door on a browser specification, with no TLS, no address of its own and an
error thrown where the network refuses.

Two consumers needed the probe nobody owned. An infrastructure repository (a
k3s cluster behind Traefik, a Cloudflare tunnel and a tailnet) wants a
conformance suite: discover every route from the cluster, then assert what
each host answers, and the negative half too: a private host unreachable
from the internet, a NodePort closed, a public host asked for an internal
`Host` refused with a 403. And every application repository wants the check
its CI runs right after a deploy: the status of its own URL, its redirects
and their `Location`, its security headers, a JSON health body.

Both were writing it by hand: `curl` in a shell step, or `fetch` in a test
with a `try`/`catch` around it. The first compares nothing whole; the second
turns the negative probe, the half of a platform suite that matters most,
into "it should throw", which passes when anything throws.

Four shapes were weighed:

- **Widen `website`.** Its `url` mode and `.fetch()` are half of it. But the
  subject of a website spec is the page a visitor sees, its options start a
  server, a backend and a browser, and a connect override, a certificate and
  an unreachable outcome would be a second specification grown inside it,
  under a name that says "page".
- **Widen `api`.** Its golden is the one wanted. But its subject is the app
  in this process, which is what makes its stubs, its clock and its route
  coverage true; a remote mode is the compose mode
  [ADR-007](007-compose-mode-leaves-the-package.md) removed, for the same
  reasons.
- **A repository suite with plain `fetch`.** The shape both consumers had
  reached, and the one the evidence indicts: no golden, no tokens, no
  `TEST_UPDATE=1`, and a refused connection is an exception.
- **A dependency (`undici`, `got`) for the transport.** Node's own `http`,
  `https`, `tls` and `net` do everything a probe needs, including the two
  things `fetch` cannot: opening the socket on another address than the
  URL's, and reading the certificate presented. A builtin is no library
  ([ADR-009](009-node-builtins-are-not-libraries.md)), so no owner and no
  peer is added.

## Decision

A running deployment is a subject a team tests, so it is a specification,
the eighth constructor: `specification.deployment({ url?, timeout?,
insecure?, ca?, recordedHeaders? })`, its folder `specs/deployment/`, its
project `deployment()`. It is named for its subject, as every constructor
is: `endpoint` names one URL where a suite probes many hosts, and `probe`
names the act, not the thing.

- **One exchange per chain, compared whole.** `.get(url)` and
  `.request(<.http text> | file())` are the terminal actions; a URL is
  written whole or as a path from `url`, so one specification reaches every
  host of a platform. `result.response` is the api's `ResponseAccessor`, so
  the golden, the header subset, the `{{token}}` grammar, `{ frozen }` and
  `TEST_UPDATE=1` are the ones the package already has
  ([ADR-011](011-a-test-compares-its-whole-result-written-in-place.md)).
- **A redirect is the answer.** Nothing is followed: a 301 and its
  `location` are what the golden states.
- **`.connect(address)` opens the socket elsewhere.** As curl's
  `--connect-to`: the `Host` header and the TLS server name stay the URL's,
  so a node IP, a tailnet IP or a NodePort is probed under the name it
  serves, and the certificate is checked against that name.
- **Unreachable is a result.** A refused connection, a deadline passed, a
  name no resolver knows, a certificate refused or a handshake that fails
  is never thrown: the response is the one line `unreachable: <reason>`
  (`refused`, `timeout`, `dns`, `reset`, `no route`, `tls <CODE>`), which
  the response grammar reads as it reads a status line. A negative probe
  reads as one sentence:
  `expect(result.response).toMatch('unreachable: timeout')`.
- **The certificate is a fact of the result.** `result.tls` carries the
  subject, the names, the issuer, the dates, `daysRemaining` and `covers(host)`,
  and the trust check's verdict, read even when the check refused it. An
  untrusted certificate is accepted only by `insecure: true`; a private
  authority is trusted beside the system's by `ca`.
- **A fresh golden records what a probe is about.** `recordedHeaders`
  (default `content-type` and `location`) is what update mode writes into a
  golden that states nothing yet, and a golden that states no body keeps
  stating none: a probe claims a body by writing it.

The shared grammar grows by two forms, for every specification: a response
golden may be the line `unreachable: <reason>`, and a request line may name
its URL whole (HTTP's absolute form). The response grammar moves no other
way, and the request-file parser moves from `api` to `expectations/http/`,
since two specifications read it and neither may import the other.

## Consequences

- The constructor list is eight, and every page, rule and registry that
  counted seven counts eight: `no-unknown-constructor`, the fork, the
  projects the tree derives, the capability matrix.
- A platform conformance suite is a `test.each` over the routes its
  specification file discovers, one exchange per row, and its negative
  probes are goldens like the positive ones.
- The specification starts nothing, so its `cleanup` releases nothing; it
  is handed to `afterAll` like every other, so a reader never asks which
  specification forgot it.
- A deployment spec depends on the network it probes. The package's own
  specs probe servers they start in their process, with a certificate
  authority committed as ground, so the gate never leaves the machine.
- Proxies are not read: an exchange goes where its URL or its `.connect()`
  says, and a corporate proxy is out of scope until a consumer needs it.
- A body is read as text, never decompressed, and an endpoint that streams
  forever reads as `unreachable: timeout`: a probe asks for an answer that
  ends.
