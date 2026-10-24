# Deployment specs (`specification.deployment`)

`specification.deployment()` probes a deployment that is already running: a URL your CI just deployed, every host of a platform, a node's address or a closed port. Each test sends one complete HTTP request over the network, with no browser, and compares what came back whole, the certificate it came over beside it. A connection that never answers is a result too, so a negative probe reads like a positive one.

Use it when the subject is the deployed surface itself. For the app's own behaviour, started in the test process with real databases, use [api](api-specs.md); for a page a visitor sees, rendered in a browser, use [website](website-specs.md).

## What it specifies

A deployment spec answers one question: **given this address, what does the running deployment answer, and over which certificate?** The subject is what the artefact does once shipped (its edge, its routing, its TLS, its redirects, its headers, what it refuses), met from outside as a client meets it. The app's logic behind that surface is an api spec's ([API specs](api-specs.md)), proven where its stubs, its clock and its databases mean something; a deployment spec proves nothing of them, and starts none of them.

| Aspect          | What it means                                                                        |
| --------------- | ------------------------------------------------------------------------------------ |
| The deployment  | Already running: started by nobody in the test, reached over the network             |
| One exchange    | One request and its whole response; a redirect is the answer, never followed         |
| What it proves  | Status, headers, body, the certificate presented, and which addresses refuse to talk |
| What it doesn't | The app's logic: no stub, no clock, no seed reaches a deployment                     |

The transport is node's own `http`, `https`, `tls` and `net` ([ADR-022](https://github.com/jterrazz/package-test/blob/main/docs/decisions/022-a-running-deployment-is-the-deployment-specification.md)): nothing to install beyond the package.

## The constructor

```typescript
// specs/deployment/deployment.specification.ts
import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, deployment } = await specification.deployment({
    url: process.env.DEPLOYED_URL ?? 'https://preview.site.example',
});

afterAll(cleanup);
```

The handle destructures to `{ deployment, cleanup }` (rule `no-runner-alias`). The specification starts nothing, so `cleanup` releases nothing; it is passed to `afterAll` like every specification's, so no reader wonders which one forgot it.

### Options

| Option            | Default                        | Description                                                                                                                                                                         |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`             | none                           | The base a path is read from (`.get('/health')`), its own path kept: `https://site.example/app` and `/health` are `https://site.example/app/health`. A URL written whole needs none |
| `timeout`         | `5000`                         | The milliseconds one exchange may take, connection to last byte, before it reads `unreachable: timeout`. A positive number                                                          |
| `insecure`        | `false`                        | Accept a certificate the trust check refuses (self-signed, expired, another host's); `result.tls` still says why                                                                    |
| `ca`              | none                           | A certificate authority trusted beside the ones node trusts: its PEM text, a value like any string                                                                                  |
| `recordedHeaders` | `['content-type', 'location']` | The headers update mode records into a golden that states none yet, those the response carries ([Update mode](#update-mode))                                                        |

A base that is no `http://` or `https://` URL, and a `timeout` that is no positive number, are refused before the first exchange. A private authority is read by the specification file that names it, `ca: readFileSync(new URL('__fixtures__/ca.pem', import.meta.url), 'utf8')`: the option takes the certificate, not a path.

## The chain

### The target

Every action names one URL: written whole (`https://grafana.site.example/`), or a path (`/health`) read from the specification's `url`. One specification therefore reaches every host of a platform, and a suite that discovers its hosts at run time needs no specification per host. A path where the specification names no `url`, a target that is neither, and a URL of another scheme are refused.

### Actions (terminal)

Exactly one per chain (rule `one-terminal-action-per-chain`).

| Action                                       | Description                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `.get(target)`                               | A GET, with the chain's headers                                                                |
| ``.request(`POST https://... ...`)``         | The complete request written in the test, `.http` text, dedented: its method, headers and body |
| `.request(file('./__requests__/file.http'))` | The complete request that file describes, when several tests send it                           |

A request file is the api's format ([API specs § `.http` request files](api-specs.md#http-request-files-full-format)), and its first line may name the URL whole (`GET https://site.example/health`, HTTP's absolute form) or a path. The body is sent as written.

```typescript
test('a moved page answers its redirect, never followed', async () => {
    // Given - the address of the page before the move
    const result = await deployment.get('/blog');

    // Then - the 301 itself, and where it points
    expect(result.response).toMatch(`
        HTTP/1.1 301 Moved Permanently
        location: https://site.example/articles
    `);
});
```

### Setup: `.connect()`

`.connect(address)` opens the socket on another address than the URL's, as curl's `--connect-to`: the `Host` header and the TLS server name stay the URL's, so the certificate is checked against the host the URL names. It is how a node's IP, a tailnet address or a NodePort is probed under the name it serves:

```typescript
test("the node's NodePort serves the public host itself", async () => {
    // Given - the public URL, its socket opened on the node
    const result = await deployment.connect('100.64.0.7:30443').get('https://site.example/health');

    // Then - the same answer the edge gives
    expect(result.response).toMatch(`
        HTTP/1.1 200 OK
        content-type: application/json

        {"status": "ok"}
    `);
});
```

The address is `host:port`, `[v6]:port`, or a bare host, which keeps the URL's port. A later `.connect()` in the chain wins.

### Setup: `.headers()`

`.headers({...})` sets request headers; repeated calls merge, and a name is read case-blind, so a `Host` the test names replaces the URL's. That is the host-smuggling probe: the public address, asked for an internal host, must refuse it.

```typescript
test('the public edge refuses a request naming an internal host', async () => {
    // Given - the public address, asked for the dashboard's host
    const result = await deployment
        .headers({ Host: 'grafana.internal.example' })
        .get('https://site.example/');

    // Then - refused at the edge
    expect(result.response).toMatch('HTTP/1.1 403 Forbidden');
});
```

The TLS server name stays the URL's, as with curl's `-H Host:`. A header a request file states is replaced by the chain's of the same name.

### Setup: `deployment.with({ headers })`

The headers a whole file shares are stated once, on a view of the specification whose every chain starts with them (`const crawler = deployment.with({ headers: { 'user-agent': 'GPTBot/1.0' } })`), and a chain's own `.headers()` merges over it ([Conventions](../concepts/conventions.md#what-a-file-shares)). Every request carries `user-agent: @jterrazz/test` unless a header replaces it.

## The result

| Member                 | Type                    | Description                                                                                                                             |
| ---------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `result.response`      | response subject        | The whole response (status, headers, body), or `unreachable: <reason>`, compared whole: `toMatch(<.http text>)` or `toMatch(file(...))` |
| `result.response.body` | body                    | The JSON value, or the text of a text body; `null` when empty or binary                                                                 |
| `result.tls`           | `TlsFacts \| undefined` | The certificate an https exchange was presented and the trust check's verdict; undefined over http, or before a handshake completed     |

`result.response` is the api's response subject, so everything [API specs](api-specs.md#http-request-files-full-format) says of a golden holds: the first line is the status, the headers are a **subset** (the ones it names are judged, the rest are free), the body is read by its `content-type`, and `{{tokens}}` cover what moves. Unlike an api golden, a deployment golden often stops at the status and the headers: a golden that states no body leaves the body free.

### Unreachable is a result

An exchange that never answered is never thrown. Its response is the one line `unreachable: <reason>`, and the reason is one of:

| Reason       | When                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `refused`    | Nothing listens on the port, or a firewall rejects it                                                                                                                                      |
| `timeout`    | No whole response within `timeout`: a firewall dropping the packets, a server that accepts and never answers                                                                               |
| `dns`        | No resolver knows the name                                                                                                                                                                 |
| `reset`      | The connection was cut before the response ended                                                                                                                                           |
| `no route`   | The network has no way to the address                                                                                                                                                      |
| `tls <CODE>` | The handshake failed, or the certificate was refused: `tls CERT_HAS_EXPIRED`, `tls DEPTH_ZERO_SELF_SIGNED_CERT`, `tls ERR_TLS_CERT_ALTNAME_INVALID`, `tls UNABLE_TO_VERIFY_LEAF_SIGNATURE` |

So a negative probe is one sentence, with no `try`/`catch` and no "it should throw" that passes when anything throws:

```typescript
test('the dashboard is unreachable from the internet', async () => {
    // Given - the dashboard's host, asked from outside the tailnet
    const result = await deployment.get('https://grafana.internal.example/');

    // Then - no answer at all
    expect(result.response).toMatch('unreachable: dns');
});

test('the NodePort is closed to the internet', async () => {
    // Given - the public address, on the port the cluster must not expose
    const result = await deployment.connect('203.0.113.10:30080').get('http://site.example/');

    // Then - the firewall drops it
    expect(result.response).toMatch('unreachable: timeout');
});
```

The line is a golden like any other: a reason takes tokens (`unreachable: tls {{string}}` where the code varies by platform), a golden file may hold it, and `TEST_UPDATE=1` writes it. An answer expected where none came, or the reverse, fails naming both outcomes:

```text
Response outcome mismatch (the value in place)
  expected: HTTP/1.1 200
  received: unreachable: refused
```

### `result.tls`: the certificate

Over https, `result.tls` holds what the handshake presented, whether or not it was trusted:

| Fact                 | Description                                                                        |
| -------------------- | ---------------------------------------------------------------------------------- |
| `subject`            | The subject's common name                                                          |
| `altNames`           | The names it is valid for, without their `DNS:` or `IP Address:` prefix            |
| `issuer`             | The issuer's common name, or its organisation                                      |
| `validFrom`          | A `Date`                                                                           |
| `validTo`            | A `Date`                                                                           |
| `daysRemaining`      | Whole days from the exchange to `validTo`, negative once expired                   |
| `covers(host)`       | Whether it is valid for `host`, a wildcard covering one label as a client reads it |
| `authorized`         | Whether it chains to a trusted authority and covers the URL's host                 |
| `authorizationError` | The code the trust check refused with, `undefined` when trusted                    |
| `protocol`           | The TLS version negotiated (`TLSv1.3`)                                             |

```typescript
test('the certificate covers the host with a month to spare', async () => {
    // Given - the public host
    const result = await deployment.get('https://site.example/');

    // Then - the answer, and the certificate it came over
    expect(result.response).toMatch('HTTP/1.1 200 OK');
    expect(result.tls?.covers('site.example')).toBe(true);
    expect(result.tls?.daysRemaining).toBeGreaterThanOrEqual(30);
});
```

A refused certificate reads `unreachable: tls <CODE>` and keeps its facts, so an expired one says by how many days. With `insecure: true` the exchange goes on over it, and `authorized` and `authorizationError` still say why it would have been refused.

### Update mode

`TEST_UPDATE=1` writes a golden as it writes an api's ([Tokens](../reference/tokens.md#update-mode-tokens-are-preserved)), with two differences that keep a probe's golden about the probe. A golden that states nothing yet records the status, the `recordedHeaders` the response carries, and the body; a golden that states no body keeps stating none, so a long HTML page is not written into a check of its status. An exchange that never answered is written as its one line.

## Unique here

### A platform suite, from the routes it discovers

A conformance suite reads its hosts from the platform when it starts, then asks each one. The discovery is the specification file's, and each host is one row of a `test.each`, one exchange each:

```typescript
// specs/deployment/routes/answers.spec.ts
import { describe, expect, test } from 'vitest';

import { deployment, publicHosts } from '../deployment.specification.js';

describe('answers', () => {
    test.each(publicHosts)('%s answers over a certificate that covers it', async (host) => {
        // Given - the host, as the platform routes it
        const result = await deployment.get(`https://${host}/`);

        // Then - an answer, and a certificate naming the host with a month to spare
        expect(result.response).toMatch('HTTP/1.1 {{int}}');
        expect(result.tls?.covers(host)).toBe(true);
        expect(result.tls?.daysRemaining).toBeGreaterThanOrEqual(30);
    });
});
```

Where `publicHosts` is what the specification file read from the cluster before the run (an `IngressRoute` list, a DNS zone), so a host added to the platform is probed with no line of the suite changed. A value written in place under `test.each` is one value for every row, so it holds tokens where rows differ; a golden per host is `toMatch(file(...))` under `__expected__/`.

### The check after a deploy

An application repository points the specification at its own URL and runs the project after its deploy step, `npx vitest --run --project deployment`, with the URL in the environment. The same specs run against a preview, a staging or a production URL: the address is the only thing that moves.

### Folder layout

```text
specs/deployment/
├── deployment.specification.ts   # specification.deployment(): the base, the deadline, the trust
├── edge/
│   ├── redirects.spec.ts
│   └── __requests__/             # a complete request several tests send
└── routes/
    ├── answers.spec.ts
    └── __expected__/             # a golden several tests share
```

No `__seeds__/`: a deployment is not seeded.

## Pitfalls

- **Probing what an api spec proves.** A field of the JSON a handler builds is the app's logic, proven in process where the database and the clock are the test's. A deployment spec asks what the shipped artefact answers, and keeps its goldens to what the edge decides.
- **Expecting a redirect to be followed.** The 301 is the answer. A test about where it lands sends a second chain to the `location`.
- **A deadline longer than the test's.** `timeout` bounds one exchange; vitest's own budget (30 s) bounds the test. A probe of a firewalled port waits the whole `timeout`, so keep it short where a suite probes many closed ports.
- **An endpoint that streams forever.** An event stream never ends, so it reads `unreachable: timeout`. Probe it with a request the server ends.
- **Reading a reason as stable across platforms.** A handshake's failure is named by the TLS library node runs on, so a handshake spoken to a plain port is `unreachable: tls {{string}}` in a golden meant for every machine.
- **A proxy in the environment.** `HTTPS_PROXY` is not read: an exchange goes where its URL or its `.connect()` says.

## Related

[API specs](api-specs.md) · [Website specs](website-specs.md) · [Assertions](../reference/assertions.md) · [Tokens](../reference/tokens.md)
