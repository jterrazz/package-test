import { useEffect } from 'react';

/** An editor that saves its draft as it leaves the page — a request made on unmount. */
export function DraftEditor() {
    useEffect(
        () => () => {
            void (async () => {
                try {
                    await fetch('/api/draft', { body: '{"text":"hi"}', method: 'POST' });
                } catch {
                    // A save that did not land is the editor's to forget as it leaves.
                }
            })();
        },
        [],
    );
    return <p>Editing a draft</p>;
}

/** What replaces the editor: a surface with no network of its own. */
export function DraftSaved() {
    return <p>Draft saved</p>;
}
