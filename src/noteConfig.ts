import joplin from 'api';
import { ModelType } from 'api/types';
import { USERDATA_IS_CSV, USERDATA_DELIMITER, USERDATA_ESCAPE, USERDATA_SKIP_LINES, USERDATA_SKIP_FRONTMATTER, USERDATA_ROW_SELECTION_ENABLED, SETTING_DEFAULT_SEPARATOR, SETTING_DEFAULT_STRING_ESCAPE, SETTING_DEFAULT_SKIP_LINES, SETTING_DEFAULT_SKIP_FRONTMATTER } from './settings';
import { stripFrontmatter, skipLines } from './csvLogic';

export interface NoteCsvConfig
{
	delimiter: string;
	escape: string;
	skipLines: number;
	skipFrontmatter: boolean;
	rowSelection: boolean;
}

export async function isNoteCsv(noteId: string): Promise<boolean>
{
	return !!(await joplin.data.userDataGet<boolean>(ModelType.Note, noteId, USERDATA_IS_CSV));
}

export async function getNoteDelimiter(noteId: string): Promise<string>
{
	const stored = await joplin.data.userDataGet<string>(ModelType.Note, noteId, USERDATA_DELIMITER);
	return stored || await joplin.settings.value(SETTING_DEFAULT_SEPARATOR);
}

export async function getNoteEscape(noteId: string): Promise<string>
{
	const stored = await joplin.data.userDataGet<string>(ModelType.Note, noteId, USERDATA_ESCAPE);
	return stored || await joplin.settings.value(SETTING_DEFAULT_STRING_ESCAPE);
}

export async function getNoteSkipLines(noteId: string): Promise<number>
{
	const stored = await joplin.data.userDataGet<number>(ModelType.Note, noteId, USERDATA_SKIP_LINES);
	return typeof stored === 'number' ? stored : await joplin.settings.value(SETTING_DEFAULT_SKIP_LINES);
}

export async function getNoteSkipFrontmatter(noteId: string): Promise<boolean>
{
	const stored = await joplin.data.userDataGet<boolean>(ModelType.Note, noteId, USERDATA_SKIP_FRONTMATTER);
	return typeof stored === 'boolean' ? stored : !!(await joplin.settings.value(SETTING_DEFAULT_SKIP_FRONTMATTER));
}

export async function getNoteRowSelectionEnabled(noteId: string): Promise<boolean>
{
	return !!(await joplin.data.userDataGet<boolean>(ModelType.Note, noteId, USERDATA_ROW_SELECTION_ENABLED));
}

export async function setNoteRowSelection(noteId: string, enabled: boolean): Promise<void>
{
	await joplin.data.userDataSet(ModelType.Note, noteId, USERDATA_ROW_SELECTION_ENABLED, enabled);
}

// Marks the note as CSV and stores its settings.
export async function saveNoteConfig(noteId: string, config: NoteCsvConfig): Promise<void>
{
	await joplin.data.userDataSet(ModelType.Note, noteId, USERDATA_DELIMITER, config.delimiter);
	await joplin.data.userDataSet(ModelType.Note, noteId, USERDATA_ESCAPE, config.escape);
	await joplin.data.userDataSet(ModelType.Note, noteId, USERDATA_SKIP_LINES, config.skipLines);
	await joplin.data.userDataSet(ModelType.Note, noteId, USERDATA_SKIP_FRONTMATTER, config.skipFrontmatter);
	await joplin.data.userDataSet(ModelType.Note, noteId, USERDATA_ROW_SELECTION_ENABLED, config.rowSelection);
	await joplin.data.userDataSet(ModelType.Note, noteId, USERDATA_IS_CSV, true);
}

// Removes the CSV mark and all per-note settings.
export async function clearNoteConfig(noteId: string): Promise<void>
{
	await joplin.data.userDataDelete(ModelType.Note, noteId, USERDATA_IS_CSV);
	await joplin.data.userDataDelete(ModelType.Note, noteId, USERDATA_DELIMITER);
	await joplin.data.userDataDelete(ModelType.Note, noteId, USERDATA_ESCAPE);
	await joplin.data.userDataDelete(ModelType.Note, noteId, USERDATA_SKIP_LINES);
	await joplin.data.userDataDelete(ModelType.Note, noteId, USERDATA_SKIP_FRONTMATTER);
	await joplin.data.userDataDelete(ModelType.Note, noteId, USERDATA_ROW_SELECTION_ENABLED);
}

// The part of the note body that is actual CSV data, after frontmatter and skipped lines.
export async function getCsvBody(noteId: string, body: string): Promise<string>
{
	if (await getNoteSkipFrontmatter(noteId))
	{
		body = stripFrontmatter(body);
	}
	return skipLines(body, await getNoteSkipLines(noteId));
}
