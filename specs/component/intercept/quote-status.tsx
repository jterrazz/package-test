import { useEffect, useState } from 'react';

/** A panel that drops the body of a failed reply unread, and says the status it was served. */
export function QuoteStatus() {
    const [status, setStatus] = useState<null | number>(null);

    useEffect(() => {
        let alive = true;
        const read = async (): Promise<void> => {
            const response = await fetch('/api/quote');
            await response.body?.cancel();
            if (alive) {
                setStatus(response.status);
            }
        };
        void read();
        return () => {
            alive = false;
        };
    }, []);

    return (
        <section aria-label="Quote">
            <h1>Quote</h1>
            {status === null ? null : <p>Served {status}</p>}
        </section>
    );
}
