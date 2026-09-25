import { useEffect, useState } from 'react';

export type SurfacePort = {
    announce: (what: string) => void;
};

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
            {label === '' ? null : <p>{label}</p>}
        </section>
    );
}
