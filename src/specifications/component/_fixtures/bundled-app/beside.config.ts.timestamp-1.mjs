import { component } from '../../component.project.ts';

/** A config bundled beside itself, where vite's loader leaves it outside a `.vite-temp/` folder: its own folder is the config's. */
export default await component({ wrap: './providers.ts' });
