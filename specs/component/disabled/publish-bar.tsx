import { useState } from 'react';

export function PublishBar() {
    const [agreed, setAgreed] = useState(false);
    return (
        <form aria-label="Publish">
            <label htmlFor="agreed">I have read the checklist</label>
            <input
                checked={agreed}
                id="agreed"
                onChange={(event) => {
                    setAgreed(event.target.checked);
                }}
                type="checkbox"
            />
            <button disabled={!agreed} type="submit">
                Publish
            </button>
        </form>
    );
}
