import * as vscode from 'vscode';
import { SQLParser, ParsedSQLData } from './sqlParser';

export class SQLViewerProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'easy-sql-viewer';
	private _view?: vscode.WebviewView;
	private _sqlParser: SQLParser;

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
					case 'getCurrentSQL':
						this._sendCurrentSQL();
						return;
				}
			},
			undefined,
			[]
		);
	}

	public updateWebview(document: vscode.TextDocument) {
		if (this._view) {
			const sqlContent = document.getText();
			const parsedData = this._sqlParser.parseSQL(sqlContent);
			
			this._view.webview.postMessage({
				type: 'updateData',
				data: parsedData,
				fileName: document.fileName
			});
		}
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

	private _sendCurrentSQL() {
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor && activeEditor.document.languageId === 'sql') {
			const sqlContent = activeEditor.document.getText();
			this._view?.webview.postMessage({
				type: 'currentSQL',
				sql: sqlContent
			});
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Reactアプリのスクリプトパス
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
		);

		return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SQL Viewer</title>
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
        }
        .sql-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        .sql-table th, .sql-table td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px;
            text-align: left;
        }
        .sql-table th {
            background-color: var(--vscode-editor-background);
            font-weight: bold;
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
        .info-text {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
	}
}
