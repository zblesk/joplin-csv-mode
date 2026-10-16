// Tab can't be typed into a text field, so accept `\t` or `tab` as a spelling of it.
export function resolveDelimiter(raw: string): string
{
	const lowered = raw.trim().toLowerCase();
	if (lowered === '\\t' || lowered === 'tab')
	{
		return '\t';
	}
	// Multi-character values can't be matched by the parser (e.g. from the global setting); use the first character.
	return raw.length > 1 ? raw[0] : raw;
}

// Only a single character, or one of the tab spellings above, is a usable delimiter.
export function isValidDelimiter(raw: string): boolean
{
	const lowered = raw.trim().toLowerCase();
	return raw.length === 1 || lowered === '\\t' || lowered === 'tab';
}

// Removes a leading `---` ... `---` (or `...`) block, if the body starts with one.
export function stripFrontmatter(body: string): string
{
	const match = /^﻿?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(body);
	return match ? body.slice(match[0].length) : body;
}

export function skipLines(body: string, count: number): string
{
	let pos = 0;
	for (let i = 0; i < count && pos < body.length; i++)
	{
		const next = body.indexOf('\n', pos);
		pos = next === -1 ? body.length : next + 1;
	}
	return body.slice(pos);
}
