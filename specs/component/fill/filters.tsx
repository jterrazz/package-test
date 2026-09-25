import { useState } from 'react';

/** Every input a visitor acts on, in one component — the verbs' subject. */
export function Filters({ onApply }: { onApply: (summary: string) => void }) {
    const [query, setQuery] = useState('');
    const [drafts, setDrafts] = useState(false);
    const [sort, setSort] = useState('newest');
    const [applied, setApplied] = useState<null | string>(null);

    const summary = `${query || 'everything'} · ${drafts ? 'with drafts' : 'published'} · ${sort}`;

    return (
        <form
            aria-label="Filters"
            onSubmit={(event) => {
                event.preventDefault();
                setApplied(summary);
                onApply(summary);
            }}
        >
            <label htmlFor="query">Search</label>
            <input
                id="query"
                onChange={(event) => {
                    setQuery(event.target.value);
                }}
                type="text"
                value={query}
            />

            <label htmlFor="drafts">Include drafts</label>
            <input
                checked={drafts}
                id="drafts"
                onChange={(event) => {
                    setDrafts(event.target.checked);
                }}
                type="checkbox"
            />

            <label htmlFor="sort">Sort</label>
            <select
                id="sort"
                onChange={(event) => {
                    setSort(event.target.value);
                }}
                value={sort}
            >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
            </select>

            <button title="Applies the filters above" type="submit">
                Apply
            </button>

            {applied === null ? null : <p role="status">Showing {applied}</p>}
            {applied === null ? null : (
                <button
                    onClick={() => {
                        setApplied(null);
                    }}
                    type="button"
                >
                    Clear
                </button>
            )}
        </form>
    );
}
