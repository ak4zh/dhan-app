import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	compilerOptions: {
		// required for remote functions (await in components)
		experimental: { async: true }
	},

	kit: {
		adapter: adapter(),
		experimental: {
			// enables .remote.ts files (query/command/form) as the data layer
			remoteFunctions: true
		},
		alias: {
			$server: 'src/lib/server'
		}
	}
};

export default config;
