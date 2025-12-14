<script lang="ts">
	import type { Winner } from '$types';
	import { settingsStore } from '$stores/settings.svelte';
	import WinnerCard from './WinnerCard.svelte';

	interface Props {
		winners: Winner[];
		revealedCount?: number;
		showActions?: boolean;
		onTogglePickup?: (winner: Winner) => void;
	}

	let { winners, revealedCount = winners.length, showActions = false, onTogglePickup }: Props = $props();

	const visibleWinners = $derived(winners.slice(0, revealedCount));
	const stableGrid = $derived(settingsStore.stableGrid);
</script>

<div class="winners-grid" class:stable-grid={stableGrid}>
	{#if stableGrid}
		<!-- Stable grid shows placeholders for unrevealed winners -->
		{#each winners as winner, index (winner.winnerId)}
			<div class="winner-slot">
				{#if index < revealedCount}
					<WinnerCard {winner} {index} {showActions} {onTogglePickup} />
				{:else}
					<div class="winner-placeholder">
						<i class="bi bi-question-lg"></i>
					</div>
				{/if}
			</div>
		{/each}
	{:else}
		<!-- Dynamic grid only shows revealed winners -->
		{#each visibleWinners as winner, index (winner.winnerId)}
			<WinnerCard {winner} {index} {showActions} {onTogglePickup} />
		{/each}
	{/if}
</div>

<style>
	.winners-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		padding: 1rem;
	}

	.stable-grid {
		/* Fixed columns for stable layout */
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
	}

	.winner-slot {
		min-height: 180px;
	}

	.winner-placeholder {
		height: 100%;
		min-height: 180px;
		background: rgba(255, 255, 255, 0.1);
		border: 2px dashed rgba(255, 255, 255, 0.3);
		border-radius: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 3rem;
		color: rgba(255, 255, 255, 0.3);
	}

	/* Responsive adjustments */
	@container (max-width: 600px) {
		.winners-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
