import { component } from '../../../../component.project.ts';

/** A config under a `.vite-temp/` folder that no vite bundle is named like: its own folder is the config's. */
export default await component({ wrap: './providers.ts' });
