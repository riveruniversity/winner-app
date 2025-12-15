<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { List, ListEntry } from '$types';
	import { formatDisplayName, formatInfoField } from '$utils/formatting';

	interface Props {
		id?: string;
		list: List | null;
		onDeleteEntry?: (listId: string, entryId: string) => void;
	}

	let { id = 'viewModal', list = null, onDeleteEntry }: Props = $props();

	let modalEl: HTMLElement | null = $state(null);
	let bsModal: import('bootstrap').Modal | null = null;
	let searchTerm = $state('');
	let currentPage = $state(1);
	let pageSize = $state(25);

	// Filtered and paginated entries
	const filteredEntries = $derived.by(() => {
		if (!list?.entries) return [];
		if (!searchTerm.trim()) return list.entries;

		const term = searchTerm.toLowerCase();
		return list.entries.filter((entry) => {
			const displayName = formatDisplayName(entry, list.metadata.nameConfig).toLowerCase();
			if (displayName.includes(term)) return true;

			// Also search in all data fields
			return Object.values(entry.data).some((value) =>
				value != null && String(value).toLowerCase().includes(term)
			);
		});
	});

	const totalPages = $derived(Math.ceil(filteredEntries.length / pageSize));

	const paginatedEntries = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredEntries.slice(start, start + pageSize);
	});

	// Get column headers from first entry
	const columns = $derived.by(() => {
		if (!list?.entries?.length) return [];
		const firstEntry = list.entries[0];
		return Object.keys(firstEntry.data);
	});

	onMount(async () => {
		if (modalEl) {
			const bootstrap = await import('bootstrap');
			bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);

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
		searchTerm = '';
		currentPage = 1;
	}

	function handleHide() {
		// Reset state when hidden
	}

	function handleDeleteClick(entry: ListEntry) {
		if (list && onDeleteEntry) {
			onDeleteEntry(list.listId, entry.id);
		}
	}

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}

	export function show() {
		bsModal?.show();
	}

	export function hide() {
		bsModal?.hide();
	}
</script>

<div
	class="modal fade"
	{id}
	tabindex="-1"
	aria-labelledby="{id}-label"
	aria-hidden="true"
	bind:this={modalEl}
>
	<div class="modal-dialog modal-xl modal-dialog-scrollable">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title" id="{id}-label">
					{#if list}
						<i class="bi bi-list-ul me-2"></i>
						{list.metadata.name}
						<span class="badge bg-secondary ms-2">{list.metadata.entryCount} entries</span>
					{:else}
						List Entries
					{/if}
				</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
			</div>
			<div class="modal-body">
				{#if list}
					<!-- Search and controls -->
					<div class="row mb-3">
						<div class="col-md-6">
							<div class="input-group">
								<span class="input-group-text">
									<i class="bi bi-search"></i>
								</span>
								<input
									type="text"
									class="form-control"
									placeholder="Search entries..."
									bind:value={searchTerm}
									oninput={() => (currentPage = 1)}
								/>
								{#if searchTerm}
									<button
										class="btn btn-outline-secondary"
										type="button"
										onclick={() => (searchTerm = '')}
										aria-label="Clear search"
									>
										<i class="bi bi-x"></i>
									</button>
								{/if}
							</div>
						</div>
						<div class="col-md-3">
							<select class="form-select" bind:value={pageSize} onchange={() => (currentPage = 1)}>
								<option value={25}>25 per page</option>
								<option value={50}>50 per page</option>
								<option value={100}>100 per page</option>
							</select>
						</div>
						<div class="col-md-3 text-end">
							<span class="text-muted">
								Showing {paginatedEntries.length} of {filteredEntries.length}
							</span>
						</div>
					</div>

					<!-- Entries table -->
					{#if paginatedEntries.length > 0}
						<div class="table-responsive">
							<table class="table table-hover table-striped align-middle">
								<thead class="table-light">
									<tr>
										<th scope="col" style="width: 50px">#</th>
										<th scope="col">Name</th>
										{#each columns.slice(0, 4) as column}
											<th scope="col">{column}</th>
										{/each}
										{#if onDeleteEntry}
											<th scope="col" style="width: 60px">Actions</th>
										{/if}
									</tr>
								</thead>
								<tbody>
									{#each paginatedEntries as entry, index}
										<tr>
											<td class="text-muted">{(currentPage - 1) * pageSize + index + 1}</td>
											<td>
												<strong>{formatDisplayName(entry, list.metadata.nameConfig)}</strong>
												{#if list.metadata.infoConfig?.info1}
													<br />
													<small class="text-muted">
														{formatInfoField(entry, list.metadata.infoConfig.info1)}
													</small>
												{/if}
											</td>
											{#each columns.slice(0, 4) as column}
												<td>{entry.data[column] ?? ''}</td>
											{/each}
											{#if onDeleteEntry}
												<td>
													<button
														class="btn btn-outline-danger btn-sm"
														onclick={() => handleDeleteClick(entry)}
														title="Delete entry"
														aria-label="Delete entry"
													>
														<i class="bi bi-trash"></i>
													</button>
												</td>
											{/if}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Pagination -->
						{#if totalPages > 1}
							<nav aria-label="Entries pagination">
								<ul class="pagination justify-content-center mb-0">
									<li class="page-item" class:disabled={currentPage === 1}>
										<button
											class="page-link"
											onclick={() => goToPage(1)}
											disabled={currentPage === 1}
											aria-label="Go to first page"
										>
											<i class="bi bi-chevron-double-left"></i>
										</button>
									</li>
									<li class="page-item" class:disabled={currentPage === 1}>
										<button
											class="page-link"
											onclick={() => goToPage(currentPage - 1)}
											disabled={currentPage === 1}
											aria-label="Go to previous page"
										>
											<i class="bi bi-chevron-left"></i>
										</button>
									</li>

									{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
										const start = Math.max(1, currentPage - 2);
										const end = Math.min(totalPages, start + 4);
										const adjustedStart = Math.max(1, end - 4);
										return adjustedStart + i;
									}).filter((p) => p <= totalPages) as page}
										<li class="page-item" class:active={page === currentPage}>
											<button class="page-link" onclick={() => goToPage(page)}>
												{page}
											</button>
										</li>
									{/each}

									<li class="page-item" class:disabled={currentPage === totalPages}>
										<button
											class="page-link"
											onclick={() => goToPage(currentPage + 1)}
											disabled={currentPage === totalPages}
											aria-label="Go to next page"
										>
											<i class="bi bi-chevron-right"></i>
										</button>
									</li>
									<li class="page-item" class:disabled={currentPage === totalPages}>
										<button
											class="page-link"
											onclick={() => goToPage(totalPages)}
											disabled={currentPage === totalPages}
											aria-label="Go to last page"
										>
											<i class="bi bi-chevron-double-right"></i>
										</button>
									</li>
								</ul>
							</nav>
						{/if}
					{:else}
						<div class="text-center text-muted py-5">
							<i class="bi bi-inbox fs-1 d-block mb-3"></i>
							{#if searchTerm}
								<p>No entries match your search.</p>
							{:else}
								<p>This list has no entries.</p>
							{/if}
						</div>
					{/if}
				{:else}
					<div class="text-center text-muted py-5">
						<i class="bi bi-exclamation-circle fs-1 d-block mb-3"></i>
						<p>No list selected.</p>
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
			</div>
		</div>
	</div>
</div>
