import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ out: 'build' }),
		alias: {
			$api: 'src/api',
			$stores: 'src/stores',
			$components: 'src/components',
			$types: 'src/types',
			$utils: 'src/utils'
		}
	}
};

export default config;
