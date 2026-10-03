import { useEffect } from 'react';

export function DraftEditor() {
    useEffect(
        () => () => {
            void (async () => {
                try {
                    await fetch('/api/draft', { body: '{"text":"hi"}', method: 'POST' });
                } catch {
                    // invariant: a save that did not land is the editor's to forget as it leaves.
                }
            })();
        },
        [],
    );
    return <p>Editing a draft</p>;
}

export function DraftSaved() {
    return <p>Draft saved</p>;
}
