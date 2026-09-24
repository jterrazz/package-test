import { useEffect, useState } from 'react';

/** What a reader of the surface panel can be told. */
export type SurfacePort = {
    announce: (what: string) => void;
};

/**
 * A unit that fetches, stamps and reports — the three things a page does that
 * the 15.3 surface has to answer for INSIDE a browser: `intercept()` on the
 * worker, `clock` on the page's `Date`, and a port double as a callback prop.
 */
export function SurfacePanel({ port }: { port: SurfacePort }) {
    const [label, setLabel] = useState('');

    useEffect(() => {
        const read = async (): Promise<void> => {
            const response = await fetch('/api/surface');
            const body = await response.text();
            setLabel(body);
            port.announce(body);
        };
        void read();
    }, [port]);

    return (
        <section aria-label="Surface">
            <h1>Surface</h1>
            <p>Stamped at {new Date().toISOString()}</p>
            {label === '' ? null : <p>{label}</p>}
        </section>
    );
}
