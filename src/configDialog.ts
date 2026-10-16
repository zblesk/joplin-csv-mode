import joplin from 'api';
import { ButtonSpec } from 'api/types';
import { isValidDelimiter } from './csvLogic';
import {
	isNoteCsv,
	getNoteDelimiter,
	getNoteEscape,
	getNoteSkipLines,
	getNoteSkipFrontmatter,
	getNoteRowSelectionEnabled,
	saveNoteConfig,
	clearNoteConfig,
} from './noteConfig';
import { refreshCsvView } from './editor';

let configDialog: string;

export async function initConfigDialog()
{
	configDialog = await joplin.views.dialogs.create('csvConfigDialog');
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Joplin only re-runs onActivationCheck when the selected note id changes, so
// opening the same note again does nothing. Bounce through a sibling note instead.
async function reselectNote(noteId: string, folderId: string)
{
	const siblings = await joplin.data.get(['folders', folderId, 'notes'], { fields: ['id'], limit: 5 });
	const other = (siblings.items as { id: string }[]).find(n => n.id !== noteId);
	if (!other)
	{
		console.log('csv-mode: reselectNote: no sibling note to bounce through');
		return;
	}
	await joplin.commands.execute('openNote', other.id);
	await joplin.commands.execute('openNote', noteId);
}

interface DialogState
{
	delimiter: string;
	escape: string;
	skipLines: number;
	skipFrontmatter: boolean;
	rowSelection: boolean;
	error: string;
}

function renderDialogHtml(state: DialogState): string
{
	return `
		<h3>CSV config</h3>
		${state.error ? `<p style="color: red;">${escapeHtml(state.error)}</p>` : ''}
		<form name="csvConfig">
			<p><label>Delimiter (one character, or \\t for tab)<br/><input type="text" name="delimiter" value="${escapeHtml(state.delimiter)}" maxlength="3" /></label></p>
			<p><label>String escape<br/><input type="text" name="escape" value="${escapeHtml(state.escape)}" maxlength="1" /></label></p>
			<p><label><input type="checkbox" name="skipFrontmatter" ${state.skipFrontmatter ? 'checked' : ''} /> Skip frontmatter</label></p>
			<p><label>Lines to skip at the beginning<br/><input type="number" name="skipLines" min="0" value="${state.skipLines}" /></label></p>
			<p><label><input type="checkbox" name="rowSelection" ${state.rowSelection ? 'checked' : ''} /> Enable row selection</label></p>
			<input type="submit" style="display: none;" />
		</form>
	`;
}

export async function showCsvConfigDialog()
{
	console.log('csv-mode: showCsvConfigDialog: called');
	try
	{
		await showCsvConfigDialogUnsafe();
	}
	catch (error)
	{
		console.error('csv-mode: showCsvConfigDialog failed', error);
	}
}

async function showCsvConfigDialogUnsafe()
{
	const note = await joplin.workspace.selectedNote();
	if (!note)
	{
		console.log('csv-mode: showCsvConfigDialog: no selected note');
		return;
	}

	const wasCsv = await isNoteCsv(note.id);
	let delimiter = await getNoteDelimiter(note.id);
	if (!isValidDelimiter(delimiter))
	{
		delimiter = delimiter[0] ?? ';';
	}
	if (delimiter === '\t')
	{
		delimiter = '\\t';
	}
	let escape = await getNoteEscape(note.id);
	let skipLinesCount = await getNoteSkipLines(note.id);
	let skipFrontmatter = await getNoteSkipFrontmatter(note.id);
	let rowSelection = await getNoteRowSelectionEnabled(note.id);
	console.log('csv-mode: showCsvConfigDialog: wasCsv=' + wasCsv);

	let buttons: ButtonSpec[] = []
	if (wasCsv)
	{
		buttons.push({ id: 'notCsv', title: 'This is not a CSV' });
	}
	buttons.push(
		{ id: 'ok', title: 'OK' },
		{ id: 'cancel', title: 'Cancel' },
	);

	let error = '';
	let result: { id: string, formData?: any };
	while (true)
	{
		await joplin.views.dialogs.setHtml(configDialog, renderDialogHtml({
			delimiter,
			escape,
			skipLines: skipLinesCount,
			skipFrontmatter,
			rowSelection,
			error,
		}));
		await joplin.views.dialogs.setButtons(configDialog, buttons);

		result = await joplin.views.dialogs.open(configDialog);
		console.log('csv-mode: showCsvConfigDialog: result ' + result.id);
		if (result.id !== 'ok')
		{
			break;
		}

		const submitted = result.formData?.csvConfig ?? {};
		delimiter = submitted.delimiter || delimiter;
		escape = submitted.escape || escape;
		const parsedSkip = parseInt(submitted.skipLines, 10);
		skipLinesCount = parsedSkip >= 0 ? parsedSkip : skipLinesCount;
		// Unchecked checkboxes may be missing from formData, so absence means false.
		skipFrontmatter = !!submitted.skipFrontmatter && submitted.skipFrontmatter !== 'off';
		rowSelection = !!submitted.rowSelection && submitted.rowSelection !== 'off';
		if (isValidDelimiter(delimiter))
		{
			break;
		}
		console.log('csv-mode: branch: invalid delimiter, re-showing dialog');
		error = 'The delimiter must be a single character, or \\t for tab.';
	}

	if (result.id === 'ok')
	{
		await saveNoteConfig(note.id, {
			delimiter,
			escape,
			skipLines: skipLinesCount,
			skipFrontmatter,
			rowSelection,
		});
		if (wasCsv)
		{
			console.log('csv-mode: branch: already CSV, refreshing view');
			await refreshCsvView(note.id);
		}
		else
		{
			console.log('csv-mode: branch: newly marked as CSV, re-opening note and showing editor plugin');
			await reselectNote(note.id, note.parent_id);
			await joplin.commands.execute('showEditorPlugin');
		}
	}
	else if (result.id === 'notCsv')
	{
		await clearNoteConfig(note.id);
		console.log('csv-mode: branch: unmarked as CSV, toggling editor off');
		await joplin.commands.execute('toggleEditorPlugin');
	}
	else
	{
		console.log('csv-mode: branch: dialog cancelled');
	}
}
