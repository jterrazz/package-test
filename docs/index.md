---
layout: home

hero:
  name: "@jterrazz/test"
  text: "Declarative testing for APIs and CLIs"
  tagline: "Same fluent builder, three execution modes. Docker-backed when you need it, in-process when you don't."
  actions:
    - theme: brand
      text: Get started
      link: /guides/overview
    - theme: alt
      text: API reference
      link: /reference/

features:
  - icon: 🧪
    title: integration()
    details: Real containers via testcontainers, app in-process via Hono. Fastest feedback loop for HTTP-layer tests.
    link: /guides/integration
  - icon: 🐳
    title: e2e()
    details: Full docker-compose stack, real HTTP, language-agnostic. Test your deployed service as a black box.
    link: /guides/e2e
  - icon: ⚙️
    title: cli()
    details: Run CLI binaries in fresh temp directories. Directory snapshots, env var injection, scaffolding-ready.
    link: /guides/cli
  - icon: 📸
    title: Directory snapshots
    details: Assert entire generated trees against committed fixtures. Structured diffs. Update with one flag. Ideal for codegen tools.
  - icon: 🔒
    title: Seeds & assertions
    details: Load SQL seeds, assert on database tables, snapshot HTTP responses. One fluent API across all modes.
  - icon: 🤖
    title: Agent-friendly
    details: Every error is a single-line, parseable message. Docs expose llms.txt for AI agents. Built for Claude Code workflows.
---
