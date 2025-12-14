<script lang="ts">
	import { dataStore } from '$stores/data.svelte';
	import { settingsStore } from '$stores/settings.svelte';
	import {
		parseCSV,
		detectNameTemplate,
		detectIdColumn,
		applyTemplate,
		validateColumnIds,
		generateId
	} from '$utils/csv';
	import type { ListEntry } from '$types';

	interface Props {
		onComplete?: () => void;
		onCancel?: () => void;
	}

	let { onComplete, onCancel }: Props = $props();

	// Wizard state
	let step = $state(1);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// File data
	let selectedFile = $state<File | null>(null);
	let parsedData = $state<Record<string, string>[]>([]);
	let headers = $state<string[]>([]);
	let parseErrors = $state<string[]>([]);

	// Configuration
	let listName = $state('');
	let nameTemplate = $state('');
	let info1Template = $state('');
	let info2Template = $state('');
	let info3Template = $state('');
	let idSource = $state<'auto' | 'column'>('auto');
	let idColumn = $state('');
	let skipExistingWinners = $state(false);
	let removeWinnersFromList = $state(true);
	let preventWinningSamePrize = $state(false);

	// Derived values
	const previewData = $derived(parsedData.slice(0, 10));
	const firstRow = $derived(parsedData[0] || {});
	const namePreview = $derived(applyTemplate(nameTemplate, firstRow));
	const info1Preview = $derived(applyTemplate(info1Template, firstRow));
	const info2Preview = $derived(applyTemplate(info2Template, firstRow));
	const info3Preview = $derived(applyTemplate(info3Template, firstRow));
	const canProceedStep1 = $derived(selectedFile !== null && parsedData.length > 0);
	const canProceedStep2 = $derived(listName.trim() !== '' && nameTemplate.trim() !== '');
	const canProceedStep3 = $derived(idSource === 'auto' || (idSource === 'column' && idColumn !== ''));

	async function handleFileSelect(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		if (!input.files?.length) return;

		const file = input.files[0];
		if (!file.name.toLowerCase().endsWith('.csv')) {
			error = 'Please select a CSV file';
			return;
		}

		loading = true;
		error = null;

		try {
			const text = await file.text();
			const result = parseCSV(text);

			if (result.errors.length > 0) {
				parseErrors = result.errors;
			}

			if (result.data.length === 0) {
				throw new Error('CSV file appears to be empty');
			}

			selectedFile = file;
			parsedData = result.data;
			headers = Object.keys(result.data[0]);

			// Set defaults
			listName = file.name.replace(/\.[^/.]+$/, '');
			nameTemplate = detectNameTemplate(headers, result.data[0]);
			const detectedId = detectIdColumn(headers);
			if (detectedId) {
				idSource = 'column';
				idColumn = detectedId;
			}

			// Set default info templates
			if (detectedId) {
				info1Template = `{${detectedId}}`;
			} else if (headers.length >= 1) {
				info1Template = `{${headers[0]}}`;
			}
			info2Template = nameTemplate;

			// Load settings
			skipExistingWinners = settingsStore.skipExistingWinners;
			removeWinnersFromList = settingsStore.preventDuplicates;
			preventWinningSamePrize = settingsStore.preventSamePrize;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Error reading file';
		} finally {
			loading = false;
		}
	}

	function insertFieldAtCursor(inputId: string, field: string) {
		const input = document.getElementById(inputId) as HTMLInputElement;
		if (!input) return;

		const cursorPos = input.selectionStart || input.value.length;
		const text = input.value;
		const placeholder = `{${field}}`;
		const newValue = text.slice(0, cursorPos) + placeholder + text.slice(cursorPos);

		// Update the appropriate state
		switch (inputId) {
			case 'nameTemplate':
				nameTemplate = newValue;
				break;
			case 'info1Template':
				info1Template = newValue;
				break;
			case 'info2Template':
				info2Template = newValue;
				break;
			case 'info3Template':
				info3Template = newValue;
				break;
		}

		// Focus and set cursor position
		setTimeout(() => {
			input.focus();
			const newPos = cursorPos + placeholder.length;
			input.setSelectionRange(newPos, newPos);
		}, 0);
	}

	async function handleConfirm() {
		if (!parsedData.length) return;

		loading = true;
		error = null;

		try {
			// Validate ID column if using column-based IDs
			if (idSource === 'column') {
				const validation = validateColumnIds(parsedData, idColumn);
				if (!validation.isValid) {
					throw new Error(validation.error);
				}
			}

			// Filter existing winners if enabled
			let dataToUpload = parsedData;
			let skippedCount = 0;

			if (skipExistingWinners && dataStore.winners.length > 0) {
				const winnerIds = new Set(
					dataStore.winners.flatMap((w) => [w.entryId, w.winnerId]).filter(Boolean)
				);

				dataToUpload = parsedData.filter((row, index) => {
					const entryId =
						idSource === 'column' ? row[idColumn]?.trim() || generateId() : generateId();
					return !winnerIds.has(entryId);
				});

				skippedCount = parsedData.length - dataToUpload.length;
			}

			if (dataToUpload.length === 0) {
				throw new Error('All records have already won prizes. No new records to upload.');
			}

			// Build the list object
			const listId = generateId();
			const entries: ListEntry[] = dataToUpload.map((row, index) => ({
				id: idSource === 'column' ? row[idColumn]?.trim() || generateId() : generateId(),
				index,
				data: row
			}));

			const listData = {
				listId,
				metadata: {
					listId,
					name: listName.trim(),
					timestamp: Date.now(),
					originalFilename: selectedFile?.name || 'imported.csv',
					entryCount: entries.length,
					originalCount: parsedData.length,
					skippedWinners: skippedCount,
					nameConfig: nameTemplate,
					infoConfig: {
						info1: info1Template,
						info2: info2Template,
						info3: info3Template
					},
					idConfig: {
						source: idSource,
						column: idSource === 'column' ? idColumn : undefined
					},
					listSettings: {
						removeWinnersFromList,
						preventWinningSamePrize
					}
				},
				entries
			};

			// Save to backend
			await dataStore.save('lists', listData);

			// Reset wizard
			resetWizard();
			onComplete?.();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Error importing list';
		} finally {
			loading = false;
		}
	}

	function resetWizard() {
		step = 1;
		selectedFile = null;
		parsedData = [];
		headers = [];
		parseErrors = [];
		listName = '';
		nameTemplate = '';
		info1Template = '';
		info2Template = '';
		info3Template = '';
		idSource = 'auto';
		idColumn = '';
		error = null;
	}

	function handleCancel() {
		resetWizard();
		onCancel?.();
	}

	function nextStep() {
		if (step < 4) step++;
	}

	function prevStep() {
		if (step > 1) step--;
	}
</script>

<div class="import-wizard">
	<!-- Progress Steps -->
	<div class="wizard-progress mb-4">
		<div class="d-flex justify-content-between">
			{#each [1, 2, 3, 4] as s}
				<div class="wizard-step" class:active={step >= s} class:current={step === s}>
					<div class="step-number">{s}</div>
					<div class="step-label">
						{#if s === 1}Upload{:else if s === 2}Configure{:else if s === 3}ID Settings{:else}Confirm{/if}
					</div>
				</div>
			{/each}
		</div>
		<div class="progress mt-2" style="height: 4px;">
			<div class="progress-bar" style="width: {((step - 1) / 3) * 100}%"></div>
		</div>
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="alert alert-danger alert-dismissible">
			<i class="bi bi-exclamation-triangle me-2"></i>
			{error}
			<button type="button" class="btn-close" aria-label="Dismiss error" onclick={() => (error = null)}></button>
		</div>
	{/if}

	<!-- Step 1: File Upload -->
	{#if step === 1}
		<div class="step-content">
			<h5 class="mb-3"><i class="bi bi-upload me-2"></i>Select CSV File</h5>

			<div class="mb-3">
				<label class="form-label" for="csvFile">CSV File</label>
				<input
					type="file"
					id="csvFile"
					class="form-control form-control-lg"
					accept=".csv"
					onchange={handleFileSelect}
					disabled={loading}
				/>
				<div class="form-text">Upload a CSV file with your list data.</div>
			</div>

			{#if loading}
				<div class="text-center py-4">
					<div class="spinner-border text-primary" role="status">
						<span class="visually-hidden">Processing...</span>
					</div>
					<p class="mt-2 text-muted">Reading file...</p>
				</div>
			{/if}

			{#if parseErrors.length > 0}
				<div class="alert alert-warning">
					<strong>Parse warnings:</strong>
					<ul class="mb-0 mt-2">
						{#each parseErrors.slice(0, 5) as parseError}
							<li>{parseError}</li>
						{/each}
						{#if parseErrors.length > 5}
							<li>...and {parseErrors.length - 5} more</li>
						{/if}
					</ul>
				</div>
			{/if}

			{#if parsedData.length > 0}
				<div class="alert alert-success">
					<i class="bi bi-check-circle me-2"></i>
					Successfully parsed {parsedData.length} records with {headers.length} columns.
				</div>

				<!-- Preview Table -->
				<div class="card">
					<div class="card-header">
						<h6 class="mb-0">Data Preview (first {previewData.length} rows)</h6>
					</div>
					<div class="card-body p-0">
						<div class="table-responsive" style="max-height: 300px;">
							<table class="table table-sm table-striped mb-0">
								<thead class="sticky-top bg-light">
									<tr>
										{#each headers as header}
											<th>{header}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each previewData as row}
										<tr>
											{#each headers as header}
												<td>{row[header] || ''}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Step 2: Name Configuration -->
	{#if step === 2}
		<div class="step-content">
			<h5 class="mb-3"><i class="bi bi-person-badge me-2"></i>Display Configuration</h5>

			<div class="mb-3">
				<label class="form-label" for="listNameInput">List Name</label>
				<input
					type="text"
					id="listNameInput"
					class="form-control"
					bind:value={listName}
					placeholder="Enter list name"
				/>
			</div>

			<div class="mb-3">
				<label class="form-label" for="nameTemplate">Display Name Template</label>
				<input
					type="text"
					id="nameTemplate"
					class="form-control"
					bind:value={nameTemplate}
					placeholder={"{firstName} {lastName}"}
				/>
				<div class="form-text">Use {'{'}field{'}'} placeholders to build the display name.</div>
				<div class="mt-2">
					<small class="text-muted">Available fields:</small>
					<div class="d-flex flex-wrap gap-1 mt-1">
						{#each headers as header}
							<button
								type="button"
								class="btn btn-sm btn-outline-secondary"
								onclick={() => insertFieldAtCursor('nameTemplate', header)}
							>
								{header}
							</button>
						{/each}
					</div>
				</div>
				{#if namePreview}
					<div class="mt-2">
						<strong>Preview:</strong> {namePreview}
					</div>
				{/if}
			</div>

			<hr />
			<h6 class="mb-3">Additional Info Fields (shown on winner cards)</h6>

			<div class="row g-3">
				<div class="col-md-4">
					<label class="form-label" for="info1Template">Info Line 1</label>
					<input
						type="text"
						id="info1Template"
						class="form-control"
						bind:value={info1Template}
						placeholder={"e.g., {idCard}"}
					/>
					{#if info1Preview}
						<small class="text-muted">Preview: {info1Preview}</small>
					{/if}
				</div>
				<div class="col-md-4">
					<label class="form-label" for="info2Template">Info Line 2</label>
					<input
						type="text"
						id="info2Template"
						class="form-control"
						bind:value={info2Template}
						placeholder={"e.g., {email}"}
					/>
					{#if info2Preview}
						<small class="text-muted">Preview: {info2Preview}</small>
					{/if}
				</div>
				<div class="col-md-4">
					<label class="form-label" for="info3Template">Info Line 3</label>
					<input
						type="text"
						id="info3Template"
						class="form-control"
						bind:value={info3Template}
						placeholder={"e.g., {phone}"}
					/>
					{#if info3Preview}
						<small class="text-muted">Preview: {info3Preview}</small>
					{/if}
				</div>
			</div>

			<div class="d-flex flex-wrap gap-1 mt-2">
				{#each headers as header}
					<button
						type="button"
						class="btn btn-sm btn-outline-primary"
						onclick={() => {
							const focused = document.activeElement as HTMLInputElement;
							if (focused?.id?.includes('info')) {
								insertFieldAtCursor(focused.id, header);
							} else {
								insertFieldAtCursor('info1Template', header);
							}
						}}
					>
						{header}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Step 3: ID Configuration -->
	{#if step === 3}
		<div class="step-content">
			<h5 class="mb-3"><i class="bi bi-key me-2"></i>ID Configuration</h5>

			<div class="mb-3">
				<span class="form-label d-block">Record ID Source</span>
				<div class="form-check">
					<input
						class="form-check-input"
						type="radio"
						id="autoGenerateId"
						bind:group={idSource}
						value="auto"
					/>
					<label class="form-check-label" for="autoGenerateId">
						Auto-generate unique IDs
						<small class="text-muted d-block">System will create unique identifiers for each record</small>
					</label>
				</div>
				<div class="form-check mt-2">
					<input
						class="form-check-input"
						type="radio"
						id="useColumnId"
						bind:group={idSource}
						value="column"
					/>
					<label class="form-check-label" for="useColumnId">
						Use existing column as ID
						<small class="text-muted d-block">Use a column from your data as the unique identifier</small>
					</label>
				</div>
			</div>

			{#if idSource === 'column'}
				<div class="mb-3">
					<label class="form-label" for="idColumnSelect">Select ID Column</label>
					<select id="idColumnSelect" class="form-select" bind:value={idColumn}>
						<option value="">Select a column...</option>
						{#each headers as header}
							<option value={header}>{header}</option>
						{/each}
					</select>
					<div class="form-text">
						This column must contain unique, non-empty values for each record.
					</div>
				</div>
			{/if}

			<hr />
			<h6 class="mb-3">List Settings</h6>

			<div class="form-check mb-2">
				<input
					class="form-check-input"
					type="checkbox"
					id="skipExistingWinners"
					bind:checked={skipExistingWinners}
				/>
				<label class="form-check-label" for="skipExistingWinners">
					Skip existing winners when importing
					<small class="text-muted d-block">Exclude records that have already won prizes</small>
				</label>
			</div>

			<div class="form-check mb-2">
				<input
					class="form-check-input"
					type="checkbox"
					id="removeWinnersFromList"
					bind:checked={removeWinnersFromList}
				/>
				<label class="form-check-label" for="removeWinnersFromList">
					Remove winners from list after selection
					<small class="text-muted d-block">Winners will be excluded from future selections in this list</small>
				</label>
			</div>

			<div class="form-check mb-2">
				<input
					class="form-check-input"
					type="checkbox"
					id="preventWinningSamePrize"
					bind:checked={preventWinningSamePrize}
				/>
				<label class="form-check-label" for="preventWinningSamePrize">
					Prevent winning same prize twice
					<small class="text-muted d-block">Same person cannot win the same prize again</small>
				</label>
			</div>
		</div>
	{/if}

	<!-- Step 4: Confirmation -->
	{#if step === 4}
		<div class="step-content">
			<h5 class="mb-3"><i class="bi bi-check2-circle me-2"></i>Confirm Import</h5>

			<div class="card mb-3">
				<div class="card-body">
					<h6 class="card-subtitle mb-3 text-muted">Summary</h6>
					<dl class="row mb-0">
						<dt class="col-sm-4">List Name</dt>
						<dd class="col-sm-8">{listName}</dd>

						<dt class="col-sm-4">Records</dt>
						<dd class="col-sm-8">{parsedData.length}</dd>

						<dt class="col-sm-4">Display Name</dt>
						<dd class="col-sm-8">{namePreview || '(not configured)'}</dd>

						<dt class="col-sm-4">ID Source</dt>
						<dd class="col-sm-8">
							{idSource === 'auto' ? 'Auto-generated' : `Column: ${idColumn}`}
						</dd>

						<dt class="col-sm-4">Settings</dt>
						<dd class="col-sm-8">
							<ul class="list-unstyled mb-0">
								{#if skipExistingWinners}
									<li><i class="bi bi-check text-success"></i> Skip existing winners</li>
								{/if}
								{#if removeWinnersFromList}
									<li><i class="bi bi-check text-success"></i> Remove winners from list</li>
								{/if}
								{#if preventWinningSamePrize}
									<li><i class="bi bi-check text-success"></i> Prevent same prize twice</li>
								{/if}
							</ul>
						</dd>
					</dl>
				</div>
			</div>

			<!-- Winner Card Preview -->
			<div class="card">
				<div class="card-header">
					<h6 class="mb-0">Winner Card Preview</h6>
				</div>
				<div class="card-body">
					<div class="winner-preview p-3 bg-light rounded text-center">
						<div class="h4 mb-2">{namePreview || 'Display Name'}</div>
						{#if info1Preview}
							<div class="text-muted">{info1Preview}</div>
						{/if}
						{#if info2Preview}
							<div class="text-muted">{info2Preview}</div>
						{/if}
						{#if info3Preview}
							<div class="text-muted">{info3Preview}</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Navigation Buttons -->
	<div class="wizard-actions d-flex justify-content-between mt-4 pt-3 border-top">
		<div>
			{#if step > 1}
				<button type="button" class="btn btn-outline-secondary" onclick={prevStep} disabled={loading}>
					<i class="bi bi-arrow-left me-1"></i> Back
				</button>
			{:else}
				<button type="button" class="btn btn-outline-secondary" onclick={handleCancel} disabled={loading}>
					Cancel
				</button>
			{/if}
		</div>
		<div>
			{#if step < 4}
				<button
					type="button"
					class="btn btn-primary"
					onclick={nextStep}
					disabled={loading || (step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2) || (step === 3 && !canProceedStep3)}
				>
					Next <i class="bi bi-arrow-right ms-1"></i>
				</button>
			{:else}
				<button type="button" class="btn btn-success" onclick={handleConfirm} disabled={loading}>
					{#if loading}
						<span class="spinner-border spinner-border-sm me-1" role="status"></span>
						Importing...
					{:else}
						<i class="bi bi-check-lg me-1"></i> Import List
					{/if}
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.wizard-progress {
		padding: 0 1rem;
	}

	.wizard-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		position: relative;
	}

	.step-number {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: #e9ecef;
		color: #6c757d;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		transition: all 0.3s;
	}

	.wizard-step.active .step-number {
		background: var(--bs-primary, #0d6efd);
		color: white;
	}

	.wizard-step.current .step-number {
		box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.25);
	}

	.step-label {
		font-size: 0.75rem;
		margin-top: 0.25rem;
		color: #6c757d;
	}

	.wizard-step.active .step-label {
		color: var(--bs-primary, #0d6efd);
		font-weight: 500;
	}

	.step-content {
		min-height: 400px;
	}

	.winner-preview {
		max-width: 300px;
		margin: 0 auto;
		border: 2px dashed #dee2e6;
	}
</style>
