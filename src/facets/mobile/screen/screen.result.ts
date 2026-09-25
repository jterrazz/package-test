import { BaseResult } from '../../../expectations/result.js';
import { JsonAccessor } from '../../../expectations/text/json.js';
import { TextAccessor } from '../../../expectations/text/text.js';
import type { SpecificationConfig } from '../../../kernel/chain/config.js';
import type { DeviceScreen } from '../device/device.port.js';

/** Result from a `.open()` action — the screen as the device saw it, final state. */
export class ScreenResult extends BaseResult {
    private readonly capturedScreen: DeviceScreen;

    constructor(options: { config: SpecificationConfig; screen: DeviceScreen; testDir: string }) {
        super(options);
        this.capturedScreen = options.screen;
    }

    /**
     * The visible screen texts as one stream, in reading order — the scalpel
     * for a targeted probe: `expect(result.content.text).toContain('Bookmarked')`.
     */
    get content(): TextAccessor {
        return new TextAccessor(this.capturedScreen.texts.join('\n'), 'content', this.testDir, {
            captures: this.captures,
        });
    }

    /**
     * The projected accessibility tree as a JSON accessor — the one golden
     * per screen: `expect(result.screen).toMatch('events.screen.json')`.
     */
    get screen(): JsonAccessor {
        return new JsonAccessor(JSON.stringify(this.capturedScreen.tree), 'screen', this.testDir, {
            captures: this.captures,
        });
    }
}
