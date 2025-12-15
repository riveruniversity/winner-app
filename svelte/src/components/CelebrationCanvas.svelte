<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { settingsStore } from '$stores/settings.svelte';

	interface Props {
		id?: string;
	}

	let { id = 'animationCanvas' }: Props = $props();

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let ctx: CanvasRenderingContext2D | null = null;
	let animationFrameId: number | null = null;
	let confettiPieces: ConfettiPiece[] = [];
	let coinParticles: CoinParticle[] = [];

	// Convert hex color to RGB
	function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result
			? {
					r: parseInt(result[1], 16),
					g: parseInt(result[2], 16),
					b: parseInt(result[3], 16)
				}
			: null;
	}

	// Confetti piece class
	class ConfettiPiece {
		x: number;
		y: number;
		vx: number;
		vy: number;
		width: number;
		height: number;
		color: { r: number; g: number; b: number };
		rotation: number;
		rotationSpeed: number;
		gravity: number;
		life: number;

		constructor(canvasWidth: number) {
			const primaryRgb = hexToRgb(settingsStore.primaryColor) || { r: 99, g: 102, b: 241 };
			const secondaryRgb = hexToRgb(settingsStore.secondaryColor) || {
				r: 244,
				g: 63,
				b: 94
			};
			const colors = [
				primaryRgb,
				secondaryRgb,
				{ r: 255, g: 215, b: 0 }, // Gold
				{ r: 255, g: 20, b: 147 }, // Pink
				{ r: 50, g: 205, b: 50 } // Lime
			];

			this.x = Math.random() * canvasWidth;
			this.y = -10;
			this.vx = (Math.random() - 0.5) * 4;
			this.vy = Math.random() * 3 + 2;
			this.width = Math.random() * 8 + 4;
			this.height = Math.random() * 8 + 4;
			this.color = colors[Math.floor(Math.random() * colors.length)];
			this.rotation = Math.random() * Math.PI * 2;
			this.rotationSpeed = (Math.random() - 0.5) * 0.3;
			this.gravity = 0.05;
			this.life = 200;
		}

		update(): void {
			this.x += this.vx;
			this.y += this.vy;
			this.vy += this.gravity;
			this.rotation += this.rotationSpeed;
			this.life--;

			// Slight air resistance
			this.vx *= 0.999;
			this.vy *= 0.999;
		}

		draw(ctx: CanvasRenderingContext2D): void {
			ctx.save();
			ctx.translate(this.x, this.y);
			ctx.rotate(this.rotation);
			ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${Math.max(0, this.life / 200)})`;
			ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
			ctx.restore();
		}
	}

	// Coin particle class
	class CoinParticle {
		x: number;
		y: number;
		vx: number;
		vy: number;
		gravity: number;
		size: number;
		rotation: number;
		rotationSpeed: number;
		life: number;
		maxLife: number;
		bounce: number;
		canvasHeight: number;
		canvasWidth: number;

		constructor(x: number, y: number, canvasWidth: number, canvasHeight: number) {
			this.x = x;
			this.y = y;
			this.canvasWidth = canvasWidth;
			this.canvasHeight = canvasHeight;
			this.vx = (Math.random() - 0.5) * 8;
			this.vy = -Math.random() * 8 - 3;
			this.gravity = 0.3;
			this.size = Math.random() * 8 + 6;
			this.rotation = 0;
			this.rotationSpeed = (Math.random() - 0.5) * 0.3;
			this.life = 120;
			this.maxLife = 120;
			this.bounce = 0.6;
		}

		update(): void {
			this.x += this.vx;
			this.y += this.vy;
			this.vy += this.gravity;
			this.rotation += this.rotationSpeed;
			this.life--;

			// Bounce off screen edges
			if (this.x < 0 || this.x > this.canvasWidth) {
				this.vx *= -this.bounce;
				this.x = Math.max(0, Math.min(this.canvasWidth, this.x));
			}

			// Bounce off ground
			if (this.y > this.canvasHeight - this.size) {
				this.vy *= -this.bounce;
				this.y = this.canvasHeight - this.size;
				this.vx *= 0.8; // Friction
			}
		}

		draw(ctx: CanvasRenderingContext2D): void {
			const opacity = Math.max(0, this.life / this.maxLife);

			ctx.save();
			ctx.translate(this.x, this.y);
			ctx.rotate(this.rotation);
			ctx.globalAlpha = opacity;

			// Draw golden coin
			ctx.beginPath();
			ctx.arc(0, 0, this.size, 0, Math.PI * 2);
			ctx.fillStyle = '#FFD700'; // Gold
			ctx.fill();
			ctx.strokeStyle = '#FFA500'; // Orange border
			ctx.lineWidth = 2;
			ctx.stroke();

			// Shine effect
			ctx.beginPath();
			ctx.arc(-this.size * 0.3, -this.size * 0.3, this.size * 0.3, 0, Math.PI * 2);
			ctx.fillStyle = '#FFFF99'; // Light gold
			ctx.fill();

			ctx.restore();
		}
	}

	// Animation loop
	function animate(): void {
		if (!canvasEl || !ctx) return;

		ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

		// Update and draw confetti
		for (let i = confettiPieces.length - 1; i >= 0; i--) {
			const piece = confettiPieces[i];
			piece.update();
			piece.draw(ctx);

			if (piece.y > canvasEl.height + 10 || piece.life <= 0) {
				confettiPieces.splice(i, 1);
			}
		}

		// Update and draw coins
		for (let i = coinParticles.length - 1; i >= 0; i--) {
			const coin = coinParticles[i];
			coin.update();
			coin.draw(ctx);

			if (coin.life <= 0) {
				coinParticles.splice(i, 1);
			}
		}

		// Continue animation if there are still particles
		if (confettiPieces.length > 0 || coinParticles.length > 0) {
			animationFrameId = requestAnimationFrame(animate);
		} else {
			animationFrameId = null;
		}
	}

	// Start animation if not already running
	function startAnimation(): void {
		if (!animationFrameId) {
			animate();
		}
	}

	// Resize canvas to match window
	function resizeCanvas(): void {
		if (canvasEl) {
			canvasEl.width = window.innerWidth;
			canvasEl.height = window.innerHeight;
		}
	}

	onMount(() => {
		if (browser && canvasEl) {
			ctx = canvasEl.getContext('2d');
			resizeCanvas();
			window.addEventListener('resize', resizeCanvas);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('resize', resizeCanvas);
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
		}
	});

	/**
	 * Start confetti animation
	 */
	export function startConfetti(): void {
		if (!canvasEl) return;

		// Create immediate burst
		for (let i = 0; i < 50; i++) {
			confettiPieces.push(new ConfettiPiece(canvasEl.width));
		}

		// Continue creating more over time
		for (let i = 0; i < 20; i++) {
			setTimeout(() => {
				if (canvasEl) {
					for (let j = 0; j < 10; j++) {
						confettiPieces.push(new ConfettiPiece(canvasEl.width));
					}
				}
			}, i * 100);
		}

		startAnimation();
	}

	/**
	 * Create coin burst at specific position
	 */
	export function createCoinBurst(x: number, y: number): void {
		if (!canvasEl) return;

		const numCoins = 8 + Math.floor(Math.random() * 5);

		for (let i = 0; i < numCoins; i++) {
			coinParticles.push(new CoinParticle(x, y, canvasEl.width, canvasEl.height));
		}

		startAnimation();
	}

	/**
	 * Clear all animations
	 */
	export function clearAll(): void {
		confettiPieces = [];
		coinParticles = [];

		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}

		if (ctx && canvasEl) {
			ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
		}
	}

	/**
	 * Trigger celebration based on effect type
	 */
	export function triggerCelebration(
		effect: 'confetti' | 'coins' | 'both' | 'none',
		coinPosition?: { x: number; y: number }
	): void {
		if (effect === 'none') return;

		if (effect === 'confetti' || effect === 'both') {
			startConfetti();
		}

		if ((effect === 'coins' || effect === 'both') && coinPosition) {
			createCoinBurst(coinPosition.x, coinPosition.y);
		}
	}
</script>

<canvas
	{id}
	bind:this={canvasEl}
	class="celebration-canvas"
	style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;"
></canvas>
