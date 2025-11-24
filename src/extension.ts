// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SQLViewerProvider } from './sqlViewerProvider';
import { QueryExecutor } from './database/QueryExecutor';
import { configureDatabaseCommand } from './databaseConfigCommand';

// グローバルなQueryExecutorインスタンス
let queryExecutor: QueryExecutor;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "visual-sql" is now active!');

	// QueryExecutorを初期化
	queryExecutor = new QueryExecutor();

	// SQL Viewer Providerを登録
	const provider = new SQLViewerProvider(context.extensionUri, context, queryExecutor);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('visual-sql-viewer', provider)
	);

	// データベース設定コマンドを登録
	context.subscriptions.push(
		vscode.commands.registerCommand('visual-sql.configureDatabase', () => {
			configureDatabaseCommand(context);
		})
	);

	// アクティブなエディタが変更されたときの処理
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor && editor.document.languageId === 'sql') {
				provider.updateWebview(editor.document);
			}
		})
	);

	// ドキュメントが変更されたときの処理
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(event => {
			if (event.document.languageId === 'sql') {
				provider.updateWebview(event.document);
			}
		})
	);

	// 初期化時にアクティブなSQLファイルがあれば表示
	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor && activeEditor.document.languageId === 'sql') {
		provider.updateWebview(activeEditor.document);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	// データベース接続をクローズ
	if (queryExecutor) {
		queryExecutor.close();
	}
}
