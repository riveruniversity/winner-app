<script lang="ts">
	import type { List } from '$types';
	import { settingsStore } from '$stores/settings.svelte';

	interface Props {
		list: List;
		onView?: (list: List) => void;
		onEdit?: (list: List) => void;
		onDelete?: (list: List) => void;
		onSync?: (list: List) => void;
	}

	let { list, onView, onEdit, onDelete, onSync }: Props = $props();

	const entryCount = $derived(list.entries?.length || list.totalEntries || 0);
	const hasMP = $derived(!!list.metadata.mpSource);
	const isCombined = $derived(list.metadata.isCombined);
	const lastSync = $derived(
		list.metadata.lastSyncAt ? new Date(list.metadata.lastSyncAt).toLocaleString() : null
	);
</script>

<div class="card list-card h-100">
	<div class="card-body d-flex flex-column">
		<div class="d-flex justify-content-between align-items-start mb-2">
			<h6 class="card-title mb-0 text-truncate" title={list.metadata.name}>
				{list.metadata.name}
			</h6>
			<div class="badges">
				{#if hasMP}
					<span class="badge bg-info ms-1" title="Ministry Platform Source">
						<i class="bi bi-cloud"></i>
					</span>
				{/if}
				{#if isCombined}
					<span class="badge bg-warning text-dark ms-1" title="Combined List">
						<i class="bi bi-layers"></i>
					</span>
				{/if}
			</div>
		</div>

		{#if !settingsStore.hideEntryCounts}
			<p class="card-text text-muted mb-2">
				<i class="bi bi-people me-1"></i>
				{entryCount.toLocaleString()} entries
			</p>
		{/if}

		{#if lastSync}
			<small class="text-muted d-block mb-2">
				<i class="bi bi-arrow-repeat me-1"></i>
				Last sync: {lastSync}
			</small>
		{/if}

		<div class="mt-auto pt-2">
			<div class="btn-group btn-group-sm w-100" role="group">
				{#if onView}
					<button
						type="button"
						class="btn btn-outline-primary"
						onclick={() => onView?.(list)}
						title="View entries"
					>
						<i class="bi bi-eye"></i>
					</button>
				{/if}
				{#if hasMP && onSync}
					<button
						type="button"
						class="btn btn-outline-info"
						onclick={() => onSync?.(list)}
						title="Sync from Ministry Platform"
					>
						<i class="bi bi-arrow-repeat"></i>
					</button>
				{/if}
				{#if onEdit}
					<button
						type="button"
						class="btn btn-outline-secondary"
						onclick={() => onEdit?.(list)}
						title="Edit list"
					>
						<i class="bi bi-pencil"></i>
					</button>
				{/if}
				{#if onDelete}
					<button
						type="button"
						class="btn btn-outline-danger"
						onclick={() => onDelete?.(list)}
						title="Delete list"
					>
						<i class="bi bi-trash"></i>
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.list-card {
		transition:
			transform 0.15s ease-in-out,
			box-shadow 0.15s ease-in-out;
	}

	.list-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.card-title {
		max-width: 180px;
	}

	.badges {
		flex-shrink: 0;
	}
</style>
