import { useEffect, useState } from 'react';

/** How wide the page has to be before the note calls itself wide. */
const WIDE = '(min-width: 800px)';

/**
 * A component whose rendering is the VIEWPORT's — what a per-test `.viewport()`
 * exists for. It also carries the two kinds of text a rendered capture must not
 * pick up: a stylesheet's source, and a node the page does not display.
 */
export function ViewportNote() {
    const [wide, setWide] = useState(() => globalThis.matchMedia(WIDE).matches);

    useEffect(() => {
        const query = globalThis.matchMedia(WIDE);
        const onChange = (): void => {
            setWide(query.matches);
        };
        query.addEventListener('change', onChange);
        onChange();
        return () => {
            query.removeEventListener('change', onChange);
        };
    }, []);

    return (
        <section aria-label="Layout">
            <style>{'.note { color: rebeccapurple; }'}</style>
            <p className="note">{wide ? 'Wide layout' : 'Narrow layout'}</p>
            <p hidden>Drafted, never shown</p>
        </section>
    );
}
