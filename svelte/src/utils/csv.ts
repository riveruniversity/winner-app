/**
 * CSV Parsing Utilities
 * Ported from src/js/modules/csv-parser.js
 */

export interface ParsedCSV {
	data: Record<string, string>[];
	errors: string[];
}

/**
 * Capitalize a string
 */
function capitalize(str: string): string {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a key to camelCase
 */
function camelize(key: string): string {
	const prefix = key.match(/^_{1,2}/)?.[0] || '';
	const keyWithoutPrefix = key.slice(prefix.length);

	if (keyWithoutPrefix === '' || keyWithoutPrefix.match(/^\|+$/)) {
		return prefix;
	}

	const cleaned = keyWithoutPrefix
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^\p{Alphabetic}\p{Number}]+/gu, '|')
		.replace(/(?<=[a-z0-9])([A-Z][A-Za-z]*[A-Za-z]\b)/, (str) => '|' + str)
		.toLowerCase();

	const camelizedKey = cleaned
		.split('|')
		.filter(Boolean)
		.map((part, i) => (i === 0 ? part : capitalize(part)))
		.join('');

	return prefix + camelizedKey;
}

/**
 * Transform object keys to camelCase
 */
function camelizeObj(obj: Record<string, unknown>): Record<string, string> {
	return Object.entries(obj).reduce(
		(acc, [key, value]) => {
			const newKey = camelize(key);
			acc[newKey] = String(value ?? '');
			return acc;
		},
		{} as Record<string, string>
	);
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const nextChar = line[i + 1];

		if (char === '"') {
			if (inQuotes && nextChar === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			result.push(current);
			current = '';
		} else {
			current += char;
		}
	}

	result.push(current);
	return result;
}

/**
 * Parse CSV text into structured data
 */
export function parseCSV(csvText: string): ParsedCSV {
	const lines = csvText.split('\n').filter((line) => line.trim());

	if (lines.length === 0) {
		return { data: [], errors: ['Empty file'] };
	}

	const headers = parseCSVLine(lines[0]);
	const data: Record<string, string>[] = [];
	const errors: string[] = [];

	for (let i = 1; i < lines.length; i++) {
		try {
			const values = parseCSVLine(lines[i]);
			if (values.length > 0) {
				const row: Record<string, unknown> = {};
				headers.forEach((header, index) => {
					row[header.trim()] = values[index]?.trim() || '';
				});
				data.push(camelizeObj(row));
			}
		} catch (error) {
			errors.push(`Line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	return { data, errors };
}

/**
 * Detect the best name template from CSV headers
 */
export function detectNameTemplate(headers: string[], firstRow: Record<string, string>): string {
	const normalizedHeaders: Record<string, string> = {};
	headers.forEach((header) => {
		normalizedHeaders[header.toLowerCase().replace(/[^a-z0-9]/g, '')] = header;
	});

	// Priority 1: firstName and lastName fields
	const firstNameVariants = ['firstname', 'first_name', 'fname', 'givenname', 'given_name', 'first'];
	const lastNameVariants = ['lastname', 'last_name', 'lname', 'surname', 'familyname', 'family_name', 'last'];

	let firstNameField: string | null = null;
	let lastNameField: string | null = null;

	for (const variant of firstNameVariants) {
		const normalized = variant.replace(/[^a-z0-9]/g, '');
		if (normalizedHeaders[normalized]) {
			firstNameField = normalizedHeaders[normalized];
			break;
		}
	}

	for (const variant of lastNameVariants) {
		const normalized = variant.replace(/[^a-z0-9]/g, '');
		if (normalizedHeaders[normalized]) {
			lastNameField = normalizedHeaders[normalized];
			break;
		}
	}

	if (firstNameField && lastNameField) {
		return `{${firstNameField}} {${lastNameField}}`;
	}

	// Priority 2: fullName or name field
	const fullNameVariants = [
		'fullname',
		'full_name',
		'name',
		'displayname',
		'display_name',
		'contactname',
		'contact_name'
	];

	for (const variant of fullNameVariants) {
		const normalized = variant.replace(/[^a-z0-9]/g, '');
		if (normalizedHeaders[normalized]) {
			return `{${normalizedHeaders[normalized]}}`;
		}
	}

	// Priority 3: Any field containing "name"
	for (const header of headers) {
		if (header.toLowerCase().includes('name')) {
			return `{${header}}`;
		}
	}

	// Priority 4: Email field
	const emailVariants = ['email', 'emailaddress', 'email_address', 'mail'];
	for (const variant of emailVariants) {
		const normalized = variant.replace(/[^a-z0-9]/g, '');
		if (normalizedHeaders[normalized]) {
			return `{${normalizedHeaders[normalized]}}`;
		}
	}

	// Fallback: Use first columns
	if (headers.length > 2) {
		return `{${headers[1]}} {${headers[2]}}`;
	} else if (headers.length > 0) {
		return `{${headers[0]}}`;
	}

	return '';
}

/**
 * Detect the best ID column from headers
 */
export function detectIdColumn(headers: string[]): string | null {
	const idFallbackChain = [
		'idCard',
		'contactId',
		'ticketCode',
		'userId',
		'personId',
		'participantId',
		'id',
		'code',
		'number',
		'barcode',
		'qrCode',
		'identifier'
	];

	for (const fallbackName of idFallbackChain) {
		const matchingHeader = headers.find((h) => h.toLowerCase() === fallbackName.toLowerCase());
		if (matchingHeader) {
			return matchingHeader;
		}
	}

	return null;
}

/**
 * Apply a template with placeholders to a data row
 */
export function applyTemplate(template: string, row: Record<string, string>): string {
	return template.replace(/\{([^}]+)\}/g, (match, key) => {
		return row[key.trim()] || '';
	});
}

/**
 * Validate that a column has unique, non-empty values
 */
export function validateColumnIds(
	data: Record<string, string>[],
	columnName: string
): { isValid: boolean; error?: string } {
	const ids: string[] = [];
	const duplicates: { value: string; row: number }[] = [];
	const emptyValues: number[] = [];

	for (let i = 0; i < data.length; i++) {
		const value = data[i][columnName];
		const rowNum = i + 1;

		if (!value || value.trim() === '') {
			emptyValues.push(rowNum);
			continue;
		}

		const trimmedValue = value.trim();

		if (ids.includes(trimmedValue)) {
			duplicates.push({ value: trimmedValue, row: rowNum });
		} else {
			ids.push(trimmedValue);
		}
	}

	if (emptyValues.length > 0) {
		return {
			isValid: false,
			error: `Empty ID values found in rows: ${emptyValues.slice(0, 5).join(', ')}${emptyValues.length > 5 ? ` and ${emptyValues.length - 5} more` : ''}`
		};
	}

	if (duplicates.length > 0) {
		const duplicateList = duplicates
			.slice(0, 3)
			.map((d) => `"${d.value}" (row ${d.row})`)
			.join(', ');
		return {
			isValid: false,
			error: `Duplicate ID values found: ${duplicateList}${duplicates.length > 3 ? ` and ${duplicates.length - 3} more` : ''}`
		};
	}

	return { isValid: true };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
	return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
