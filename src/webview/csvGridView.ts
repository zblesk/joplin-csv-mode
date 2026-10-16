import { AllCommunityModule, ModuleRegistry, colorSchemeDark, colorSchemeLight, createGrid, GridApi, IRowNode, themeQuartz } from 'ag-grid-community';

declare const webviewApi: any;

const MAX_AUTO_COLUMN_WIDTH = 500;
let gridApi: GridApi | null = null;
let darkMode = false;


function log(msg: string)
{
	console.log('csv-mode (webview): ' + msg);
}

window.addEventListener('error', (e) =>
{
	log('window error: ' + e.message + ' (' + (e.filename || 'unknown') + ':' + e.lineno + ')');
});
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) =>
{
	log('unhandled rejection: ' + e.reason);
});

log('csvGridView.js started executing');

interface CsvUpdateMessage
{
	type: string;
	body: string;
	delimiter: string;
	escape: string;
	rowSelection: boolean;
	darkMode: boolean;
}

function gridTheme()
{
	return themeQuartz.withPart(darkMode ? colorSchemeDark : colorSchemeLight);
}

function applyDarkMode(enabled: boolean)
{
	if (enabled === darkMode)
	{
		return;
	}
	darkMode = enabled;
	document.documentElement.style.colorScheme = enabled ? 'dark' : 'light';
	gridApi?.setGridOption('theme', gridTheme());
}
let currentDelimiter = ';';
let currentEscape = '"';
let rowSelectionEnabled = false;

function rowSelectionOptions()
{
	// With checkboxes off and click selection off there is no way to select rows, which is how "disabled" is expressed.
	return {
		mode: 'multiRow' as const,
		checkboxes: rowSelectionEnabled,
		headerCheckbox: rowSelectionEnabled,
		enableClickSelection: false,
	};
}

function applyRowSelection(enabled: boolean)
{
	if (enabled === rowSelectionEnabled)
	{
		return;
	}
	rowSelectionEnabled = enabled;
	if (gridApi)
	{
		if (!enabled)
		{
			gridApi.deselectAll();
		}
		gridApi.setGridOption('rowSelection', rowSelectionOptions());
	}
}

function quoteField(value: string): string
{
	const needsQuoting = value.includes(currentDelimiter) || value.includes(currentEscape) || /[\r\n]/.test(value);
	return needsQuoting ? currentEscape + value.split(currentEscape).join(currentEscape + currentEscape) + currentEscape : value;
}

async function copyText(text: string)
{
	try
	{
		await navigator.clipboard.writeText(text);
		return;
	}
	catch (error)
	{
		log('clipboard API failed, falling back to execCommand: ' + error);
	}

	const textarea = document.createElement('textarea');
	textarea.value = text;
	textarea.style.position = 'fixed';
	textarea.style.opacity = '0';
	document.body.appendChild(textarea);
	textarea.select();
	document.execCommand('copy');
	textarea.remove();
}

function rowToCsvLine(data: Record<string, string>): string
{
	const fields = gridApi!.getAllDisplayedColumns()
		.map(column => column.getColDef().field)
		.filter((field): field is string => !!field);
	return fields.map(field => quoteField(data[field] ?? '')).join(currentDelimiter);
}

interface MenuTarget
{
	rowNode: IRowNode | undefined;
	field: string | undefined;
}

function findMenuTarget(eventTarget: EventTarget | null): MenuTarget
{
	const element = eventTarget instanceof Element ? eventTarget : null;
	const rowElement = element?.closest('.ag-row');
	const cellElement = element?.closest('.ag-cell');
	const rowIndex = parseInt(rowElement?.getAttribute('row-index') ?? '', 10);
	const colId = cellElement?.getAttribute('col-id') ?? undefined;
	const rowNode = isNaN(rowIndex) || !gridApi ? undefined : gridApi.getDisplayedRowAtIndex(rowIndex);
	const field = colId && gridApi ? gridApi.getColumn(colId)?.getColDef().field : undefined;
	return { rowNode: rowNode ?? undefined, field };
}

let contextMenu: HTMLDivElement | null = null;

function hideContextMenu()
{
	contextMenu?.remove();
	contextMenu = null;
}

function showContextMenu(x: number, y: number, target: MenuTarget)
{
	hideContextMenu();

	const menu = document.createElement('div');
	menu.style.cssText = 'position: fixed; z-index: 10000; min-width: 180px; padding: 4px 0; font: 13px sans-serif; '
		+ 'color-scheme: ' + (darkMode ? 'dark' : 'light') + '; background: Canvas; color: CanvasText; border: 1px solid GrayText; '
		+ 'box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);';

	const addItem = (label: string, enabled: boolean, action: () => void) =>
	{
		const item = document.createElement('div');
		item.textContent = label;
		item.style.cssText = 'padding: 6px 16px; ' + (enabled ? 'cursor: pointer;' : 'opacity: 0.4;');
		if (enabled)
		{
			item.addEventListener('mouseenter', () => { item.style.background = 'Highlight'; item.style.color = 'HighlightText'; });
			item.addEventListener('mouseleave', () => { item.style.background = ''; item.style.color = ''; });
			item.addEventListener('click', () =>
			{
				hideContextMenu();
				action();
			});
		}
		menu.appendChild(item);
	};

	const { rowNode, field } = target;
	addItem('Copy cell value', !!rowNode && !!field, () =>
	{
		copyText(rowNode!.data?.[field!] ?? '');
	});
	addItem('Copy row value', !!rowNode, () =>
	{
		// Right-clicking a ticked row copies the whole selection, otherwise just that row.
		const selected = gridApi!.getSelectedNodes();
		const nodes = rowNode!.isSelected() && selected.length > 1
			? selected.slice().sort((a, b) => (a.rowIndex ?? 0) - (b.rowIndex ?? 0))
			: [rowNode!];
		copyText(nodes.map(node => rowToCsvLine(node.data ?? {})).join('\n'));
	});
	addItem(rowSelectionEnabled ? 'Disable row selection' : 'Enable row selection', true, () =>
	{
		applyRowSelection(!rowSelectionEnabled);
		webviewApi.postMessage({ type: 'setRowSelection', enabled: rowSelectionEnabled });
	});
	if (gridApi!.getSelectedNodes().length > 0)
	{
		addItem('Clear row selection', true, () => gridApi!.deselectAll());
	}

	const separator = document.createElement('div');
	separator.style.cssText = 'height: 1px; margin: 4px 0; background: GrayText; opacity: 0.5;';
	menu.appendChild(separator);

	addItem('Auto-size columns', true, autoSizeColumns);

	document.body.appendChild(menu);
	menu.style.left = Math.max(0, Math.min(x, window.innerWidth - menu.offsetWidth)) + 'px';
	menu.style.top = Math.max(0, Math.min(y, window.innerHeight - menu.offsetHeight)) + 'px';
	contextMenu = menu;
}

document.addEventListener('contextmenu', (e: MouseEvent) =>
{
	if (!gridApi)
	{
		return;
	}
	e.preventDefault();
	showContextMenu(e.clientX, e.clientY, findMenuTarget(e.target));
});
document.addEventListener('mousedown', (e: MouseEvent) =>
{
	if (contextMenu && !contextMenu.contains(e.target as Node))
	{
		hideContextMenu();
	}
});
document.addEventListener('keydown', (e: KeyboardEvent) =>
{
	if (e.key === 'Escape')
	{
		hideContextMenu();
	}
});
window.addEventListener('blur', hideContextMenu);
window.addEventListener('resize', hideContextMenu);

function parseCsvRows(body: string, delimiter: string, escape: string): string[][]
{
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < body.length; i++)
	{
		const char = body[i];

		if (inQuotes)
		{
			if (char === escape)
			{
				if (body[i + 1] === escape)
				{
					field += escape;
					i++;
				}
				else
				{
					inQuotes = false;
				}
			}
			else
			{
				field += char;
			}
			continue;
		}

		if (char === escape)
		{
			inQuotes = true;
		}
		else if (char === delimiter)
		{
			row.push(field);
			field = '';
		}
		else if (char === '\n' || char === '\r')
		{
			if (char === '\r' && body[i + 1] === '\n')
			{
				i++;
			}
			row.push(field);
			field = '';
			rows.push(row);
			row = [];
		}
		else
		{
			field += char;
		}
	}

	if (field.length > 0 || row.length > 0)
	{
		row.push(field);
		rows.push(row);
	}

	return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

function parseCsv(body: string, delimiter: string, escape: string)
{
	const rows = parseCsvRows(body, delimiter, escape);

	if (rows.length === 0)
	{
		return { columnDefs: [], rowData: [] };
	}

	const headerCells = rows[0];
	// AG Grid treats dots in `field` as nested paths, so key by index and keep the header as its display name.
	const columnDefs = headerCells.map((headerName, index) => ({ field: 'c' + index, headerName }));

	const rowData = rows.slice(1).map(cells =>
	{
		const row: Record<string, string> = {};
		headerCells.forEach((_, index) =>
		{
			row['c' + index] = cells[index] ?? '';
		});
		return row;
	});

	return { columnDefs, rowData };
}

// Fit columns to their content (capped, so one long text cell doesn't take over), then
// stretch them to fill the grid if everything together is narrower than the viewport.
function autoSizeColumns()
{
	if (!gridApi)
	{
		return;
	}
	gridApi.autoSizeAllColumns();
	gridApi.applyColumnState({
		state: gridApi.getAllGridColumns()
			.filter(column => column.getActualWidth() > MAX_AUTO_COLUMN_WIDTH)
			.map(column => ({ colId: column.getColId(), width: MAX_AUTO_COLUMN_WIDTH })),
	});
	stretchColumnsIfNarrow();
}

function stretchColumnsIfNarrow()
{
	if (!gridApi)
	{
		return;
	}
	const totalWidth = gridApi.getAllDisplayedColumns().reduce((sum, column) => sum + column.getActualWidth(), 0);
	const container = document.getElementById('csv-grid-root');
	if (container && totalWidth < container.clientWidth)
	{
		gridApi.sizeColumnsToFit();
	}
}

function renderCsv(body: string, delimiter: string, escape: string, rowSelection: boolean, dark: boolean)
{
	applyDarkMode(!!dark);
	// Applied before the grid is created on first render, so the initial options already reflect it.
	applyRowSelection(!!rowSelection);
	currentDelimiter = delimiter;
	currentEscape = escape;
	const { columnDefs, rowData } = parseCsv(body, delimiter, escape);
	log('parsed csv: ' + columnDefs.length + ' columns, ' + rowData.length + ' rows');

	if (gridApi)
	{
		log('branch: updating existing grid');
		gridApi.setGridOption('columnDefs', columnDefs);
		gridApi.setGridOption('rowData', rowData);
		return;
	}

	log('branch: creating new grid');
	const container = document.getElementById('csv-grid-root');
	if (!container)
	{
		log('ERROR: #csv-grid-root not found in DOM');
		return;
	}

	log('container size before create: ' + container.clientWidth + 'x' + container.clientHeight);
	container.textContent = '';
	gridApi = createGrid(container, {
		columnDefs,
		rowData,
		theme: gridTheme(),
		rowSelection: rowSelectionOptions(),
		defaultColDef: {
			filter: true,
		},
	});
	log('grid created, container size after create: ' + container.clientWidth + 'x' + container.clientHeight);
}

try
{
	log('registering ag-grid modules...');
	ModuleRegistry.registerModules([AllCommunityModule]);
	log('ag-grid modules registered');

	webviewApi.onMessage((event: { message: CsvUpdateMessage }) =>
	{
		const message = event.message;
		log('received message: ' + message.type);
		if (message.type === 'updateCsvFromNote')
		{
			log('branch: handling updateCsvFromNote');
			renderCsv(message.body, message.delimiter, message.escape, message.rowSelection, message.darkMode);
		}
		else
		{
			log('branch: ignoring unknown message type: ' + message.type);
		}
	});

	webviewApi.postMessage({ type: 'isReady' });
	log('posted isReady to plugin');
}
catch (error)
{
	log('ERROR: ' + (error instanceof Error ? error.message : String(error)));
}
