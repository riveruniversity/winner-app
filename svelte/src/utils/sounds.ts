// ================================
// Sound Playback Utilities
// ================================

import { browser } from '$app/environment';

/**
 * Sound file metadata
 */
export interface SoundFile {
	id: string;
	name: string;
	filename: string;
	type: 'default' | 'custom' | 'uploaded';
}

/**
 * Available default sound files
 */
export const defaultSounds: Record<string, SoundFile> = {
	'drum-roll': {
		id: 'drum-roll',
		name: 'Drum Roll',
		filename: 'drum-roll.mp3',
		type: 'default'
	},
	applause: {
		id: 'applause',
		name: 'Applause',
		filename: 'applause.mp3',
		type: 'default'
	},
	'applause-winner': {
		id: 'applause-winner',
		name: 'Applause Winner',
		filename: 'applause-winner.mp3',
		type: 'default'
	},
	'electronic-build-up': {
		id: 'electronic-build-up',
		name: 'Electronic Build-up',
		filename: 'electronic_build-up.mp3',
		type: 'default'
	},
	'sting-rimshot-drum-roll': {
		id: 'sting-rimshot-drum-roll',
		name: 'Sting Rimshot',
		filename: 'sting-rimshot-drum-roll.mp3',
		type: 'default'
	},
	'tada-fanfare': {
		id: 'tada-fanfare',
		name: 'Tada Fanfare',
		filename: 'tada-fanfare.mp3',
		type: 'default'
	}
};

// Track currently playing audio for stopping
let currentAudio: HTMLAudioElement | null = null;

/**
 * Get URL for a sound file
 */
export function getSoundUrl(soundId: string): string | null {
	const sound = defaultSounds[soundId];
	if (!sound) return null;

	// Use relative path from static folder
	return `/sounds/${sound.filename}`;
}

/**
 * Get all available sounds
 */
export function getAvailableSounds(): SoundFile[] {
	return Object.values(defaultSounds);
}

/**
 * Play an MP3 sound by ID
 */
export function playMp3Sound(soundId: string): void {
	if (!browser) return;

	const soundUrl = getSoundUrl(soundId);
	if (!soundUrl) {
		console.warn('Sound not found:', soundId);
		return;
	}

	// Stop any currently playing audio
	stopCurrentAudio();

	const audio = new Audio(soundUrl);
	audio.volume = 0.7;
	currentAudio = audio;

	audio.play().catch((error) => {
		console.warn('Could not play MP3 sound:', error);
	});

	// Clear reference when audio ends
	audio.addEventListener('ended', () => {
		if (currentAudio === audio) {
			currentAudio = null;
		}
	});
}

/**
 * Stop currently playing audio
 */
export function stopCurrentAudio(): void {
	if (currentAudio) {
		currentAudio.pause();
		currentAudio.currentTime = 0;
		currentAudio = null;
	}
}

/**
 * Play a programmatic beep (for countdown)
 */
export function playBeep(frequency: number = 800, duration: number = 100): void {
	if (!browser) return;

	try {
		const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
		const audioContext = new AudioContext();
		const oscillator = audioContext.createOscillator();
		const gainNode = audioContext.createGain();

		oscillator.connect(gainNode);
		gainNode.connect(audioContext.destination);

		oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
		oscillator.type = 'sine';

		gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
		gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

		oscillator.start(audioContext.currentTime);
		oscillator.stop(audioContext.currentTime + duration / 1000);
	} catch (error) {
		console.warn('Could not play beep:', error);
	}
}

/**
 * Play sound by type (maps common types to sound IDs)
 */
export function playSound(type: string): void {
	if (!browser) return;

	try {
		if (type === 'countdown') {
			playBeep(800, 100);
		} else if (type === 'winner' || type === 'applause') {
			playMp3Sound('applause');
		} else if (type === 'drumroll-start' || type === 'drum-roll') {
			playMp3Sound('drum-roll');
		} else if (type === 'drumroll-stop') {
			stopCurrentAudio();
		} else if (type === 'final-beat' || type === 'sting-rimshot') {
			playMp3Sound('sting-rimshot-drum-roll');
		} else if (type === 'none') {
			// Do nothing for 'none'
			return;
		} else {
			// Handle custom sound IDs directly
			playMp3Sound(type);
		}
	} catch (error) {
		console.warn('Could not play sound:', error);
	}
}

/**
 * Test a sound (plays at full volume for testing in settings)
 */
export function testSound(soundId: string): void {
	if (!browser) return;

	if (soundId === 'none') return;

	const soundUrl = getSoundUrl(soundId);
	if (!soundUrl) {
		console.warn('Sound not found for test:', soundId);
		return;
	}

	// Stop any currently playing audio
	stopCurrentAudio();

	const audio = new Audio(soundUrl);
	audio.volume = 0.7;
	currentAudio = audio;

	audio.play().catch((error) => {
		console.warn('Could not play test sound:', error);
	});
}
