import joplin from 'api';
import { SettingItemType } from 'api/types';

export const EDITOR_VIEW_ID = 'csvModeEditor';

export const USERDATA_IS_CSV = 'is-csv';
export const USERDATA_DELIMITER = 'delimiter';
export const USERDATA_ESCAPE = 'escape';
export const USERDATA_SKIP_LINES = 'skip-lines';
export const USERDATA_SKIP_FRONTMATTER = 'skip-frontmatter';
export const USERDATA_ROW_SELECTION_ENABLED = 'row-selection-enabled';

export const SETTINGS_SECTION = 'csvMode';
export const SETTING_DEFAULT_SEPARATOR = 'defaultSeparator';
export const SETTING_DEFAULT_STRING_ESCAPE = 'defaultStringEscape';
export const SETTING_DEFAULT_SKIP_LINES = 'defaultSkipLines';
export const SETTING_DEFAULT_SKIP_FRONTMATTER = 'defaultSkipFrontmatter';


export async function registerSettings()
{
	await joplin.settings.registerSection(SETTINGS_SECTION, {
		label: 'CSV;Mode',
		iconName: 'fas fa-table',
	});

	await joplin.settings.registerSettings({
		[SETTING_DEFAULT_SEPARATOR]: {
			value: ';',
			type: SettingItemType.String,
			public: true,
			section: SETTINGS_SECTION,
			label: 'Default separator',
			description: 'The default delimiter used to split CSV columns. Enter \\t or "tab" for a tab character.',
		},
		[SETTING_DEFAULT_STRING_ESCAPE]: {
			value: '"',
			type: SettingItemType.String,
			public: true,
			section: SETTINGS_SECTION,
			label: 'Default string escape',
			description: 'The default character used to quote CSV fields that contain the separator or line breaks.',
		},
		[SETTING_DEFAULT_SKIP_LINES]: {
			value: 0,
			type: SettingItemType.Int,
			minimum: 0,
			public: true,
			section: SETTINGS_SECTION,
			label: 'Default lines to skip',
			description: 'The default number of lines at the start of the note to ignore before the CSV data begins (and after YAML front-matter).',
		},
		[SETTING_DEFAULT_SKIP_FRONTMATTER]: {
			value: true,
			type: SettingItemType.Bool,
			public: true,
			section: SETTINGS_SECTION,
			label: 'Skip frontmatter by default',
			description: 'Ignore a leading YAML frontmatter block (delimited by --- lines) before the CSV data.',
		},
	});
}
