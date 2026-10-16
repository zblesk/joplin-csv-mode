import joplin from 'api';
import { EDITOR_VIEW_ID } from './settings';
import { resolveDelimiter } from './csvLogic';
import {
	isNoteCsv,
	getNoteDelimiter,
	getNoteEscape,
	getNoteRowSelectionEnabled,
	setNoteRowSelection,
	getCsvBody,
} from './noteConfig';

let refreshView: ((noteId: string) => Promise<void>) | null = null;

// Re-sends the note to the grid view; no-op until the editor view has been set up.
export async function refreshCsvView(noteId: string): Promise<void>
{
	if (refreshView)
	{
		await refreshView(noteId);
	}
}

export async function registerCsvEditor()
{
	const editors = joplin.views.editors;

	await editors.register(EDITOR_VIEW_ID, {
		onSetup: async (view) =>
		{
			console.log('csv-mode: onSetup called');
			await editors.setHtml(view, `
				<style>
					html, body { height: 100%; margin: 0; }
					#csv-grid-root { width: 100%; height: 100vh; }
				</style>
				<div id="csv-grid-root">Loading CSV view...</div>
			`);
			await editors.addScript(view, './webview/csvGridView.js');

			const sendNoteToWebview = async (noteId: string, body: string) =>
			{
				await editors.postMessage(view, {
					type: 'updateCsvFromNote',
					body: await getCsvBody(noteId, body),
					delimiter: resolveDelimiter(await getNoteDelimiter(noteId)),
					escape: await getNoteEscape(noteId),
					rowSelection: await getNoteRowSelectionEnabled(noteId),
					darkMode: await joplin.shouldUseDarkColors(),
				});
			};

			refreshView = async (noteId: string) =>
			{
				const note = await joplin.data.get(['notes', noteId], { fields: ['id', 'body'] });
				await sendNoteToWebview(note.id, note.body);
			};

			await editors.onUpdate(view, async (event) =>
			{
				console.log('csv-mode: onUpdate called, body length: ' + (event.newBody?.length ?? 0));
				await sendNoteToWebview(event.noteId, event.newBody);
			});

			await editors.onMessage(view, async (message: { type: string, enabled?: boolean }) =>
			{
				console.log('csv-mode: onMessage received: ' + message.type);
				if (message.type === 'setRowSelection')
				{
					const note = await joplin.workspace.selectedNote();
					if (note)
					{
						await setNoteRowSelection(note.id, !!message.enabled);
					}
				}
				else if (message.type === 'isReady')
				{
					const note = await joplin.workspace.selectedNote();
					if (note)
					{
						console.log('csv-mode: branch: note found, body length: ' + note.body.length);
						await sendNoteToWebview(note.id, note.body);
					}
					else
					{
						console.log('csv-mode: branch: no selected note');
					}
				}
				else
				{
					console.log('csv-mode: branch: ignoring unknown message type: ' + message.type);
				}
			});
		},
		onActivationCheck: async (event) =>
		{
			return await isNoteCsv(event.noteId);
		},
	});
}
