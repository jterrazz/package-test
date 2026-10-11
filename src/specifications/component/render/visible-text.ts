type Drawn = { style: { visibility: string } };

type Page<Element extends Drawn> = {
    /** Every element of the body. */
    elements: readonly Element[];
    opacityOf: (element: Element) => number;
    /** The rendered text of the body, as the page reads it now. */
    text: () => string;
};

/** The rendered text of the body without the text of an element the page draws fully transparent: `innerText` keeps a node at `opacity: 0`, which a reader does not see. */
export function visibleTextOf<Element extends Drawn>({
    elements,
    opacityOf,
    text,
}: Page<Element>): string {
    // invariant: an element at opacity 0 hides its whole subtree, and hiding it hides what it holds: its children inherit the visibility, so they need no turn of their own.
    const hidden = elements
        .filter((element) => opacityOf(element) === 0)
        .map((element) => ({ element, visibility: element.style.visibility }));
    for (const { element } of hidden) {
        element.style.visibility = 'hidden';
    }
    try {
        return text();
    } finally {
        for (const { element, visibility } of hidden) {
            element.style.visibility = visibility;
        }
    }
}
