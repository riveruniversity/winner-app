<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		id: string;
		title?: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		variant?: 'primary' | 'danger' | 'warning';
		onConfirm: () => void | Promise<void>;
		onCancel?: () => void;
	}

	let {
		id,
		title = 'Confirm',
		message,
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		variant = 'primary',
		onConfirm,
		onCancel
	}: Props = $props();

	let modalEl: HTMLElement | null = $state(null);
	let bsModal: import('bootstrap').Modal | null = null;
	let loading = $state(false);

	onMount(async () => {
		if (modalEl) {
			const bootstrap = await import('bootstrap');
			bsModal = bootstrap.Modal.getOrCreateInstance(modalEl, {
				backdrop: 'static',
				keyboard: false
			});
		}
	});

	onDestroy(() => {
		bsModal?.dispose();
	});

	export function show() {
		loading = false;
		bsModal?.show();
	}

	export function hide() {
		bsModal?.hide();
	}

	async function handleConfirm() {
		loading = true;
		try {
			await onConfirm();
			hide();
		} catch (error) {
			console.error('Confirm action failed:', error);
		} finally {
			loading = false;
		}
	}

	function handleCancel() {
		onCancel?.();
		hide();
	}
</script>

<div class="modal fade" {id} tabindex="-1" aria-labelledby="{id}-label" aria-hidden="true" bind:this={modalEl}>
	<div class="modal-dialog modal-dialog-centered">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title" id="{id}-label">
					{#if variant === 'danger'}
						<i class="bi bi-exclamation-triangle text-danger me-2"></i>
					{:else if variant === 'warning'}
						<i class="bi bi-exclamation-circle text-warning me-2"></i>
					{:else}
						<i class="bi bi-question-circle text-primary me-2"></i>
					{/if}
					{title}
				</h5>
				<button
					type="button"
					class="btn-close"
					onclick={handleCancel}
					disabled={loading}
					aria-label="Close"
				></button>
			</div>
			<div class="modal-body">
				<p class="mb-0">{message}</p>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-secondary" onclick={handleCancel} disabled={loading}>
					{cancelText}
				</button>
				<button
					type="button"
					class="btn btn-{variant}"
					onclick={handleConfirm}
					disabled={loading}
				>
					{#if loading}
						<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
					{/if}
					{confirmText}
				</button>
			</div>
		</div>
	</div>
</div>
