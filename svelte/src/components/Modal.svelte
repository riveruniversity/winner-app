<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		id: string;
		title: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		centered?: boolean;
		staticBackdrop?: boolean;
		scrollable?: boolean;
		onShow?: () => void;
		onHide?: () => void;
		children: Snippet;
		footer?: Snippet;
	}

	let {
		id,
		title,
		size = 'md',
		centered = false,
		staticBackdrop = false,
		scrollable = false,
		onShow,
		onHide,
		children,
		footer
	}: Props = $props();

	let modalEl: HTMLElement | null = $state(null);
	let bsModal: import('bootstrap').Modal | null = null;

	const sizeClass = $derived(size !== 'md' ? `modal-${size}` : '');
	const dialogClasses = $derived(
		[
			'modal-dialog',
			sizeClass,
			centered ? 'modal-dialog-centered' : '',
			scrollable ? 'modal-dialog-scrollable' : ''
		]
			.filter(Boolean)
			.join(' ')
	);

	onMount(async () => {
		if (modalEl) {
			const bootstrap = await import('bootstrap');
			bsModal = bootstrap.Modal.getOrCreateInstance(modalEl, {
				backdrop: staticBackdrop ? 'static' : true,
				keyboard: !staticBackdrop
			});

			modalEl.addEventListener('shown.bs.modal', handleShow);
			modalEl.addEventListener('hidden.bs.modal', handleHide);
		}
	});

	onDestroy(() => {
		if (modalEl) {
			modalEl.removeEventListener('shown.bs.modal', handleShow);
			modalEl.removeEventListener('hidden.bs.modal', handleHide);
		}
		bsModal?.dispose();
	});

	function handleShow() {
		onShow?.();
	}

	function handleHide() {
		onHide?.();
	}

	export function show() {
		bsModal?.show();
	}

	export function hide() {
		bsModal?.hide();
	}

	export function toggle() {
		bsModal?.toggle();
	}
</script>

<div class="modal fade" {id} tabindex="-1" aria-labelledby="{id}-label" aria-hidden="true" bind:this={modalEl}>
	<div class={dialogClasses}>
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title" id="{id}-label">{title}</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				{@render children()}
			</div>
			{#if footer}
				<div class="modal-footer">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
</div>
