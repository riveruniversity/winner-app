<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		id?: string;
		message: string;
		variant?: 'success' | 'danger' | 'warning' | 'info';
		autohide?: boolean;
		delay?: number;
		onClose?: () => void;
	}

	let {
		id = `toast-${Date.now()}`,
		message,
		variant = 'info',
		autohide = true,
		delay = 5000,
		onClose
	}: Props = $props();

	let toastEl: HTMLElement | null = $state(null);
	let bsToast: import('bootstrap').Toast | null = null;

	const iconMap = {
		success: 'bi-check-circle-fill',
		danger: 'bi-x-circle-fill',
		warning: 'bi-exclamation-triangle-fill',
		info: 'bi-info-circle-fill'
	};

	onMount(async () => {
		if (toastEl) {
			const bootstrap = await import('bootstrap');
			bsToast = bootstrap.Toast.getOrCreateInstance(toastEl, {
				autohide,
				delay
			});

			toastEl.addEventListener('hidden.bs.toast', handleHidden);
		}
	});

	onDestroy(() => {
		if (toastEl) {
			toastEl.removeEventListener('hidden.bs.toast', handleHidden);
		}
		bsToast?.dispose();
	});

	function handleHidden() {
		onClose?.();
	}

	export function show() {
		bsToast?.show();
	}

	export function hide() {
		bsToast?.hide();
	}
</script>

<div
	{id}
	class="toast align-items-center text-bg-{variant} border-0"
	role="alert"
	aria-live="assertive"
	aria-atomic="true"
	bind:this={toastEl}
>
	<div class="d-flex">
		<div class="toast-body">
			<i class="bi {iconMap[variant]} me-2"></i>
			{message}
		</div>
		<button
			type="button"
			class="btn-close btn-close-white me-2 m-auto"
			data-bs-dismiss="toast"
			aria-label="Close"
		></button>
	</div>
</div>
