# 13 — Elements: one vocabulary, three surfaces

Three facets drive something a person can see — a served page ([08](08-website.md)), a mounted unit ([07](07-component.md)), a screen on a simulator ([09](09-mobile.md)). They name what they act on with **one vocabulary**, owned here and restated nowhere: the same descriptors, the same modifiers, the same ambiguity refusal, the same matching rule. A facet chapter says what its surface adds; it does not redefine a word.

The vocabulary is user-facing by construction (rule W2): there is no CSS surface, no XPath and no raw predicate. A test names what a person would name.

| The shape            | Held below                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------- |
| The words            | [Descriptors](#descriptors)                                                                 |
| The states           | [Modifiers](#modifiers)                                                                     |
| The actions          | [Verbs](#verbs)                                                                             |
| Which facet has what | [The per-facet matrix](#the-per-facet-matrix)                                               |
| Waiting              | [`see()` and `gone()` are the synchronization](#see-and-gone-are-the-synchronization)       |
| One element, exactly | [Designating exactly one element](#designating-exactly-one-element)                         |
| Narrowing            | [`within(scope, target)`](#withinscope-target)                                              |
| Matching             | [A name designates the accessible name WHOLE](#a-name-designates-the-accessible-name-whole) |
| The escape hatch     | [`testId()`](#testid--the-one-escape-hatch)                                                 |

## Descriptors

The six every surface has:

| Descriptor      | Locates by                                                                            |
| --------------- | ------------------------------------------------------------------------------------- |
| `button(name)`  | accessible name, button role                                                          |
| `link(name)`    | accessible name, link role                                                            |
| `field(label)`  | accessible name, input roles — or the label that names it                             |
| `heading(name)` | accessible name, heading role                                                         |
| `content(text)` | any element containing the text                                                       |
| `testId(id)`    | `data-testid` on the web, the accessibility identifier on a device — the escape hatch |

Five more roles a visitor reads and acts on, each optionally named because a surface carries several of them and one of them usually carries no name at all:

| Descriptor        | Locates by                                              |
| ----------------- | ------------------------------------------------------- |
| `dialog(name?)`   | a `<dialog>` or `role="dialog"`. A closed one is absent |
| `status(name?)`   | a live region announcing a result                       |
| `table(name?)`    | a table, by its caption or accessible name              |
| `row(name?)`      | a row of a table or grid, by the text of its cells      |
| `listitem(name?)` | an item of a list — the answer to an unnamed `<li>`     |

And one role that is read where it SITS rather than where it shows:

| Descriptor     | Locates by                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `option(name)` | an option of a select or a listbox, by its label — named inside the field holding it, with `within()` |

`see(option('LinkedIn'))` asks whether the option is OFFERED, not whether it is on the screen: the options of a collapsed `<select>` are in the document and in the accessibility tree, and not one of them has a box until a visitor opens it. Which one the field is on is the `selected` modifier.

The **landmarks** are the ARIA landmark set and nothing more — a closed vocabulary keeps `within()` from becoming a second selector language. Each takes an optional accessible name, for surfaces carrying several of the same region:

| Landmark               | Matches                               |
| ---------------------- | ------------------------------------- |
| `banner()`             | the page header                       |
| `navigation(name?)`    | a `<nav>` — name it when several      |
| `main()`               | the primary content                   |
| `complementary(name?)` | an `<aside>`, a sidebar               |
| `contentinfo()`        | the page footer                       |
| `region(name)`         | a `<section>` with an accessible name |
| `form(name)`           | a named form landmark                 |
| `search()`             | the search landmark                   |

## Modifiers

Four, and none is a descriptor of its own: each narrows a descriptor by a STATE the vocabulary can already name the element of, and each is accepted by both `see` and `gone`.

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

Scope an option to its field when a surface carries several selects — and NAME the descriptor when you do: three constructors inside a verb is one call too deep for `unicorn/max-nested-calls`, and the name reads better besides.

```typescript
const channel = within(field('Channel'), selected(option('LinkedIn')));
await visitor.see(channel);
```

## Verbs

A scenario is the When: pure interaction, no `expect()` inside it (rule W1). Every verb auto-waits; there are no sleeps anywhere in the framework.

| Verb                      | Does                                                                | Where          |
| ------------------------- | ------------------------------------------------------------------- | -------------- |
| `click(element)`          | Click the element                                                   | web, component |
| `tap(element)`            | Tap the element — the device's word for the same act                | mobile         |
| `fill(element, value)`    | Fill a form field                                                   | everywhere     |
| `press(key)`              | Press a key (e.g. `'Enter'`)                                        | web, component |
| `select(element, option)` | Select an option in a select field                                  | web, component |
| `check(element)`          | Check a checkbox or radio                                           | web, component |
| `hover(element)`          | Hover the element                                                   | web, component |
| `goto(path)`              | Navigate to another path of the site under test                     | web            |
| `rerender(ui)`            | What a PARENT does: new props, same mount                           | component      |
| `unmount()`               | What a parent does when it takes the thing off the screen           | component      |
| `see(element)`            | **The synchronization primitive** — retries until visible           | everywhere     |
| `gone(element)`           | The absence primitive — retries until hidden or out of the document | web, component |

`goto()` does not exist on a component, because a component has no address. `rerender`/`unmount` exist nowhere else, because only a component has a parent inside the test. `gone()` waits for the mobile facet's adapter to answer for absence, which an XCUITest tree does not do honestly yet.

## The per-facet matrix

What each surface can name. A blank cell is not a hole to be filled by a CSS selector — it is a boundary the adapter refuses at runtime, with a message naming it.

| Word                                               | website | component | mobile |
| -------------------------------------------------- | ------- | --------- | ------ |
| `button` `field` `content` `testId`                | yes     | yes       | yes    |
| `link` `heading`                                   | yes     | yes       | —      |
| `dialog` `status` `table` `row` `listitem`         | yes     | yes       | —      |
| `option`                                           | yes     | yes       | —      |
| landmarks (`main` `navigation` `region` …)         | yes     | yes       | —      |
| `within(scope, target)`                            | yes     | yes       | yes    |
| `{ exact: false }`                                 | yes     | yes       | yes    |
| `focused` `disabled` `enabled` `selected` `valued` | yes     | yes       | —      |
| `see`                                              | yes     | yes       | yes    |
| `gone`                                             | yes     | yes       | —      |

The ARIA landmarks are web-only: passing one to a mobile verb refuses at runtime with a message naming the boundary — an iOS screen has no ARIA regions, and inventing an equivalent would be a second vocabulary wearing the first one's words.

## `see()` and `gone()` are the synchronization

`see()` is how a scenario waits. It resolves through render work — a deep link into a Metro cold bundle, a network round-trip, an animation, a suspended boundary — and it absorbs them all without a single sleep. `gone()` is the same primitive pointed the other way: it retries until the element is hidden or out of the document, which is how a dismissal is asserted without guessing at an animation's length.

Both take a modifier, so `see(focused(button('Open')))` waits for the keyboard to land and `gone(disabled(button('Save')))` waits for a control to become usable again.

`see()` ACTS ON NOTHING, and on the mobile facet that changes what W3 asks of it: any visible match satisfies it, because an XCUITest tree legitimately exposes the same label twice (a container and its child both carry it), and a synchronization primitive refusing on that would punish honest screens. On the web and in a component, `see()` holds the same cardinality as every other verb.

## Designating exactly one element

**A descriptor must match exactly one element (rule W3).** When several match, the framework refuses the action instead of taking the first one:

```
Ambiguous element: link("Articles") matched 3 elements on http://site.test/ambiguous.

A spec must designate exactly one element. Acting on the first match would let
this test keep passing while the visitor interacts with something else.

Matched:
  1. <a href="/articles">Articles</a>  in <nav>
  2. <a href="/articles">Articles</a>  in <footer>

Disambiguate with one of:
  • scope it       within(navigation(), link("Articles"))   [leaves 1 of 2]   [also here: contentinfo()]
  • other element  a heading(), button() or field() may name one thing where this does not

Docs: docs/13-elements.md#designating-exactly-one-element (CONVENTIONS W3)
```

Every suggestion carries what it LEAVES, so a rewrite that would keep the spec ambiguous never reads as a fix: a landmark holding every candidate is not offered at all. The evidence also names the ACCESSIBLE name a candidate matched on when that is not its text — a role descriptor matches the name, so `button('Delete post')` finds an `aria-label="Delete Post a"` too, and printing only the text would send you after something that never matched.

On a device the same refusal reads in the device's terms — there are no landmarks to offer, so the evidence offers the accessibility identifiers it found:

```
Ambiguous element: button("Bookmark") matched 3 elements on the screen.

Matched:
  1. Button "Bookmark"  [testId: event-1-bookmark]
  2. Button "Bookmark"  [testId: event-2-bookmark]
  3. Button "Bookmark all"

Disambiguate with one of:
  • scope it       within(testId('…'), button("Bookmark")) — a screen has no landmarks; any descriptor works as the scope
  • test id        testId("event-1-bookmark")   [also here: event-2-bookmark]
  • other element  a button() or field() may name one thing where this does not
```

Taking "the first match" is the failure this rule exists to prevent: the spec stays green while the visitor acts on a different element, and nothing ever reports it. Ambiguity is an authoring mistake, not something DOM order should arbitrate.

## `within(scope, target)`

Search inside a scope, the way a person would say _"the Articles link **in the nav**"_:

```typescript
await visitor.click(within(navigation(), link('Articles')));
```

Scopes compose outside-in, and any descriptor works as one — including `testId()` when a container has no landmark role to stand on, which is every container on a device:

```typescript
await visitor.click(within(main(), within(region('Series'), link('Part 2'))));
await visitor.tap(within(testId('event-list'), button('Bookmark')));
```

The scope is checked first, and every scope level must itself resolve to exactly one element: if the scope is the ambiguous level, the refusal names **it** rather than the target, so the fix lands on the right descriptor.

## A name designates the accessible name WHOLE

`link('Articles')` does not reach "Read Articles". A substring default is the shape that lets a test pass for years against the element beside the one it named — and the refusal never comes, because there is only ever one match.

```typescript
await visitor.click(link('Articles')); // exactly "Articles"
await visitor.click(link('Articles', { exact: false })); // also "Read Articles"
```

Every named descriptor accepts the option — `button`, `link`, `field`, `heading`, `content`, `option`, and the named landmarks — on every surface: the web compiles it to a whole-string match, the device to `==` and, opted out, to `CONTAINS`.

Reach for the opt-out only when the name genuinely carries a variable part (a count, a user's name); scope with `within()` when the problem is that the same name appears twice.

**The transitional window.** Exact-by-default arrived in 16.0, where substring was the rule before it. Through 16.x, a descriptor that designates NOTHING as a whole name but WOULD have designated something as a substring is RESOLVED as a substring, once, and prints one line naming itself, the whole name it matched — the spelling to write — the three ways out and this deadline. The line is printed once per descriptor per run, by whichever adapter did the looking: a page's, a mounted component's, a screen's. It is a runtime warning and not a lint rule on purpose: whether a name matched whole or in part is a fact about a RUN, and a verdict fed by a previous run's artefact is not deterministic. In 17.0 the fallback is gone and the same descriptor is simply not found.

The window reaches every LEVEL of a chain, not the target alone: `within(button('Proof of authorship'), content('Verified'))` against a button named "Proof of authorship Verified" fails on the SCOPE, and a window that only ever widened the target left that migration with no line to read at all. The chain is walked outside-in, each level asked the same question, and a level that states its own `exact` is left as the author wrote it.

It costs what a miss costs: the verb waits its full actionability budget before the retry, so a descriptor living on the window is a SLOW passing test. That is the shape of the deal — the run stays green while the names are fixed, and the warning says which ones.

## `testId()` — the one escape hatch

`testId(id)` reads `data-testid` on the web and the accessibility identifier on a device. It is the ONLY descriptor that names something a user cannot perceive, and rule W2 is an error on it: a `testId()` carries a same-line comment naming what the element lacks.

```typescript
// testId: the row has no accessible name — the cells carry the data
await visitor.click(within(testId('row-3'), button('Delete')));
```

The comment is an INVARIANT, not a rationale: it states the property of the markup that makes the escape hatch necessary, so the day the element gains a name the comment is false and the descriptor changes with it. A `testId` with no such line is a selector, and a selector is what this vocabulary exists to refuse.

## Pitfalls

- **Asserting focus with a golden.** The accessibility tree carries no focus state. `see(focused(x))` / `gone(focused(x))` are the verbs that do.
- **Expecting a name to match a prefix.** It does not since 16.0. Read the transitional warning; it names the three ways out.
- **Answering an ambiguity with `{ exact: false }`.** The option widens the match; ambiguity wants narrowing. Scope it.
- **Reaching for `testId()` first.** It is the last rung, and W2 asks for the line saying why. A heading, a button or a field usually names the thing already.
- **Putting an `expect()` inside a scenario.** W1 refuses it: a scenario is interaction, the Then is on the result.
- **Passing a landmark to a mobile verb.** It refuses at runtime, naming the boundary. Scope with `within(testId(…), …)` instead.
- **Nesting three constructors in a verb call.** `unicorn/max-nested-calls` refuses it, and a named `const` reads better.

## Related

[07 — Component specs](07-component.md) · [08 — Website specs](08-website.md) · [09 — Mobile specs](09-mobile.md) · [14 — Assertions](14-assertions.md) · [15 — Tokens](15-tokens.md) · [18 — Conventions](18-conventions.md) · [19 — Linting](19-linting.md)
