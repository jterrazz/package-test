import { useState } from 'react';

/** The text content glues to `Experiments9` while the computed accessible name is "Experiments 9", and the name is what a target matches. */
export function CountedButton() {
    const [opened, setOpened] = useState(false);

    return (
        <div>
            <button
                onClick={() => {
                    setOpened(true);
                }}
                type="button"
            >
                <span style={{ display: 'block' }}>Experiments</span>
                <span style={{ display: 'block' }}>9</span>
            </button>
            {opened ? <p role="status">opened</p> : null}
        </div>
    );
}
