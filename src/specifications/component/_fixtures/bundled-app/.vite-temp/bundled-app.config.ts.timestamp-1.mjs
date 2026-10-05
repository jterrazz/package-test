import { component } from '../../../component.project.ts';

/** Where vite's own loader leaves a config it bundled: named after it, under `.vite-temp/`, far from the config's folder. */
export default await component({ wrap: './providers.ts' });
