import { useState } from 'react';

/** The label wraps the control, so its text is not the control's accessible name. */
export function WrappedFields() {
    const [channel, setChannel] = useState('web');
    const [title, setTitle] = useState('');

    return (
        <form aria-label="Publication">
            <label className="field">
                <span>Channel</span>
                <select
                    onChange={(event) => {
                        setChannel(event.target.value);
                    }}
                    value={channel}
                >
                    <option value="web">Web</option>
                    <option value="newsletter">Newsletter</option>
                </select>
            </label>

            <label className="field">
                <span>Title</span>
                <input
                    onChange={(event) => {
                        setTitle(event.target.value);
                    }}
                    type="text"
                    value={title}
                />
            </label>

            <p role="status">
                {channel} · {title || 'untitled'}
            </p>
        </form>
    );
}
