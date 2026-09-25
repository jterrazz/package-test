import { useEffect, useState } from 'react';

const WIDE = '(min-width: 800px)';

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
            <p>{`${globalThis.innerWidth}×${globalThis.innerHeight}`}</p>
        </section>
    );
}
