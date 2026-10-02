# 20 — The visitor

Three facets drive something a person can see — a served page ([10](10-website.md)), a mounted unit ([09](09-component.md)), a screen on a simulator ([11](11-mobile.md)) — and each hands its scenario a **visitor**: what acts on the surface as a person would. The visitor speaks **one vocabulary**, owned here and restated nowhere: its **verbs**, the **targets** they act on, and the **matching** that turns a target into exactly one element. A facet chapter says what its surface adds; it does not redefine a word.

The vocabulary is user-facing by construction (rule `test-id-states-what-is-missing`): there is no CSS surface, no XPath and no raw predicate. A test names what a person would name.

| The shape            | Held below                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------- |
| The actions          | [Verbs](#verbs)                                                                             |
| Waiting              | [`see()` and `gone()` are the synchronization](#see-and-gone-are-the-synchronization)       |
| Which facet has what | [The per-facet matrix](#the-per-facet-matrix)                                               |
| The words            | [Targets](#targets)                                                                         |
| The states           | [Modifiers](#modifiers)                                                                     |
| Narrowing            | [`within(scope, target)`](#withinscope-target)                                              |
| The escape hatch     | [`testId()`](#testid--the-one-escape-hatch)                                                 |
| One element, exactly | [Matching](#matching)                                                                       |
| A name, whole        | [A name designates the accessible name WHOLE](#a-name-designates-the-accessible-name-whole) |

## Verbs

A scenario is the When: pure interaction, no `expect()` inside it (rule `no-expect-in-scenario`). Every verb auto-waits; there are no sleeps anywhere in the framework.

| Verb                     | Does                                                                |
| ------------------------ | ------------------------------------------------------------------- |
| `click(target)`          | Click the element                                                   |
| `tap(target)`            | Tap the element — the device's word for the same act                |
| `fill(target, value)`    | Fill a form field                                                   |
| `press(key)`             | Press a key (e.g. `'Enter'`)                                        |
| `select(target, option)` | Select an option in a select field                                  |
| `check(target)`          | Check a checkbox or radio                                           |
| `hover(target)`          | Hover the element                                                   |
| `goto(path)`             | Navigate to another path of the site under test                     |
| `rerender(ui)`           | What a PARENT does: new props, same mount                           |
| `unmount()`              | What a parent does when it takes the thing off the screen           |
| `see(target)`            | **The synchronization primitive** — retries until visible           |
| `gone(target)`           | The absence primitive — retries until hidden or out of the document |

The website's and the component's visitors carry the same eight page verbs by construction — one declaration, `VisitorVerbs` (`src/visitor/verbs.ts`), each surface adding only its own words — and the device's visitor takes its `see` and `fill` from it. `goto()` does not exist on a component, because a component has no address. `rerender`/`unmount` exist nowhere else, because only a component has a parent inside the test. `gone()` is absent on mobile until the adapter can answer for absence honestly, which an XCUITest tree does not do yet.

### `see()` and `gone()` are the synchronization

`see()` is how a scenario waits. It resolves through render work — a deep link into a Metro cold bundle, a network round-trip, an animation, a suspended boundary — and it absorbs them all without a single sleep. `gone()` is the same primitive pointed the other way: it retries until the element is hidden or out of the document, which is how a dismissal is asserted without guessing at an animation's length.

Both take a modifier, so `see(focused(button('Open')))` waits for the keyboard to land and `gone(disabled(button('Save')))` waits for a control to become usable again.

`see()` ACTS ON NOTHING, and on the mobile facet that changes what `target-matches-one-element` asks of it: any visible match satisfies it, because an XCUITest tree legitimately exposes the same label twice (a container and its child both carry it), and a synchronization primitive refusing on that would punish honest screens. On the web and in a component, `see()` holds the same cardinality as every other verb.

### The per-facet matrix

Which surface declares which verb, target and modifier is generated from the code — [03 — Testing § The capability matrix](03-testing.md#the-capability-matrix), its **Verb** and **Target** sections, a `—` for a word the facet does not declare. `within()` and `{ exact: false }` reach every surface. A blank cell is not a hole to be filled by a CSS selector — it is a boundary the adapter refuses at runtime, with a message naming it.

The ARIA landmarks are web-only: passing one to a mobile verb refuses at runtime with a message naming the boundary — an iOS screen has no ARIA regions, and inventing an equivalent would be a second vocabulary wearing the first one's words.

## Targets

The four every surface has:

| Target          | Locates by                                                                            |
| --------------- | ------------------------------------------------------------------------------------- |
| `button(name)`  | accessible name, button role                                                          |
| `field(label)`  | accessible name, input roles — or the label that names it                             |
| `content(text)` | any element whose text IS the text, whole (`{ exact: false }` to contain)             |
| `testId(id)`    | `data-testid` on the web, the accessibility identifier on a device — the escape hatch |

The two a browser adds, on the website and the component:

| Target          | Locates by                    |
| --------------- | ----------------------------- |
| `link(name)`    | accessible name, link role    |
| `heading(name)` | accessible name, heading role |

Five more roles a visitor reads and acts on, each optionally named because a surface carries several of them and one of them usually carries no name at all:

| Target            | Locates by                                              |
| ----------------- | ------------------------------------------------------- |
| `dialog(name?)`   | a `<dialog>` or `role="dialog"`. A closed one is absent |
| `status(name?)`   | a live region announcing a result                       |
| `table(name?)`    | a table, by its caption or accessible name              |
| `row(name?)`      | a row of a table or grid, by the text of its cells      |
| `listitem(name?)` | an item of a list — the answer to an unnamed `<li>`     |

And one role that is read where it SITS rather than where it shows:

| Target         | Locates by                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `option(name)` | an option of a select or a listbox, by its label — named inside the field holding it, with `within()` |

`see(option('LinkedIn'))` asks whether the option is OFFERED, not whether it is on the screen: the options of a collapsed `<select>` are in the document and in the accessibility tree, and not one of them has a box until a visitor opens it. Which one the field is on is the `selected` modifier.

The **landmarks** are the ARIA landmark set and nothing more — a closed vocabulary keeps `within()` from becoming a second selector language. Each takes an optional accessible name, for surfaces carrying several of the same region — and `region` and `form` want one in practice, since an unnamed `<section>` or `<form>` is no landmark at all:

| Landmark               | Matches                                  |
| ---------------------- | ---------------------------------------- |
| `banner(name?)`        | the page header                          |
| `navigation(name?)`    | a `<nav>` — name it when several         |
| `main(name?)`          | the primary content                      |
| `complementary(name?)` | an `<aside>`, a sidebar                  |
| `contentinfo(name?)`   | the page footer                          |
| `region(name?)`        | a `<section>` with an accessible name    |
| `form(name?)`          | a named form landmark                    |
| `search(name?)`        | a `<search>` element, or `role="search"` |

### Modifiers

Four, and none is a target of its own: each narrows a target by a STATE the vocabulary can already name the element of, and each is accepted by both `see` and `gone`.

| Modifier                   | Asks                                                                          |
| -------------------------- | ----------------------------------------------------------------------------- |
| `focused(element)`         | Where the keyboard is                                                         |
| `disabled(element)`        | Whether the control refuses input — `enabled(element)` is the other direction |
| `selected(element)`        | Which option the field is on                                                  |
| `valued(element, 'value')` | What the field holds — its live value, never its `value` attribute            |

```typescript
await visitor.press('Escape');
await visitor.gone(dialog('Settings'));
await visitor.see(focused(button('Open')));
await visitor.see(disabled(button('Publish')));
await visitor.see(selected(option('LinkedIn')));
await visitor.see(valued(field('Title'), 'Launch teaser'));
```

FOCUS is a verb's business and never a golden's: the accessibility tree carries none, so a tree snapshot of a surface that handed the keyboard back and one that did not are byte-identical. ENABLEMENT the tree does carry — a disabled control reads `button "Publish" [disabled]`, a selected option `[selected]` — so a golden pins it for a whole outline and `see(disabled(…))` names the one control a test is about. The modifier also buys a direction a behavioural substitute cannot reach: clicking a disabled control is a timeout, not an answer.

Scope an option to its field when a surface carries several selects — and NAME the target when you do: three constructors inside a verb is one call too deep for `unicorn/max-nested-calls`, and the name reads better besides.

```typescript
const channel = within(field('Channel'), selected(option('LinkedIn')));
await visitor.see(channel);
```

### `within(scope, target)`

Search inside a scope, the way a person would say _"the Articles link **in the nav**"_:

```typescript
await visitor.click(within(navigation(), link('Articles')));
```

Scopes compose outside-in, and any target works as one — including `testId()` when a container has no landmark role to stand on, which is every container on a device:

```typescript
await visitor.click(within(main(), within(region('Series'), link('Part 2'))));
await visitor.tap(within(testId('event-list'), button('Bookmark')));
```

The scope is checked first, and every scope level must itself resolve to exactly one element: if the scope is the ambiguous level, the refusal names **it** rather than the target, so the fix lands on the right target.

### `testId()` — the one escape hatch

`testId(id)` reads `data-testid` on the web and the accessibility identifier on a device. It is the ONLY target that names something a user cannot perceive, and rule `test-id-states-what-is-missing` is an error on it: a `testId()` carries a `// testId: <what is missing>` comment on its own line or the one directly above.

```typescript
// testId: the row has no accessible name — the cells carry the data
await visitor.click(within(testId('row-3'), button('Delete')));
```

The comment is an INVARIANT, not a rationale: it states the property of the markup that makes the escape hatch necessary, so the day the element gains a name the comment is false and the target changes with it. A `testId` with no such line is a selector, and a selector is what this vocabulary exists to refuse.

## Matching

A verb acts on one element, and matching is how a target becomes it: the target is resolved on the surface, every scope level first, and the result must be exactly one element whose accessible name is the name the target wrote.

### Designating exactly one element

**A target must match exactly one element (rule `target-matches-one-element`).** When several match, the framework refuses the action instead of taking the first one:

```text
found: Ambiguous element: link("Articles") matched 2 elements on http://site.test/ambiguous —
  1. <a href="/articles">Articles</a>  in <nav>
  2. <a href="/articles">Articles</a>  in <footer>
why: A verb acts on exactly ONE element: a target that matches several is refused, never settled by the first.
fix: designate one of them:
  • scope it       within(navigation(), link("Articles"))   [leaves 1 of 2]   [also here: contentinfo()]
  • other element  a heading(), button() or field() may name one thing where this does not
read: docs/24-linting.md#target-matches-one-element
```

The refusal is a lesson in the four parts every message carries ([24](24-linting.md#what-a-finding-says)), one part per line.

Every suggestion carries what it LEAVES, so a rewrite that would keep the spec ambiguous never reads as a fix: a landmark holding every candidate is not offered at all. A candidate inside a named `<section>` is offered its region by name — `within(region("Orders"), …)`, the name read from the section's `aria-label` or from what its `aria-labelledby` points at — since a page holds several regions; an unnamed `<section>` is no region, so it stays evidence (`in <section>`) and is never offered. The evidence also names the ACCESSIBLE name a candidate matched on when that is not its text — a role target matches the name, so `button('Delete post')` finds an `aria-label="Delete Post a"` too, and printing only the text would send you after something that never matched.

On a device the same refusal reads in the device's terms — there are no landmarks to offer, so the evidence offers the accessibility identifiers it found:

```text
found: Ambiguous element: button("Bookmark") matched 3 elements on the screen —
  1. Button "Bookmark"  [testId: event-1-bookmark]
  2. Button "Bookmark"  [testId: event-2-bookmark]
  3. Button "Bookmark all"
why: A verb acts on exactly ONE element: a target that matches several is refused, never settled by the first.
fix: designate one of them:
  • scope it       within(testId('…'), button("Bookmark")) — a screen has no landmarks; any target works as the scope
  • test id        testId("event-1-bookmark")   [also here: event-2-bookmark]
  • other element  a button() or field() may name one thing where this does not
read: docs/24-linting.md#target-matches-one-element
```

Taking "the first match" is the failure this rule exists to prevent: the spec stays green while the visitor acts on a different element, and nothing ever reports it. Ambiguity is an authoring mistake, not something DOM order should arbitrate.

### A name designates the accessible name WHOLE

`link('Articles')` does not reach "Read Articles". A substring default is the shape that lets a test pass for years against the element beside the one it named — and the refusal never comes, because there is only ever one match.

```typescript
await visitor.click(link('Articles')); // exactly "Articles"
await visitor.click(link('Articles', { exact: false })); // also "Read Articles"
```

Every named target accepts the option — `button`, `link`, `field`, `heading`, `content`, `option`, and the named landmarks — on every surface: the web compiles it to a whole-string match, the device to `==` and, opted out, to `CONTAINS`.

Reach for the opt-out only when the name genuinely carries a variable part (a count, a user's name); scope with `within()` when the problem is that the same name appears twice.

A name only part of an accessible name designates nothing, on every surface and at every level of a chain: `within(button('Proof of authorship'), content('Verified'))` against a button named "Proof of authorship Verified" fails on the SCOPE. The name to write is the ACCESSIBLE name, whole — what the ARIA tree (`result.tree`) prints for the element, never its text content: a button holding two inline children reads as `Experiments9` through its text and is named "Experiments 9", and a field's name is its label, which its text carries nothing of. On a device it is the element's label.

## Pitfalls

- **Asserting focus with a golden.** The tree carries no focus — [§ Modifiers](#modifiers).
- **Expecting a name to match a prefix.** It does not: write the name whole, read off the ARIA tree, or scope it with `within(…)`.
- **Answering an ambiguity with `{ exact: false }`.** The option widens the match; ambiguity wants narrowing. Scope it.
- **Reaching for `testId()` first.** It is the last rung, and `test-id-states-what-is-missing` asks for the line saying why. A heading, a button or a field usually names the thing already.
- **Putting an `expect()` inside a scenario.** `no-expect-in-scenario` refuses it: a scenario is interaction, the Then is on the result.
- **Passing a landmark to a mobile verb.** It refuses at runtime, naming the boundary. Scope with `within(testId(…), …)` instead.
- **Nesting three constructors in a verb call.** `unicorn/max-nested-calls` refuses it, and a named `const` reads better.

## Related

[09 — Component specs](09-component.md) · [10 — Website specs](10-website.md) · [11 — Mobile specs](11-mobile.md) · [21 — Assertions](21-assertions.md) · [22 — Tokens](22-tokens.md) · [23 — Conventions](23-conventions.md) · [24 — Linting](24-linting.md)
