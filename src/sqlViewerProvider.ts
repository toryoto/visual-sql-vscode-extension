import * as vscode from 'vscode';
import { SQLParser, ParsedSQLData } from './sqlParser';

export class SQLViewerProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'visual-sql-viewer';
	private _view?: vscode.WebviewView;
	private _sqlParser: SQLParser;
	private _currentDocument?: vscode.TextDocument;
	private _lastSQLContent: string = '';

	constructor(private readonly _extensionUri: vscode.Uri) {
		this._sqlParser = new SQLParser();
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// Webviewからのメッセージを処理
		webviewView.webview.onDidReceiveMessage(
			message => {
				switch (message.type) {
					case 'updateSQL':
						this._updateSQLFile(message.sql);
						return;
					case 'ready':
						if (this._currentDocument) {
							this.updateWebview(this._currentDocument);
						} else {
							const activeEditor = vscode.window.activeTextEditor;
							if (activeEditor && activeEditor.document.languageId === 'sql') {
								this.updateWebview(activeEditor.document);
							}
						}
						return;
					case 'cellEdit':
						this._handleCellEdit(message.statementIndex, message.rowIndex, message.columnIndex, message.value);
						return;
					case 'addRow':
						this._handleAddRow(message.statementIndex);
						return;
					case 'deleteRow':
						this._handleDeleteRow(message.statementIndex, message.rowIndex);
						return;
					case 'addColumn':
						this._handleAddColumn(message.statementIndex);
						return;
					case 'deleteColumn':
						this._handleDeleteColumn(message.statementIndex, message.columnIndex);
						return;
					case 'editColumnName':
						this._handleEditColumnName(message.statementIndex, message.columnIndex, message.newName);
						return;
				}
			},
			undefined,
			[]
		);

		// Webviewが表示されたときに現在のドキュメントを送信
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				const activeEditor = vscode.window.activeTextEditor;
				if (activeEditor && activeEditor.document.languageId === 'sql') {
					this.updateWebview(activeEditor.document);
				}
			}
		});
	}

	public updateWebview(document: vscode.TextDocument) {
		this._currentDocument = document;
		
		if (this._view) {
			const sqlContent = document.getText();
			
			// 前回と同じ内容なら再解析しない
			if (sqlContent === this._lastSQLContent) {
				return;
			}
			
			this._lastSQLContent = sqlContent;
			const parsedData = this._sqlParser.parseSQL(sqlContent);
			
			this._view.webview.postMessage({
				type: 'updateData',
				data: parsedData,
				fileName: document.fileName
			});
		}
	}

	private _handleCellEdit(statementIndex: number, rowIndex: number, columnIndex: number, value: any) {
		if (!this._currentDocument) {
			return;
		}

		const sqlContent = this._currentDocument.getText();
		const parsedData = this._sqlParser.parseSQL(sqlContent);
		
		if (!parsedData.success || !parsedData.statements[statementIndex]) {
			return;
		}

		const statement = parsedData.statements[statementIndex];

		if (statement.type === 'insert' && statement.values) {
			if (statement.values[rowIndex]) {
				statement.values[rowIndex][columnIndex] = value;
			}
		} else if (statement.type === 'update' && statement.data) {
			if (statement.data[rowIndex]) {
				statement.data[rowIndex][columnIndex] = value;
			}
		}

		const newSQL = this._generateSQLFromData(parsedData);
		this._updateSQLFile(newSQL);
	}

	private _handleAddRow(statementIndex: number) {
		if (!this._currentDocument) {
			return;
		}

		const sqlContent = this._currentDocument.getText();
		const parsedData = this._sqlParser.parseSQL(sqlContent);
		
		if (!parsedData.success || !parsedData.statements[statementIndex]) {
			return;
		}

		const statement = parsedData.statements[statementIndex];

		if (statement.type === 'insert' && statement.columns) {
			const newRow = new Array(statement.columns.length).fill('');
			if (!statement.values) {
				statement.values = [];
			}
			statement.values.push(newRow);
		} else if (statement.type === 'update' && statement.columns) {
			const newRow = [statement.columns[0] || '', ''];
			if (!statement.data) {
				statement.data = [];
			}
			statement.data.push(newRow);
		}

		const newSQL = this._generateSQLFromData(parsedData);
		this._updateSQLFile(newSQL);
	}

	private _handleDeleteRow(statementIndex: number, rowIndex: number) {
		if (!this._currentDocument) {
			return;
		}

		const sqlContent = this._currentDocument.getText();
		const parsedData = this._sqlParser.parseSQL(sqlContent);
		
		if (!parsedData.success || !parsedData.statements[statementIndex]) {
			return;
		}

		const statement = parsedData.statements[statementIndex];

		if (statement.type === 'insert' && statement.values) {
			statement.values.splice(rowIndex, 1);
		} else if (statement.type === 'update' && statement.data) {
			statement.data.splice(rowIndex, 1);
		}

		const newSQL = this._generateSQLFromData(parsedData);
		this._updateSQLFile(newSQL);
	}

	private _generateSQLFromData(data: ParsedSQLData): string {
		if (!data.success) {
			return data.raw;
		}
	
		return data.statements.map(statement => {
			switch (statement.type) {
				case 'insert':
					if (statement.tableName && statement.columns && statement.values) {
						const columnsStr = statement.columns.join(', ');
						const valuesStr = statement.values.map(row => 
							`(${row.map(val => this._formatSQLValue(val)).join(', ')})`
						).join(', ');
						return `INSERT INTO ${statement.tableName} (${columnsStr}) VALUES ${valuesStr};`;
					}
					break;
				case 'update':
					if (statement.tableName && statement.data) {
						const setClause = statement.data.map(([col, val]) => 
							`${col} = ${this._formatSQLValue(val)}`
						).join(', ');
						return `UPDATE ${statement.tableName} SET ${setClause};`;
					}
					break;
				case 'select':
					if (statement.tableName && statement.columns) {
						const columnsStr = statement.columns.join(', ');
						return `SELECT ${columnsStr} FROM ${statement.tableName};`;
					}
					break;
			}
			return '';
		}).filter(sql => sql).join('\n');
	}

	private _formatSQLValue(val: any): string {
		// NULL値の処理
		if (val === null || val === undefined) {
			return 'NULL';
		}

		// 文字列の場合、そのまま返す(既にクォートが含まれている場合)
		const strVal = String(val).trim();

		// 既にシングルクォートまたはダブルクォートで囲まれている場合
		if ((strVal.startsWith("'") && strVal.endsWith("'")) || 
		    (strVal.startsWith('"') && strVal.endsWith('"'))) {
			// ダブルクォートの場合はシングルクォートに変換
			if (strVal.startsWith('"') && strVal.endsWith('"')) {
				const innerValue = strVal.slice(1, -1);
				return `'${innerValue}'`;
			}
			return strVal;
		}

		// 'NULL'という文字列の場合
		if (strVal.toLowerCase() === 'null') {
			return 'NULL';
		}

		// boolean値の処理
		if (strVal.toLowerCase() === 'true' || strVal.toLowerCase() === 'false') {
			return strVal.toUpperCase();
		}

		// 数値の処理
		if (!isNaN(Number(strVal)) && strVal !== '') {
			return strVal;
		}

		// その他は文字列としてシングルクォートで囲む
		// エスケープ処理: シングルクォートを2つにする
		const escapedValue = strVal.replace(/'/g, "''");
		return `'${escapedValue}'`;
	}

	private _handleAddColumn(statementIndex: number) {
		if (!this._currentDocument) {
			return;
		}

		const sqlContent = this._currentDocument.getText();
		const parsedData = this._sqlParser.parseSQL(sqlContent);
		
		if (!parsedData.success || !parsedData.statements[statementIndex]) {
			return;
		}

		const statement = parsedData.statements[statementIndex];

		if (statement.type === 'insert' && statement.columns) {
			// 新しいカラム名を生成(column1, column2, ...)
			let newColumnName = 'column1';
			let counter = 1;
			while (statement.columns.includes(newColumnName)) {
				counter++;
				newColumnName = `column${counter}`;
			}
			
			statement.columns.push(newColumnName);
			
			// 既存の行データに新しいカラム用の空の値を追加
			if (statement.values) {
				statement.values.forEach(row => {
					row.push('');
				});
			}
		}

		const newSQL = this._generateSQLFromData(parsedData);
		this._updateSQLFile(newSQL);
	}

	private _handleDeleteColumn(statementIndex: number, columnIndex: number) {
		if (!this._currentDocument) {
			return;
		}

		const sqlContent = this._currentDocument.getText();
		const parsedData = this._sqlParser.parseSQL(sqlContent);
		
		if (!parsedData.success || !parsedData.statements[statementIndex]) {
			return;
		}

		const statement = parsedData.statements[statementIndex];

		if (statement.type === 'insert' && statement.columns && columnIndex < statement.columns.length) {
			// カラムを削除
			statement.columns.splice(columnIndex, 1);
			
			// 既存の行データから対応するカラムを削除
			if (statement.values) {
				statement.values.forEach(row => {
					if (columnIndex < row.length) {
						row.splice(columnIndex, 1);
					}
				});
			}
		}

		const newSQL = this._generateSQLFromData(parsedData);
		this._updateSQLFile(newSQL);
	}

	private _handleEditColumnName(statementIndex: number, columnIndex: number, newName: string) {
		if (!this._currentDocument) {
			return;
		}

		const sqlContent = this._currentDocument.getText();
		const parsedData = this._sqlParser.parseSQL(sqlContent);
		
		if (!parsedData.success || !parsedData.statements[statementIndex]) {
			return;
		}

		const statement = parsedData.statements[statementIndex];

		if (statement.type === 'insert' && statement.columns && columnIndex < statement.columns.length) {
			statement.columns[columnIndex] = newName;
		}

		const newSQL = this._generateSQLFromData(parsedData);
		this._updateSQLFile(newSQL);
	}

	private _updateSQLFile(sql: string) {
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor && activeEditor.document.languageId === 'sql') {
			const edit = new vscode.WorkspaceEdit();
			const fullRange = new vscode.Range(
				activeEditor.document.positionAt(0),
				activeEditor.document.positionAt(activeEditor.document.getText().length)
			);
			edit.replace(activeEditor.document.uri, fullRange, sql);
			vscode.workspace.applyEdit(edit);
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
		);

		const nonce = getNonce();

		return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Visual SQL</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 10px;
        }
        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .header {
            margin-bottom: 10px;
            padding: 8px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .content {
            flex: 1;
            overflow: auto;
        }
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            padding: 8px;
            border-radius: 4px;
            margin: 8px 0;
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
        .statement-container {
            margin-bottom: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 10px;
        }
        .statement-container h4 {
            margin: 0 0 10px 0;
            color: var(--vscode-textLink-foreground);
        }
        .table-container {
            margin-top: 10px;
            overflow-x: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .table-container::-webkit-scrollbar {
            height: 8px;
        }
        .table-container::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
        }
        .table-container::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-hoverBackground);
            border-radius: 4px;
        }
        .table-container::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-activeBackground);
        }
        .sql-table {
            width: 100%;
            min-width: max-content;
            border-collapse: collapse;
            margin-bottom: 0;
        }
        .sql-table th, .sql-table td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px;
            text-align: left;
            white-space: nowrap;
            min-width: 120px;
        }
        .sql-table th {
            background-color: var(--vscode-editor-background);
            font-weight: bold;
            white-space: nowrap;
            position: relative;
            min-width: 120px;
        }
        .sql-table tr:nth-child(even) {
            background-color: var(--vscode-editor-background);
        }
        .sql-table tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .editable-cell {
            cursor: pointer;
            position: relative;
        }
        .editable-cell:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        .cell-input {
            width: 100%;
            border: none;
            background: transparent;
            color: var(--vscode-foreground);
            font-family: inherit;
            font-size: inherit;
            padding: 0;
            margin: 0;
            outline: 2px solid var(--vscode-focusBorder);
        }
        .add-row-btn, .delete-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        .add-row-btn:hover, .delete-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .delete-btn {
            background-color: var(--vscode-errorForeground);
            color: white;
        }
        .delete-btn:hover {
            background-color: var(--vscode-inputValidation-errorBorder);
        }
        .column-delete-btn {
            background-color: transparent;
            color: var(--vscode-errorForeground);
            border: 1px solid var(--vscode-errorForeground);
            border-radius: 50%;
            width: 16px;
            height: 16px;
            padding: 0;
            margin: 0;
            font-size: 10px;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .column-delete-btn:hover {
            background-color: var(--vscode-errorForeground);
            color: white;
        }
        .info-text {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-top: 10px;
        }
        .column-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .column-name {
            flex: 1;
        }
        .column-actions {
            display: flex;
            gap: 2px;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}