import { useState } from 'react';

/**
 * A button whose accessible name is NOT its text. The count sits in a block
 * child, so the text content glues to `Experiments9` while the browser
 * computes "Experiments 9" — and the computed name is what a descriptor
 * matches, which is why the window has to print that one.
 */
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
