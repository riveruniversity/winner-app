<script lang="ts">
	import { historyFilterStore } from '$stores/filters.svelte';

	const hasActiveFilters = $derived(
		historyFilterStore.filterPrize !== '' ||
			historyFilterStore.filterList !== '' ||
			historyFilterStore.filterDate !== ''
	);
</script>

<div class="history-filters mb-3">
	<div class="row g-2 align-items-end">
		<!-- List Filter -->
		<div class="col-md-3">
			<label class="form-label small text-muted mb-1" for="history-filter-list">List</label>
			<select
				id="history-filter-list"
				class="form-select form-select-sm"
				bind:value={historyFilterStore.filterList}
			>
				<option value="">All Lists</option>
				{#each historyFilterStore.uniqueLists as list}
					<option value={list}>{list}</option>
				{/each}
			</select>
		</div>

		<!-- Prize Filter -->
		<div class="col-md-3">
			<label class="form-label small text-muted mb-1" for="history-filter-prize">Prize</label>
			<select
				id="history-filter-prize"
				class="form-select form-select-sm"
				bind:value={historyFilterStore.filterPrize}
			>
				<option value="">All Prizes</option>
				{#each historyFilterStore.uniquePrizes as prize}
					<option value={prize}>{prize}</option>
				{/each}
			</select>
		</div>

		<!-- Date Filter -->
		<div class="col-md-3">
			<label class="form-label small text-muted mb-1" for="history-filter-date">Date</label>
			<input
				type="date"
				id="history-filter-date"
				class="form-control form-control-sm"
				bind:value={historyFilterStore.filterDate}
			/>
		</div>

		<!-- Clear Button -->
		<div class="col-auto">
			{#if hasActiveFilters}
				<button
					type="button"
					class="btn btn-outline-secondary btn-sm"
					onclick={() => historyFilterStore.clearFilters()}
				>
					<i class="bi bi-x-circle me-1"></i>
					Clear
				</button>
			{/if}
		</div>
	</div>

	<!-- Statistics -->
	<div class="mt-2 d-flex gap-3">
		<small class="text-muted">
			<i class="bi bi-clock-history me-1"></i>
			{historyFilterStore.stats.totalSelections} total selections
		</small>
		{#if historyFilterStore.stats.mostUsedPrize}
			<small class="text-muted">
				<i class="bi bi-trophy me-1"></i>
				Most selected: {historyFilterStore.stats.mostUsedPrize}
			</small>
		{/if}
	</div>
</div>
