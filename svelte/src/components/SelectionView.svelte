<script lang="ts">
	import { setupStore } from '$stores/setup.svelte';
	import { settingsStore } from '$stores/settings.svelte';
	import { selectionStore } from '$stores/selection.svelte';
	import CountdownOverlay from './CountdownOverlay.svelte';
	import WinnersGrid from './WinnersGrid.svelte';

	let loading = $state(false);
	let errorMessage = $state<string | null>(null);

	async function handleStart() {
		if (loading || !setupStore.canStart) return;

		loading = true;
		errorMessage = null;

		try {
			await selectionStore.startSelection();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Selection failed';
			console.error('Selection error:', error);
		} finally {
			loading = false;
		}
	}

	function handleNewSelection() {
		selectionStore.reset();
	}
</script>

<div class="selection-view">
	<!-- Delay overlay -->
	{#if selectionStore.phase === 'delay'}
		<CountdownOverlay
			progress={selectionStore.delayProgress}
			duration={settingsStore.preSelectionDelay}
		/>
	{/if}

	<!-- Main content -->
	<div class="selection-content">
		{#if selectionStore.phase === 'idle'}
			<!-- Setup view -->
			<div class="setup-section">
				<h2 class="selection-title">Select Winners</h2>
				<p class="selection-subtitle">Choose a list and prize to begin</p>

				<!-- Info Cards -->
				<div class="info-grid">
					<div class="info-card">
						<div class="info-label">Current List</div>
						<div class="info-value">{setupStore.listDisplayText}</div>
					</div>
					<div class="info-card">
						<div class="info-label">Eligible Entries</div>
						<div class="info-value">{setupStore.eligibleEntries}</div>
					</div>
					<div class="info-card">
						<div class="info-label">Winners to Select</div>
						<div class="info-value">{setupStore.winnersCount}</div>
					</div>
					<div class="info-card">
						<div class="info-label">Prize</div>
						<div class="info-value">{setupStore.prizeDisplayText}</div>
					</div>
				</div>

				<!-- Play Button -->
				<button
					class="big-play-button"
					disabled={!setupStore.canStart || loading}
					onclick={handleStart}
					aria-label="Start winner selection"
				>
					{#if loading}
						<div class="spinner-border" role="status">
							<span class="visually-hidden">Loading...</span>
						</div>
					{:else}
						<i class="bi bi-play-fill"></i>
					{/if}
				</button>

				<!-- Validation warnings -->
				{#if setupStore.hasValidationWarning}
					<div class="alert alert-warning mt-3">
						{#if setupStore.entriesExceeded}
							<i class="bi bi-exclamation-triangle me-1"></i>
							Winners count exceeds available entries
						{:else if setupStore.prizeQuantityExceeded}
							<i class="bi bi-exclamation-triangle me-1"></i>
							Winners count exceeds prize quantity
						{/if}
					</div>
				{/if}

				<!-- Error message -->
				{#if errorMessage}
					<div class="alert alert-danger mt-3">
						<i class="bi bi-x-circle me-1"></i>
						{errorMessage}
					</div>
				{/if}
			</div>
		{:else if selectionStore.phase === 'selecting'}
			<!-- Selecting state -->
			<div class="selecting-section">
				<div class="spinner-border text-light" style="width: 4rem; height: 4rem;" role="status">
					<span class="visually-hidden">Selecting...</span>
				</div>
				<p class="mt-3 text-white">Selecting winners...</p>
			</div>
		{:else if selectionStore.phase === 'revealing' || selectionStore.phase === 'complete'}
			<!-- Winners display -->
			<div class="winners-section">
				<h2 class="winners-title">
					<i class="bi bi-trophy-fill me-2"></i>
					{#if selectionStore.selectedWinners.length === 1}
						Winner!
					{:else}
						Winners!
					{/if}
				</h2>

				<WinnersGrid
					winners={selectionStore.selectedWinners}
					revealedCount={selectionStore.revealedCount}
				/>

				{#if selectionStore.phase === 'complete'}
					<div class="complete-actions">
						<button class="btn btn-light btn-lg" onclick={handleNewSelection}>
							<i class="bi bi-arrow-repeat me-2"></i>
							New Selection
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.selection-view {
		min-height: 100vh;
		background: linear-gradient(135deg, var(--color-primary, #6366f1) 0%, var(--color-secondary, #8b5cf6) 100%);
		display: flex;
		flex-direction: column;
	}

	.selection-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.setup-section,
	.selecting-section,
	.winners-section {
		text-align: center;
		color: white;
		width: 100%;
		max-width: 800px;
	}

	.selection-title {
		font-size: 2.5rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
	}

	.selection-subtitle {
		font-size: 1.25rem;
		opacity: 0.9;
		margin-bottom: 2rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.info-card {
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(10px);
		border-radius: 1rem;
		padding: 1rem;
	}

	.info-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.8;
		margin-bottom: 0.25rem;
	}

	.info-value {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.big-play-button {
		width: 150px;
		height: 150px;
		border-radius: 50%;
		border: none;
		background: var(--selection-color, #10b981);
		color: white;
		font-size: 4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		margin: 0 auto;
	}

	.big-play-button:hover:not(:disabled) {
		transform: scale(1.1);
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
	}

	.big-play-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.winners-title {
		font-size: 2rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
		color: white;
	}

	.winners-section {
		max-width: 1200px;
	}

	.complete-actions {
		margin-top: 2rem;
	}
</style>
