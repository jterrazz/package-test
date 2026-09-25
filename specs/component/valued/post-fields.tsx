import { useState } from 'react';

/** One labelled by `for`, one by a wrapping label. */
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
