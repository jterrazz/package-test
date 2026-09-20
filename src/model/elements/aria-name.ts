/**
 * The accessible name an ARIA snapshot states.
 *
 * A descriptor matches the name the BROWSER computes, and that name is not the
 * element's text: `<button><span>Experiments</span><span>9</span></button>`
 * reads as `Experiments9` through `textContent` and is named "Experiments 9",
 * a field's name comes from its label and is nowhere in its text at all, and a
 * name cut at eighty characters resolves to nothing. Reading the name off the
 * snapshot is what makes the spelling the window prints a spelling that can be
 * written back into a spec.
 *
 * The dialect is the one both surfaces already speak — playwright's, on the
 * page directly and through `server.commands` for a mounted component — so the
 * projection is stated once, here, and neither adapter computes a name itself.
 */

/**
 * The name of the FIRST node a snapshot describes: `- button "Experiments 9"`,
 * optionally followed by `:` and its children.
 *
 * A quote must follow the role across a SPACE. `- paragraph: "…"` is a node
 * with text and no name, and reading that text as a name would hand the author
 * a spelling no role descriptor matches on.
 */
const NAMED = /^-\s+[\w-]+\s+"(?<name>(?:[^"\\]|\\.)*)"/u;

/** Undo the escaping the snapshot applies to a quote or a backslash inside a name. */
function unescaped(name: string): string {
    return name.replaceAll(/\\(?<char>.)/gu, '$<char>');
}

/**
 * The accessible name the snapshot gives the node it describes, or `undefined`
 * when that node has none — an unnamed landmark, a paragraph of text.
 */
export function accessibleNameIn(snapshot: string): string | undefined {
    const [first] = snapshot.split('\n');
    const found = first === undefined ? null : NAMED.exec(first.trim());
    const name = found?.groups?.name;
    return name === undefined ? undefined : unescaped(name);
}
