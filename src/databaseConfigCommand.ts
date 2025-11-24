import * as vscode from 'vscode';

/**
 * データベース設定コマンドの実装
 */
export async function configureDatabaseCommand(context: vscode.ExtensionContext): Promise<void> {
    // データベースタイプを選択
    const dbType = await vscode.window.showQuickPick(
        [
            { label: 'Google Cloud Spanner', value: 'spanner' },
            { label: 'MySQL', value: 'mysql' },
            { label: 'PostgreSQL', value: 'postgresql' }
        ],
        {
            placeHolder: 'Select database type'
        }
    );

    if (!dbType) {
        return;
    }

    const config = vscode.workspace.getConfiguration('visualSql');

    // データベースタイプを設定
    await config.update('databaseType', dbType.value, vscode.ConfigurationTarget.Global);

    switch (dbType.value) {
        case 'spanner':
            await configureSpanner(config, context);
            break;
        case 'mysql':
            await configureMySQL(config, context);
            break;
        case 'postgresql':
            await configurePostgreSQL(config, context);
            break;
    }

    vscode.window.showInformationMessage('Database configuration saved successfully!');
}

/**
 * Spanner設定
 */
async function configureSpanner(config: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): Promise<void> {
    const projectId = await vscode.window.showInputBox({
        prompt: 'Enter Google Cloud Project ID',
        placeHolder: 'my-project-id',
        value: config.get<string>('spanner.projectId') || ''
    });

    if (!projectId) {
        return;
    }

    const instanceId = await vscode.window.showInputBox({
        prompt: 'Enter Spanner Instance ID',
        placeHolder: 'my-instance',
        value: config.get<string>('spanner.instanceId') || ''
    });

    if (!instanceId) {
        return;
    }

    const databaseId = await vscode.window.showInputBox({
        prompt: 'Enter Spanner Database ID',
        placeHolder: 'my-database',
        value: config.get<string>('spanner.databaseId') || ''
    });

    if (!databaseId) {
        return;
    }

    await config.update('spanner.projectId', projectId, vscode.ConfigurationTarget.Global);
    await config.update('spanner.instanceId', instanceId, vscode.ConfigurationTarget.Global);
    await config.update('spanner.databaseId', databaseId, vscode.ConfigurationTarget.Global);
}

/**
 * MySQL設定
 */
async function configureMySQL(config: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): Promise<void> {
    const host = await vscode.window.showInputBox({
        prompt: 'Enter MySQL host',
        placeHolder: 'localhost',
        value: config.get<string>('mysql.host') || 'localhost'
    });

    if (!host) {
        return;
    }

    const portStr = await vscode.window.showInputBox({
        prompt: 'Enter MySQL port',
        placeHolder: '3306',
        value: config.get<number>('mysql.port')?.toString() || '3306',
        validateInput: (value) => {
            const port = parseInt(value);
            return isNaN(port) || port <= 0 || port > 65535 ? 'Please enter a valid port number' : null;
        }
    });

    if (!portStr) {
        return;
    }

    const database = await vscode.window.showInputBox({
        prompt: 'Enter MySQL database name',
        placeHolder: 'my_database',
        value: config.get<string>('mysql.database') || ''
    });

    if (!database) {
        return;
    }

    const user = await vscode.window.showInputBox({
        prompt: 'Enter MySQL username',
        placeHolder: 'root',
        value: config.get<string>('mysql.user') || ''
    });

    if (!user) {
        return;
    }

    const password = await vscode.window.showInputBox({
        prompt: 'Enter MySQL password (optional, stored securely)',
        placeHolder: 'password',
        password: true
    });

    await config.update('mysql.host', host, vscode.ConfigurationTarget.Global);
    await config.update('mysql.port', parseInt(portStr), vscode.ConfigurationTarget.Global);
    await config.update('mysql.database', database, vscode.ConfigurationTarget.Global);
    await config.update('mysql.user', user, vscode.ConfigurationTarget.Global);

    // パスワードをSecret Storageに保存
    if (password) {
        await context.secrets.store('visualSql.mysql.password', password);
    }
}

/**
 * PostgreSQL設定
 */
async function configurePostgreSQL(config: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): Promise<void> {
    const host = await vscode.window.showInputBox({
        prompt: 'Enter PostgreSQL host',
        placeHolder: 'localhost',
        value: config.get<string>('postgresql.host') || 'localhost'
    });

    if (!host) {
        return;
    }

    const portStr = await vscode.window.showInputBox({
        prompt: 'Enter PostgreSQL port',
        placeHolder: '5432',
        value: config.get<number>('postgresql.port')?.toString() || '5432',
        validateInput: (value) => {
            const port = parseInt(value);
            return isNaN(port) || port <= 0 || port > 65535 ? 'Please enter a valid port number' : null;
        }
    });

    if (!portStr) {
        return;
    }

    const database = await vscode.window.showInputBox({
        prompt: 'Enter PostgreSQL database name',
        placeHolder: 'my_database',
        value: config.get<string>('postgresql.database') || ''
    });

    if (!database) {
        return;
    }

    const user = await vscode.window.showInputBox({
        prompt: 'Enter PostgreSQL username',
        placeHolder: 'postgres',
        value: config.get<string>('postgresql.user') || ''
    });

    if (!user) {
        return;
    }

    const password = await vscode.window.showInputBox({
        prompt: 'Enter PostgreSQL password (optional, stored securely)',
        placeHolder: 'password',
        password: true
    });

    await config.update('postgresql.host', host, vscode.ConfigurationTarget.Global);
    await config.update('postgresql.port', parseInt(portStr), vscode.ConfigurationTarget.Global);
    await config.update('postgresql.database', database, vscode.ConfigurationTarget.Global);
    await config.update('postgresql.user', user, vscode.ConfigurationTarget.Global);

    // パスワードをSecret Storageに保存
    if (password) {
        await context.secrets.store('visualSql.postgresql.password', password);
    }
}
