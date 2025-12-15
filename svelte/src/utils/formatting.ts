// ================================
// Display Name Formatting Utilities
// ================================

import type { ListEntry } from '$types';

/**
 * Format a display name for an entry based on a name configuration template.
 *
 * The nameConfig is a template string with placeholders like {field_name}
 * that get replaced with values from entry.data.
 *
 * Example:
 *   nameConfig = "{first_name} {last_name}"
 *   entry.data = { first_name: "John", last_name: "Doe" }
 *   result = "John Doe"
 *
 * @param entry - The list entry containing data
 * @param nameConfig - Template string with {field} placeholders
 * @returns Formatted display name string
 */
export function formatDisplayName(entry: ListEntry, nameConfig: string): string {
	// Template-based format (nameConfig is a string with {field} placeholders)
	if (typeof nameConfig === 'string' && nameConfig.trim()) {
		const formatted = nameConfig.replace(/\{([^}]+)\}/g, (_match, key) => {
			const value = entry.data[key.trim()];
			return value != null ? String(value) : '';
		}).trim();

		if (formatted) return formatted;
	}

	// Fallback: try common name fields
	const commonFields = ['name', 'full_name', 'first_name', 'last_name', 'Name', 'Full_Name', 'First_Name', 'Last_Name'];
	for (const field of commonFields) {
		if (entry.data[field]) {
			return String(entry.data[field]);
		}
	}

	// If no name fields found, use first available field
	const keys = Object.keys(entry.data);
	if (keys.length > 0) {
		const firstValue = entry.data[keys[0]];
		if (firstValue != null) {
			return String(firstValue);
		}
	}

	return 'Unknown';
}

/**
 * Format info fields for an entry based on info configuration.
 *
 * Similar to formatDisplayName but for additional info fields (info1, info2, info3).
 *
 * @param entry - The list entry containing data
 * @param infoConfig - Template string with {field} placeholders
 * @returns Formatted info string or empty string
 */
export function formatInfoField(entry: ListEntry, infoConfig: string | undefined): string {
	if (!infoConfig || typeof infoConfig !== 'string') return '';

	return infoConfig.replace(/\{([^}]+)\}/g, (_match, key) => {
		const value = entry.data[key.trim()];
		return value != null ? String(value) : '';
	}).trim();
}

/**
 * Format a date timestamp to a localized string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
	timestamp: number,
	options: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}
): string {
	return new Date(timestamp).toLocaleDateString(undefined, options);
}

/**
 * Format a date timestamp to a short date string (YYYY-MM-DD).
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateShort(timestamp: number): string {
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Format a date timestamp to a time string (HH:MM AM/PM).
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string
 */
export function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Format a number with commas for thousands separators.
 *
 * @param num - The number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
	return num.toLocaleString();
}

/**
 * Truncate a string to a maximum length with ellipsis.
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string with ellipsis if needed
 */
export function truncate(str: string, maxLength: number = 50): string {
	if (str.length <= maxLength) return str;
	return str.slice(0, maxLength - 3) + '...';
}

/**
 * Get initials from a name string.
 *
 * @param name - The full name
 * @param maxInitials - Maximum number of initials to return
 * @returns Uppercase initials
 */
export function getInitials(name: string, maxInitials: number = 2): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, maxInitials)
		.map((word) => word[0]?.toUpperCase() || '')
		.join('');
}

/**
 * Capitalize the first letter of each word.
 *
 * @param str - The string to title case
 * @returns Title cased string
 */
export function toTitleCase(str: string): string {
	return str
		.toLowerCase()
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
