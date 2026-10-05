import { BaseResult } from '../../../expectations/result.js';
import type { ResultConfig } from '../../../expectations/result.js';
import { JsonAccessor } from '../../../expectations/text/json.js';
import { TextAccessor } from '../../../expectations/text/text.js';
import type { DeviceScreen } from '../device/device.port.js';

/** Result from a `.open()` action — the screen as the device saw it, final state. */
export class ScreenResult extends BaseResult {
    private readonly capturedScreen: DeviceScreen;

    constructor(options: { config: ResultConfig; screen: DeviceScreen; testDir: string }) {
        super(options);
        this.capturedScreen = options.screen;
    }

    /** The visible texts as one stream, in reading order. */
    get content(): TextAccessor {
        return new TextAccessor(this.capturedScreen.texts.join('\n'), 'content', this.testDir, {
            captures: this.captures,
        });
    }

    /** The projected accessibility tree, the one golden per screen. */
    get screen(): JsonAccessor {
        // Stryker disable next-line StringLiteral: a projected tree is always JSON, and a stream is named only by the refusal of one that is not
        return new JsonAccessor(JSON.stringify(this.capturedScreen.tree), 'screen', this.testDir, {
            captures: this.captures,
        });
    }
}
