import { useState } from 'react';

/** Leaves the screen only after a slow answer: a wait longer than a poll's default second. */
export function SlowSave() {
    const [saved, setSaved] = useState(false);

    const save = (): void => {
        void (async () => {
            await fetch('/api/save', { method: 'POST' });
            setSaved(true);
        })();
    };

    if (saved) {
        return <p>Saved</p>;
    }

    return (
        <button onClick={save} type="button">
            Save
        </button>
    );
}
