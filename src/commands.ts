import joplin from 'api';
import { MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import { isNoteCsv } from './noteConfig';
import { showCsvConfigDialog } from './configDialog';

export async function registerCommands()
{
	await joplin.commands.register({
		name: 'toggleCsvView',
		label: 'Toggle CSV view',
		iconName: 'fas fa-table',
		execute: showCsvConfigDialog,
	});

	await joplin.commands.register({
		name: 'markNoteAsCsv',
		label: 'Set up CSV mode for this note',
		iconName: 'fas fa-table',
		execute: showCsvConfigDialog,
	});

	await joplin.views.menuItems.create('markNoteAsCsvMenuItem', 'markNoteAsCsv', MenuItemLocation.Tools);

	await joplin.views.toolbarButtons.create(
		'toggleCsvViewButton',
		'toggleCsvView',
		ToolbarButtonLocation.NoteToolbar,
	);
}

// Joplin remembers the editor-plugin toggle globally, so a view switched off on
// another note stays off. Force it on whenever a CSV note is selected.
export async function registerActivation()
{
	const activateIfCsv = async () =>
	{
		const note = await joplin.workspace.selectedNote();
		if (note && await isNoteCsv(note.id))
		{
			await joplin.commands.execute('showEditorPlugin');
		}
	};
	await joplin.workspace.onNoteSelectionChange(activateIfCsv);
	await activateIfCsv();
}
