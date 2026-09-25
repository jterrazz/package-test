import { useState } from 'react';

export function SortField() {
    const [sort, setSort] = useState('newest');

    return (
        <form aria-label="Order">
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
        </form>
    );
}
