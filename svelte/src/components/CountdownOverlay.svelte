<script lang="ts">
	import { settingsStore } from '$stores/settings.svelte';

	interface Props {
		progress: number; // 0 to 1
		duration: number; // seconds
	}

	let { progress, duration }: Props = $props();

	const visualType = $derived(settingsStore.delayVisualType);
	const remainingSeconds = $derived(Math.ceil((1 - progress) * duration));
	const circumference = 2 * Math.PI * 90; // Circle radius 90
	const strokeOffset = $derived(circumference - progress * circumference);
</script>

<div class="countdown-overlay">
	{#if visualType === 'countdown'}
		<div class="countdown-circle">
			<svg viewBox="0 0 200 200">
				<!-- Background circle -->
				<circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="8" />
				<!-- Progress circle -->
				<circle
					cx="100"
					cy="100"
					r="90"
					fill="none"
					stroke="var(--selection-color, #10b981)"
					stroke-width="8"
					stroke-linecap="round"
					stroke-dasharray={circumference}
					stroke-dashoffset={strokeOffset}
					transform="rotate(-90 100 100)"
					class="progress-circle"
				/>
			</svg>
			<div class="countdown-number">
				{remainingSeconds}
			</div>
		</div>
		<p class="countdown-text">Get Ready!</p>
	{:else if visualType === 'animation' || visualType === 'swirl-animation'}
		<div class="animation-container">
			<div class="spinner-ring"></div>
			<div class="spinner-ring delay-1"></div>
			<div class="spinner-ring delay-2"></div>
		</div>
		<p class="countdown-text">Selecting Winners...</p>
	{:else if visualType === 'christmas-snow'}
		<div class="snow-container">
			{#each Array(20) as _, i}
				<div class="snowflake" style="--delay: {i * 0.3}s; --left: {Math.random() * 100}%;">
					<i class="bi bi-snow2"></i>
				</div>
			{/each}
		</div>
		<p class="countdown-text">Ho Ho Ho!</p>
	{:else}
		<!-- No visual (none) - just show a subtle indicator -->
		<div class="subtle-indicator">
			<div class="pulse-dot"></div>
		</div>
	{/if}
</div>

<style>
	.countdown-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(135deg, var(--color-primary, #6366f1) 0%, var(--color-secondary, #8b5cf6) 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	.countdown-circle {
		position: relative;
		width: 200px;
		height: 200px;
	}

	.countdown-circle svg {
		width: 100%;
		height: 100%;
	}

	.progress-circle {
		transition: stroke-dashoffset 0.1s linear;
	}

	.countdown-number {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 4rem;
		font-weight: 700;
		color: white;
	}

	.countdown-text {
		margin-top: 2rem;
		font-size: 1.5rem;
		color: white;
		opacity: 0.9;
	}

	/* Animation container */
	.animation-container {
		position: relative;
		width: 150px;
		height: 150px;
	}

	.spinner-ring {
		position: absolute;
		inset: 0;
		border: 4px solid transparent;
		border-top-color: var(--selection-color, #10b981);
		border-radius: 50%;
		animation: spin 1.2s linear infinite;
	}

	.spinner-ring.delay-1 {
		inset: 15px;
		border-top-color: rgba(255, 255, 255, 0.5);
		animation-delay: 0.15s;
		animation-direction: reverse;
	}

	.spinner-ring.delay-2 {
		inset: 30px;
		border-top-color: rgba(255, 255, 255, 0.3);
		animation-delay: 0.3s;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Snow container */
	.snow-container {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	.snowflake {
		position: absolute;
		top: -50px;
		left: var(--left);
		font-size: 1.5rem;
		color: white;
		opacity: 0.8;
		animation: fall 4s linear infinite;
		animation-delay: var(--delay);
	}

	@keyframes fall {
		to {
			transform: translateY(calc(100vh + 100px)) rotate(360deg);
		}
	}

	/* Subtle indicator */
	.subtle-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pulse-dot {
		width: 20px;
		height: 20px;
		background: var(--selection-color, #10b981);
		border-radius: 50%;
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.5);
			opacity: 0.5;
		}
	}
</style>
