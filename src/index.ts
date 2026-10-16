import joplin from 'api';
import { registerSettings } from './settings';
import { registerCsvEditor } from './editor';
import { initConfigDialog } from './configDialog';
import { registerCommands, registerActivation } from './commands';

joplin.plugins.register({
	onStart: async function()
	{
		console.log('csv-mode: plugin start');
		await registerSettings();
		await registerCsvEditor();
		await initConfigDialog();
		await registerCommands();
		await registerActivation();
	},
});
