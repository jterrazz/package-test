import { useState } from 'react';

/**
 * Two text fields labelled the two ways a form writes it: one by a `for`
 * label, one by a label that WRAPS it — the subject of what a field holds.
 */
export function PostFields() {
    const [search, setSearch] = useState('');
    const [title, setTitle] = useState('');

    return (
        <form aria-label="Post">
            <label htmlFor="search">Search</label>
            <input
                id="search"
                onChange={(event) => {
                    setSearch(event.target.value);
                }}
                type="text"
                value={search}
            />

            <label>
                <span>Title</span>
                <input
                    onChange={(event) => {
                        setTitle(event.target.value);
                    }}
                    type="text"
                    value={title}
                />
            </label>
        </form>
    );
}
