<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { dataStore } from '$stores/data.svelte';
	import type { Winner } from '$types';

	// View state
	let view = $state<'scanner' | 'results' | 'winner'>('scanner');
	let isScanning = $state(false);
	let scanStatus = $state('Camera not started');

	// Search state
	let searchInput = $state('');
	let searchResults = $state<Winner[]>([]);
	let isFamilySearch = $state(false);
	let scannedIdCard = $state('');

	// Winner state
	let selectedWinner = $state<Winner | null>(null);
	let winnerPrizes = $state<Winner[]>([]);

	// Alert state
	let showAlert = $state(false);
	let alertTicketCode = $state('');
	let showNoResultsModal = $state(false);

	// Operator state
	let operatorName = $state('');
	let showOperatorModal = $state(false);
	let operatorInput = $state('');

	// Theme
	let darkMode = $state(false);

	// QR Scanner reference
	let qrScanner: unknown = null;
	let videoElement = $state<HTMLVideoElement | null>(null);

	onMount(async () => {
		if (!browser) return;

		// Load saved settings
		operatorName = localStorage.getItem('scan_operator_name') || '';
		darkMode = localStorage.getItem('theme') === 'dark';

		if (!operatorName) {
			showOperatorModal = true;
		}

		// Load winners data
		await dataStore.load('winners');

		// Apply theme
		document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
	});

	onDestroy(() => {
		stopScanning();
	});

	async function startScanning() {
		if (!browser || !videoElement) return;

		try {
			// Dynamically import qr-scanner
			const QrScanner = (await import('qr-scanner')).default;

			qrScanner = new QrScanner(
				videoElement,
				(result: { data: string }) => handleQRResult(result.data),
				{
					preferredCamera: 'environment',
					highlightScanRegion: true,
					highlightCodeOutline: true
				}
			);

			await (qrScanner as any).start();
			isScanning = true;
			scanStatus = 'Scanning for QR codes...';
		} catch (error) {
			console.error('Scanner error:', error);
			scanStatus = 'Camera access denied or not available';
		}
	}

	function stopScanning() {
		if (qrScanner) {
			(qrScanner as any).stop();
			(qrScanner as any).destroy();
			qrScanner = null;
		}
		isScanning = false;
		scanStatus = 'Camera stopped';
	}

	function handleQRResult(code: string) {
		stopScanning();
		searchByCode(code);
	}

	function searchByCode(code: string) {
		const trimmedCode = code.trim().toLowerCase();
		if (!trimmedCode) return;

		// Search in winners by entryId or winnerId
		const matchingWinners = dataStore.winners.filter(
			(w) =>
				w.entryId?.toLowerCase() === trimmedCode ||
				w.winnerId?.toLowerCase() === trimmedCode ||
				w.data?.idCard?.toString().toLowerCase() === trimmedCode ||
				w.data?.contactId?.toString().toLowerCase() === trimmedCode
		);

		if (matchingWinners.length === 0) {
			alertTicketCode = code;
			showAlert = true;
			return;
		}

		if (matchingWinners.length === 1) {
			selectedWinner = matchingWinners[0];
			winnerPrizes = matchingWinners;
			view = 'winner';
		} else {
			// Multiple prizes for same person
			selectedWinner = matchingWinners[0];
			winnerPrizes = matchingWinners;
			view = 'winner';
		}
	}

	async function performSearch() {
		const input = searchInput.trim();
		if (!input) return;

		searchInput = '';

		// First try exact code match
		const exactMatches = dataStore.winners.filter(
			(w) =>
				w.entryId?.toLowerCase() === input.toLowerCase() ||
				w.winnerId?.toLowerCase() === input.toLowerCase() ||
				w.data?.idCard?.toString().toLowerCase() === input.toLowerCase()
		);

		if (exactMatches.length > 0) {
			if (exactMatches.length === 1) {
				selectedWinner = exactMatches[0];
				winnerPrizes = exactMatches;
				view = 'winner';
			} else {
				selectedWinner = exactMatches[0];
				winnerPrizes = exactMatches;
				view = 'winner';
			}
			return;
		}

		// Name search
		const nameMatches = dataStore.winners.filter((w) =>
			w.displayName.toLowerCase().includes(input.toLowerCase())
		);

		if (nameMatches.length === 0) {
			showNoResultsModal = true;
			return;
		}

		if (nameMatches.length === 1) {
			selectedWinner = nameMatches[0];
			winnerPrizes = [nameMatches[0]];
			view = 'winner';
		} else {
			searchResults = nameMatches;
			isFamilySearch = false;
			view = 'results';
		}
	}

	function selectResult(winner: Winner) {
		// Find all prizes for this winner
		const allPrizes = dataStore.winners.filter(
			(w) => w.entryId === winner.entryId || w.displayName === winner.displayName
		);
		selectedWinner = winner;
		winnerPrizes = allPrizes;
		view = 'winner';
	}

	async function markPickedUp(winner: Winner) {
		if (winner.pickedUp) return;

		const updatedWinner = {
			...winner,
			pickedUp: true,
			pickupTimestamp: Date.now(),
			pickupStation: operatorName || 'Unknown'
		};

		await dataStore.save('winners', updatedWinner);

		// Update local state
		const idx = winnerPrizes.findIndex((w) => w.winnerId === winner.winnerId);
		if (idx !== -1) {
			winnerPrizes[idx] = updatedWinner as Winner;
		}
	}

	function backToScanner() {
		view = 'scanner';
		selectedWinner = null;
		winnerPrizes = [];
		searchResults = [];
		isFamilySearch = false;
		scannedIdCard = '';
	}

	function toggleTheme() {
		darkMode = !darkMode;
		document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
		localStorage.setItem('theme', darkMode ? 'dark' : 'light');
	}

	function setOperatorName() {
		const name = operatorInput.trim();
		if (!name) return;
		operatorName = name;
		localStorage.setItem('scan_operator_name', name);
		showOperatorModal = false;
		operatorInput = '';
	}

	function formatDate(timestamp: number | undefined): string {
		if (!timestamp) return '';
		return new Date(timestamp).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Winner App - Prize Pickup Scanner</title>
</svelte:head>

<div class="scanner-page" class:dark={darkMode}>
	<!-- Header -->
	<header class="scanner-header d-flex justify-content-between align-items-center px-3 py-2">
		<div class="d-flex align-items-center gap-2">
			<h1 class="h6 mb-0 text-white">Prize Pickup Scanner</h1>
			{#if operatorName}
				<span class="badge bg-light text-dark">{operatorName}</span>
			{/if}
		</div>
		<div class="d-flex gap-2">
			<button
				class="header-btn"
				aria-label="Change operator"
				onclick={() => {
					operatorInput = operatorName;
					showOperatorModal = true;
				}}
			>
				<i class="bi bi-person"></i>
			</button>
			<button class="header-btn" aria-label="Toggle theme" onclick={toggleTheme}>
				<i class="bi bi-{darkMode ? 'sun' : 'moon'}"></i>
			</button>
			<a href="/" class="header-btn" aria-label="Return to home">
				<i class="bi bi-house"></i>
			</a>
		</div>
	</header>

	<div class="scanner-container">
		<!-- Scanner View -->
		{#if view === 'scanner'}
			<div class="scanner-section">
				<div class="qr-video-container mb-3">
					<!-- svelte-ignore element_invalid_self_closing_tag -->
					<video bind:this={videoElement} id="qr-video" playsinline></video>
				</div>

				<div class="scanner-controls">
					{#if !isScanning}
						<button class="btn btn-primary btn-lg" onclick={startScanning}>
							<i class="bi bi-qr-code-scan me-2"></i>
							Start Scanner
						</button>
					{:else}
						<button class="btn btn-secondary btn-lg" onclick={stopScanning}>
							<i class="bi bi-stop-fill me-2"></i>
							Stop Scanner
						</button>
					{/if}
				</div>

				<p class="scan-status mt-3">{scanStatus}</p>

				<!-- Manual Search -->
				<div class="card mt-4">
					<div class="card-body">
						<h6 class="card-title">Manual Search</h6>
						<div class="input-group">
							<input
								type="text"
								class="form-control"
								placeholder="Enter ticket code or name..."
								bind:value={searchInput}
								onkeypress={(e) => e.key === 'Enter' && performSearch()}
							/>
							<button class="btn btn-primary" aria-label="Search" onclick={performSearch}>
								<i class="bi bi-search"></i>
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Search Results View -->
		{#if view === 'results'}
			<div class="results-section">
				<div class="d-flex justify-content-between align-items-center mb-3">
					<h5>
						{#if isFamilySearch}
							Family Members for {scannedIdCard}
						{:else}
							Search Results ({searchResults.length})
						{/if}
					</h5>
					<button class="btn btn-outline-secondary" onclick={backToScanner}>
						<i class="bi bi-arrow-left"></i> Back
					</button>
				</div>

				<div class="list-group">
					{#each searchResults as result}
						<button
							class="list-group-item list-group-item-action"
							onclick={() => selectResult(result)}
						>
							<div class="d-flex justify-content-between align-items-center">
								<div>
									<h6 class="mb-1">{result.displayName}</h6>
									<small class="text-muted">{result.prize}</small>
								</div>
								{#if result.pickedUp}
									<span class="badge bg-success">Picked Up</span>
								{:else}
									<span class="badge bg-warning text-dark">Pending</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Winner Detail View -->
		{#if view === 'winner' && selectedWinner}
			<div class="winner-section">
				<div class="d-flex justify-content-between align-items-center mb-3">
					<h5>Winner Details</h5>
					<button class="btn btn-outline-secondary" onclick={backToScanner}>
						<i class="bi bi-arrow-left"></i> Back
					</button>
				</div>

				<div class="card winner-card">
					<div class="card-body text-center">
						<h3 class="winner-name">{selectedWinner.displayName}</h3>
						<div class="winner-meta text-muted mb-3">
							{#if selectedWinner.entryId}
								<span><i class="bi bi-qr-code me-1"></i>{selectedWinner.entryId}</span>
							{/if}
						</div>

						<h6 class="mt-4 mb-3">Prizes ({winnerPrizes.length})</h6>
						<div class="prizes-list">
							{#each winnerPrizes as prize}
								<div class="prize-card" class:picked-up={prize.pickedUp}>
									<div class="d-flex justify-content-between align-items-start">
										<div>
											<h6 class="mb-1">{prize.prize}</h6>
											<small class="text-muted">Won: {formatDate(prize.timestamp)}</small>
											{#if prize.pickedUp}
												<small class="d-block text-success">
													<i class="bi bi-check-circle me-1"></i>
													Picked up: {formatDate(prize.pickupTimestamp)}
												</small>
											{/if}
										</div>
										<div>
											{#if prize.pickedUp}
												<span class="badge bg-success">Picked Up</span>
											{:else}
												<button
													class="btn btn-primary btn-sm"
													onclick={() => markPickedUp(prize)}
												>
													<i class="bi bi-check-lg me-1"></i>
													Mark Picked Up
												</button>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Alert Modal - No Winner Found -->
	{#if showAlert}
		<div
			class="alert-overlay"
			role="button"
			tabindex="0"
			aria-label="Close alert"
			onclick={(e) => e.target === e.currentTarget && (showAlert = false)}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showAlert = false)}
		>
			<div class="alert-modal">
				<div class="alert-icon alert-icon-error">
					<i class="bi bi-x-lg"></i>
				</div>
				<h4 class="alert-title">No Winner Found</h4>
				<p class="alert-message">This ticket code is not in the winner database.</p>
				<div class="alert-code">{alertTicketCode}</div>
				<button class="btn btn-primary" onclick={() => (showAlert = false)}>OK</button>
			</div>
		</div>
	{/if}

	<!-- No Results Modal -->
	{#if showNoResultsModal}
		<div
			class="alert-overlay"
			role="button"
			tabindex="0"
			aria-label="Close alert"
			onclick={(e) => e.target === e.currentTarget && (showNoResultsModal = false)}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showNoResultsModal = false)}
		>
			<div class="alert-modal">
				<div class="alert-icon alert-icon-search">
					<i class="bi bi-search"></i>
				</div>
				<h4 class="alert-title">No Results</h4>
				<p class="alert-message">No winners found matching your search.</p>
				<button class="btn btn-primary" onclick={() => (showNoResultsModal = false)}>OK</button>
			</div>
		</div>
	{/if}

	<!-- Operator Modal -->
	{#if showOperatorModal}
		<div class="alert-overlay">
			<div class="alert-modal">
				<div class="alert-icon alert-icon-info">
					<i class="bi bi-person"></i>
				</div>
				<h4 class="alert-title">Set Operator Name</h4>
				<p class="alert-message">Enter your name to track pickups.</p>
				<div class="mb-3">
					<input
						type="text"
						class="form-control"
						placeholder="Your name..."
						bind:value={operatorInput}
						onkeypress={(e) => e.key === 'Enter' && setOperatorName()}
					/>
				</div>
				<button class="btn btn-primary" onclick={setOperatorName} disabled={!operatorInput.trim()}>
					Save
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.scanner-page {
		min-height: 100vh;
		background: #f8f9fa;
	}

	.scanner-page.dark {
		background: #1a1a1a;
		color: #fff;
	}

	.scanner-header {
		background: linear-gradient(135deg, #0a4f7b 0%, #5fa1f7 100%);
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.header-btn {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}

	.header-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		color: white;
	}

	.scanner-container {
		max-width: 600px;
		margin: 0 auto;
		padding: 1rem;
	}

	.qr-video-container {
		position: relative;
		width: 100%;
		max-width: 400px;
		aspect-ratio: 1;
		margin: 0 auto;
		border-radius: 20px;
		overflow: hidden;
		background: #000;
	}

	#qr-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.scanner-controls {
		text-align: center;
	}

	.scan-status {
		text-align: center;
		color: #666;
	}

	.winner-card {
		border-radius: 15px;
	}

	.winner-name {
		color: #0a4f7b;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.prizes-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.prize-card {
		background: #f8f9fa;
		border-radius: 10px;
		padding: 1rem;
		text-align: left;
	}

	.prize-card.picked-up {
		background: #e8f5e9;
		border: 1px solid #4caf50;
	}

	.alert-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	.alert-modal {
		background: white;
		border-radius: 20px;
		padding: 2rem;
		max-width: 400px;
		width: 90%;
		text-align: center;
	}

	.alert-icon {
		width: 80px;
		height: 80px;
		margin: 0 auto 1.5rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.alert-icon i {
		font-size: 2rem;
		color: white;
	}

	.alert-icon-error {
		background: linear-gradient(135deg, #ff6b6b, #ee5a24);
	}

	.alert-icon-info {
		background: linear-gradient(135deg, #0a4f7b, #5fa1f7);
	}

	.alert-icon-search {
		background: linear-gradient(135deg, #6c757d, #adb5bd);
	}

	.alert-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.75rem;
	}

	.alert-code {
		font-family: monospace;
		background: #f8f9fa;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	/* Dark mode */
	.dark .card {
		background: #2d2d2d;
		color: #fff;
		border-color: #444;
	}

	.dark .winner-name {
		color: #5fa1f7;
	}

	.dark .prize-card {
		background: #3d3d3d;
	}

	.dark .prize-card.picked-up {
		background: #2e4a2e;
	}

	.dark .form-control {
		background: #3d3d3d;
		border-color: #555;
		color: #fff;
	}

	.dark .alert-modal {
		background: #2d2d2d;
		color: #fff;
	}

	.dark .alert-code {
		background: #3d3d3d;
	}
</style>
