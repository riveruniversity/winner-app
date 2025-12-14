<script lang="ts">
	import { dataStore } from '$stores/data.svelte';
	import { setupStore } from '$stores/setup.svelte';
	import { settingsStore } from '$stores/settings.svelte';

	function selectAllLists() {
		for (const list of dataStore.lists) {
			setupStore.selectList(list.listId);
		}
	}

	function clearAllLists() {
		setupStore.selectedListIds = [];
	}

	function handlePrizeChange(e: Event) {
		const target = e.currentTarget as HTMLSelectElement;
		setupStore.selectedPrizeId = target.value;
		setupStore.onPrizeChange();
	}

	function handleWinnersCountChange(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		setupStore.winnersCount = parseInt(target.value) || 1;
	}
</script>

<!-- Row 1: Quick Selection Setup -->
<div class="card">
	<div class="card-header">
		<h5 class="card-title mb-0"><i class="bi bi-gear-fill me-2"></i>Quick Selection Setup</h5>
	</div>
	<div class="card-body">
		<p class="card-text text-muted mb-4">Configure the next public winner selection from here.</p>

		<div class="row g-3">
			<!-- List Selection -->
			<div class="col-md-5">
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="form-label fw-semibold" id="lists-label">Select Lists</label>
				<div class="list-selection-container" role="group" aria-labelledby="lists-label">
					<div class="border rounded p-2" style="max-height: 200px; overflow-y: auto;">
						{#if dataStore.lists.length === 0}
							<p class="text-muted mb-0">No lists uploaded yet</p>
						{:else}
							{#each dataStore.lists as list (list.listId)}
								<div class="form-check">
									<input
										class="form-check-input"
										type="checkbox"
										id="list-{list.listId}"
										checked={setupStore.isListSelected(list.listId)}
										onchange={() => setupStore.toggleList(list.listId)}
									/>
									<label class="form-check-label" for="list-{list.listId}">
										{list.metadata.name}
										<span class="text-muted">({list.entries?.length || 0})</span>
									</label>
								</div>
							{/each}
						{/if}
					</div>
					<div class="d-flex justify-content-between align-items-center mt-2">
						<div class="list-selection-controls">
							<button type="button" class="btn btn-sm btn-outline-primary" onclick={selectAllLists}>
								Select All
							</button>
							<button
								type="button"
								class="btn btn-sm btn-outline-secondary"
								onclick={clearAllLists}
							>
								Clear All
							</button>
							<span class="ms-2 text-muted">{setupStore.validSelectedCount} selected</span>
						</div>
						<small class="text-muted">
							Eligible: {setupStore.eligibleEntries.toLocaleString()}{setupStore.excludedCount > 0
								? ` (${setupStore.excludedCount} excluded)`
								: ''}
						</small>
					</div>
				</div>
			</div>

			<!-- Prize Selection -->
			<div class="col-md-5">
				<label class="form-label fw-semibold" for="prize-select">Select Prize</label>
				<select
					id="prize-select"
					class="form-select form-select-lg"
					value={setupStore.selectedPrizeId}
					onchange={handlePrizeChange}
				>
					<option value="">Select Prize...</option>
					{#each dataStore.prizes as prize (prize.prizeId)}
						<option value={prize.prizeId}>
							{prize.name} ({prize.quantity} available)
						</option>
					{/each}
				</select>
			</div>

			<!-- Winners Count -->
			<div class="col-md-2">
				<label class="form-label fw-semibold" for="winners-count">Number of Winners</label>
				<input
					id="winners-count"
					type="number"
					class="form-control form-control-lg"
					min="1"
					max="9999"
					placeholder="Count"
					value={setupStore.winnersCount}
					onchange={handleWinnersCountChange}
					class:border-danger={setupStore.hasValidationWarning}
					class:text-danger={setupStore.hasValidationWarning}
				/>
				{#if setupStore.entriesExceeded}
					<small class="text-danger d-block mt-1">
						{setupStore.eligibleEntries === 0
							? 'No entries available'
							: `Only ${setupStore.eligibleEntries} entries available${setupStore.excludedCount > 0 ? ` (${setupStore.excludedCount} excluded)` : ''}`}
					</small>
				{:else if setupStore.prizeQuantityExceeded}
					<small class="text-danger d-block mt-1">
						Only {setupStore.selectedPrizeQuantity} prizes available
					</small>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Row 2: Reveal Settings | Delay Settings -->
<div class="row g-4 mt-3">
	<!-- Reveal Settings Card -->
	<div class="col-lg-6">
		<div class="card h-100">
			<div class="card-header">
				<h5 class="card-title mb-0">
					<i class="bi bi-eye-fill me-2"></i>Reveal Settings
				</h5>
			</div>
			<div class="card-body">
				<div class="mb-3">
					<label class="form-label fw-semibold" for="selection-mode">Selection Mode</label>
					<select
						id="selection-mode"
						class="form-select form-select-lg"
						value={settingsStore.selectionMode}
						onchange={(e) => (settingsStore.selectionMode = e.currentTarget.value as any)}
					>
						<option value="all-at-once">All at Once</option>
						<option value="sequential">Sequential Reveal</option>
						<option value="individual">Individual Selection</option>
					</select>
				</div>

				<div class="mb-3">
					<label class="form-label fw-semibold" for="display-effect">Display Effect</label>
					<select
						id="display-effect"
						class="form-select form-select-lg"
						value={settingsStore.displayEffect}
						onchange={(e) => (settingsStore.displayEffect = e.currentTarget.value as any)}
					>
						<option value="fade-in">Fade In</option>
						<option value="fly-in">Fly In</option>
						<option value="zoom-in">Zoom In</option>
						<option value="slide-in">Slide In</option>
						<option value="bounce-in">Bounce In</option>
					</select>
				</div>

				<div class="mb-3">
					<label class="form-label fw-semibold" for="time-between">Time Between Winners (seconds)</label>
					<input
						id="time-between"
						type="number"
						class="form-control form-control-lg"
						min="0.1"
						max="5"
						step="0.1"
						value={settingsStore.displayDuration}
						onchange={(e) => (settingsStore.displayDuration = parseFloat(e.currentTarget.value))}
					/>
				</div>

				{#if settingsStore.selectionMode === 'sequential' || settingsStore.selectionMode === 'individual'}
					<div class="mb-3">
						<div class="form-check form-switch">
							<input
								class="form-check-input"
								type="checkbox"
								id="stableGrid"
								checked={settingsStore.stableGrid}
								onchange={(e) => (settingsStore.stableGrid = e.currentTarget.checked)}
							/>
							<label class="form-check-label fw-semibold" for="stableGrid">
								Stable Grid
								<i
									class="bi bi-info-circle text-muted ms-1"
									title="Pre-position all cards to prevent grid shifting during reveal"
								></i>
							</label>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Delay Settings Card -->
	<div class="col-lg-6">
		<div class="card h-100">
			<div class="card-header">
				<h5 class="card-title mb-0">
					<i class="bi bi-clock-fill me-2"></i>Delay Settings
				</h5>
			</div>
			<div class="card-body">
				<div class="mb-3">
					<label class="form-label fw-semibold" for="delay-duration">Delay Duration (seconds)</label>
					<input
						id="delay-duration"
						type="number"
						class="form-control form-control-lg"
						min="0"
						max="30"
						step="0.5"
						value={settingsStore.preSelectionDelay}
						onchange={(e) =>
							(settingsStore.preSelectionDelay = parseFloat(e.currentTarget.value))}
					/>
				</div>

				<div class="mb-3">
					<label class="form-label fw-semibold" for="delay-visual">Delay Visual</label>
					<select
						id="delay-visual"
						class="form-select form-select-lg"
						value={settingsStore.delayVisualType}
						onchange={(e) => (settingsStore.delayVisualType = e.currentTarget.value as any)}
					>
						<option value="none">No Visual (Silent)</option>
						<option value="countdown">Countdown Timer</option>
						<option value="animation">Particle Animation</option>
						<option value="swirl-animation">Swirl Animation</option>
						<option value="christmas-snow">Christmas Snow</option>
						<option value="time-machine">Time Machine</option>
					</select>
				</div>

				<div>
					<button type="button" class="btn btn-outline-info" onclick={() => console.log('Preview delay')}>
						<i class="bi bi-eye me-1"></i>Preview Delay
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Row 3: Celebration Effects | Sound Settings -->
<div class="row g-4 mt-3">
	<!-- Celebration Effects Card -->
	<div class="col-lg-6">
		<div class="card h-100">
			<div class="card-header">
				<h5 class="card-title mb-0">
					<i class="bi bi-star-fill me-2"></i>Celebration Effects
				</h5>
			</div>
			<div class="card-body">
				<div class="mb-3">
					<label class="form-label fw-semibold" for="celebration-animation">Celebration Animation</label>
					<select
						id="celebration-animation"
						class="form-select form-select-lg"
						value={settingsStore.celebrationEffect}
						onchange={(e) => (settingsStore.celebrationEffect = e.currentTarget.value as any)}
					>
						<option value="none">No Animation</option>
						<option value="confetti">Confetti</option>
						<option value="coins">Gold Coins</option>
						<option value="both">Both Confetti & Coins</option>
					</select>
				</div>

				<div class="mb-3">
					<label class="form-label fw-semibold" for="animation-duration">Animation Duration (seconds)</label>
					<input
						id="animation-duration"
						type="number"
						class="form-control form-control-lg"
						min="1"
						max="10"
						step="0.5"
						value={settingsStore.celebrationDuration}
						onchange={(e) =>
							(settingsStore.celebrationDuration = parseFloat(e.currentTarget.value))}
					/>
				</div>

				<div class="mb-3">
					<div class="form-check">
						<input
							class="form-check-input"
							type="checkbox"
							id="celebrationAutoTrigger"
							checked={settingsStore.celebrationAutoTrigger}
							onchange={(e) => (settingsStore.celebrationAutoTrigger = e.currentTarget.checked)}
						/>
						<label class="form-check-label" for="celebrationAutoTrigger">
							Auto-trigger celebration when winners are revealed
						</label>
					</div>
				</div>

				<div>
					<button
						type="button"
						class="btn btn-sm btn-outline-secondary"
						onclick={() => console.log('Test celebration')}
					>
						<i class="bi bi-play-fill me-1"></i>Test Celebration
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Sound Settings Card -->
	<div class="col-lg-6">
		<div class="card h-100">
			<div class="card-header">
				<h5 class="card-title mb-0">
					<i class="bi bi-volume-up-fill me-2"></i>Sound Settings
				</h5>
			</div>
			<div class="card-body">
				<div class="mb-3">
					<label class="form-label fw-semibold" for="sound-during-delay">Sound During Delay</label>
					<div class="input-group">
						<select
							id="sound-during-delay"
							class="form-select form-select-lg"
							value={settingsStore.soundDuringDelay}
							onchange={(e) => (settingsStore.soundDuringDelay = e.currentTarget.value as any)}
						>
							<option value="none">No Sound</option>
							<option value="drumroll">Drumroll</option>
							<option value="suspense">Suspense</option>
							<option value="ticking">Ticking</option>
						</select>
						<button
							type="button"
							class="btn btn-outline-secondary"
							onclick={() => console.log('Test sound during delay')}
						>
							<i class="bi bi-play-fill"></i> Test
						</button>
					</div>
				</div>

				<div class="mb-3">
					<label class="form-label fw-semibold" for="sound-end-delay">Sound at End of Delay</label>
					<div class="input-group">
						<select
							id="sound-end-delay"
							class="form-select form-select-lg"
							value={settingsStore.soundEndOfDelay}
							onchange={(e) => (settingsStore.soundEndOfDelay = e.currentTarget.value as any)}
						>
							<option value="none">No Sound</option>
							<option value="ding">Ding</option>
							<option value="bell">Bell</option>
							<option value="gong">Gong</option>
						</select>
						<button
							type="button"
							class="btn btn-outline-secondary"
							onclick={() => console.log('Test sound end of delay')}
						>
							<i class="bi bi-play-fill"></i> Test
						</button>
					</div>
				</div>

				<div class="mb-3">
					<label class="form-label fw-semibold" for="sound-reveal">Sound During Reveal</label>
					<div class="input-group">
						<select
							id="sound-reveal"
							class="form-select form-select-lg"
							value={settingsStore.soundDuringReveal}
							onchange={(e) => (settingsStore.soundDuringReveal = e.currentTarget.value as any)}
						>
							<option value="none">No Sound</option>
							<option value="fanfare">Fanfare</option>
							<option value="applause">Applause</option>
							<option value="celebration">Celebration</option>
						</select>
						<button
							type="button"
							class="btn btn-outline-secondary"
							onclick={() => console.log('Test sound during reveal')}
						>
							<i class="bi bi-play-fill"></i> Test
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
