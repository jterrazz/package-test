import type { DeviceScreen } from '../../ports/device.port.js';
import type { SpecificationConfig } from '../shared/builder.js';
import { JsonAccessor } from '../shared/result/json.js';
import { BaseResult } from '../shared/result/result.js';
import { TextAccessor } from '../shared/result/text.js';

/** Result from a `.open()` action — the screen as the device saw it, final state. */
export class ScreenResult extends BaseResult {
    private readonly capturedScreen: DeviceScreen;

    constructor(options: { config: SpecificationConfig; screen: DeviceScreen; testDir: string }) {
        super(options);
        this.capturedScreen = options.screen;
    }

    /**
     * The visible screen texts as one stream, in reading order — the scalpel
     * for a targeted probe: `expect(result.content).toContain('Bookmarked')`.
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
        return new JsonAccessor(
            JSON.stringify(this.capturedScreen.tree),
            this.testDir,
            undefined,
            this.captures,
        );
    }
}
