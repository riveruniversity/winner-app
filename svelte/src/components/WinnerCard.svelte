<script lang="ts">
	import type { Winner } from '$types';
	import { settingsStore } from '$stores/settings.svelte';

	interface Props {
		winner: Winner;
		index?: number;
		showActions?: boolean;
		onTogglePickup?: (winner: Winner) => void;
	}

	let { winner, index = 0, showActions = false, onTogglePickup }: Props = $props();

	const effect = $derived(settingsStore.displayEffect);

	// Get info fields from winner data if configured
	const info1 = $derived(winner.data?.info1 as string | undefined);
	const info2 = $derived(winner.data?.info2 as string | undefined);
	const info3 = $derived(winner.data?.info3 as string | undefined);
</script>

<div
	class="winner-card"
	class:animate-fade-in={effect === 'fade-in'}
	class:animate-slide-up={effect === 'slide-up'}
	class:animate-scale-in={effect === 'scale-in'}
	style="--animation-delay: {index * 0.1}s"
>
	<div class="winner-content">
		<div class="winner-badge">
			<i class="bi bi-trophy-fill"></i>
		</div>
		<h3 class="winner-name">{winner.displayName}</h3>
		<div class="winner-prize">{winner.prize}</div>
		{#if info1 || info2 || info3}
			<div class="winner-info">
				{#if info1}<span class="info-item">{info1}</span>{/if}
				{#if info2}<span class="info-item">{info2}</span>{/if}
				{#if info3}<span class="info-item">{info3}</span>{/if}
			</div>
		{/if}
		{#if showActions}
			<div class="winner-actions">
				<button
					class="btn btn-sm"
					class:btn-success={!winner.pickedUp}
					class:btn-outline-secondary={winner.pickedUp}
					onclick={() => onTogglePickup?.(winner)}
				>
					{#if winner.pickedUp}
						<i class="bi bi-check-circle-fill me-1"></i>Picked Up
					{:else}
						<i class="bi bi-hand-index me-1"></i>Mark Picked Up
					{/if}
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.winner-card {
		background: var(--selection-color, #10b981);
		border-radius: 1rem;
		padding: 1.5rem;
		text-align: center;
		color: white;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		animation-fill-mode: both;
		animation-duration: 0.5s;
		animation-delay: var(--animation-delay, 0s);
	}

	.winner-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.winner-badge {
		width: 48px;
		height: 48px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
	}

	.winner-name {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
		word-break: break-word;
	}

	.winner-prize {
		font-size: 1rem;
		opacity: 0.9;
		background: rgba(255, 255, 255, 0.15);
		padding: 0.25rem 0.75rem;
		border-radius: 2rem;
	}

	.winner-info {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
		font-size: 0.875rem;
		opacity: 0.85;
	}

	.info-item {
		background: rgba(255, 255, 255, 0.1);
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
	}

	.winner-actions {
		margin-top: 0.5rem;
	}

	/* Animation classes */
	.animate-fade-in {
		animation-name: fadeIn;
	}

	.animate-slide-up {
		animation-name: slideUp;
	}

	.animate-scale-in {
		animation-name: scaleIn;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes scaleIn {
		from {
			opacity: 0;
			transform: scale(0.8);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
