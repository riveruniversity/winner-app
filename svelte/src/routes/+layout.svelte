<script lang="ts">
	import { onMount } from 'svelte';
	import { settingsStore } from '$stores/settings.svelte';
	import '../app.css';
	import 'bootstrap/dist/css/bootstrap.min.css';
	import 'bootstrap-icons/font/bootstrap-icons.css';

	let { children } = $props();

	onMount(async () => {
		// Initialize Bootstrap JS
		await import('bootstrap');
		// Apply theme settings
		settingsStore.applyTheme();
	});
</script>

<svelte:head>
	<title>Winner Selection App</title>
	<meta name="description" content="Random winner selection application" />
</svelte:head>

{@render children()}
