<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		id: string;
		title: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		submitText?: string;
		cancelText?: string;
		onSubmit: () => void | Promise<void>;
		onCancel?: () => void;
		children: Snippet;
	}

	let {
		id,
		title,
		size = 'md',
		submitText = 'Save',
		cancelText = 'Cancel',
		onSubmit,
		onCancel,
		children
	}: Props = $props();

	let modalEl: HTMLElement | null = $state(null);
	let bsModal: import('bootstrap').Modal | null = null;
	let loading = $state(false);

	const sizeClass = $derived(size !== 'md' ? `modal-${size}` : '');

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

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		try {
			await onSubmit();
			hide();
		} catch (error) {
			console.error('Form submit failed:', error);
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
	<div class="modal-dialog {sizeClass} modal-dialog-centered">
		<div class="modal-content">
			<form onsubmit={handleSubmit}>
				<div class="modal-header">
					<h5 class="modal-title" id="{id}-label">{title}</h5>
					<button
						type="button"
						class="btn-close"
						onclick={handleCancel}
						disabled={loading}
						aria-label="Close"
					></button>
				</div>
				<div class="modal-body">
					{@render children()}
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" onclick={handleCancel} disabled={loading}>
						{cancelText}
					</button>
					<button type="submit" class="btn btn-primary" disabled={loading}>
						{#if loading}
							<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
						{/if}
						{submitText}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
