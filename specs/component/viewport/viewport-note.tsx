import { useEffect, useState } from 'react';

/** How wide the page has to be before the note calls itself wide. */
const WIDE = '(min-width: 800px)';

/** A component whose rendering is the VIEWPORT's — what a per-test `.viewport()` exists for. */
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
            <p>{wide ? 'Wide layout' : 'Narrow layout'}</p>
        </section>
    );
}
