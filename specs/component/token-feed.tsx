import { useEffect, useState } from 'react';

/** A panel that renders a streamed reply piece by piece, as the pieces land. */
export function TokenFeed() {
    const [text, setText] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        let alive = true;
        const read = async (): Promise<void> => {
            const response = await fetch('/api/tokens');
            const stream = response.body;
            if (stream === null) {
                return;
            }
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            for (;;) {
                const { done: finished, value } = await reader.read();
                if (finished || !alive) {
                    break;
                }
                const piece = decoder.decode(value);
                setText((sofar) => sofar + piece);
            }
            if (alive) {
                setDone(true);
            }
        };
        void read();
        return () => {
            alive = false;
        };
    }, []);

    return (
        <section aria-label="Feed">
            <h1>Feed</h1>
            <p>{text}</p>
            {done ? <p>Complete</p> : null}
        </section>
    );
}
