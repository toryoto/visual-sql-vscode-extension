import * as vscode from 'vscode';
import { IDatabaseConnector, DatabaseConfig, QueryResult } from './IDatabaseConnector';
import { DatabaseConnectorFactory } from './DatabaseConnectorFactory';

/**
 * クエリ実行を管理するサービスクラス
 */
export class QueryExecutor {
    private connector: IDatabaseConnector | null = null;
    private currentConfig: DatabaseConfig | null = null;

    /**
     * VSCode設定からデータベース設定を読み込む
     */
    private loadConfigFromSettings(): DatabaseConfig | null {
        const config = vscode.workspace.getConfiguration('visualSql');
        const dbType = config.get<string>('databaseType');

        if (!dbType) {
            return null;
        }

        const databaseConfig: DatabaseConfig = {
            type: dbType as 'spanner' | 'mysql' | 'postgresql'
        };

        switch (dbType) {
            case 'spanner':
                const projectId = config.get<string>('spanner.projectId');
                const instanceId = config.get<string>('spanner.instanceId');
                const databaseId = config.get<string>('spanner.databaseId');

                if (!projectId || !instanceId || !databaseId) {
                    vscode.window.showErrorMessage('Spanner configuration is incomplete. Please configure projectId, instanceId, and databaseId.');
                    return null;
                }

                databaseConfig.spanner = {
                    projectId,
                    instanceId,
                    databaseId
                };
                break;

            case 'mysql':
                const mysqlHost = config.get<string>('mysql.host');
                const mysqlPort = config.get<number>('mysql.port');
                const mysqlDatabase = config.get<string>('mysql.database');
                const mysqlUser = config.get<string>('mysql.user');

                if (!mysqlHost || !mysqlDatabase || !mysqlUser) {
                    vscode.window.showErrorMessage('MySQL configuration is incomplete. Please configure host, database, and user.');
                    return null;
                }

                // パスワードをSecret Storageから取得
                databaseConfig.mysql = {
                    host: mysqlHost,
                    port: mysqlPort || 3306,
                    database: mysqlDatabase,
                    user: mysqlUser
                };
                break;

            case 'postgresql':
                const pgHost = config.get<string>('postgresql.host');
                const pgPort = config.get<number>('postgresql.port');
                const pgDatabase = config.get<string>('postgresql.database');
                const pgUser = config.get<string>('postgresql.user');

                if (!pgHost || !pgDatabase || !pgUser) {
                    vscode.window.showErrorMessage('PostgreSQL configuration is incomplete. Please configure host, database, and user.');
                    return null;
                }

                // パスワードをSecret Storageから取得
                databaseConfig.postgresql = {
                    host: pgHost,
                    port: pgPort || 5432,
                    database: pgDatabase,
                    user: pgUser
                };
                break;

            default:
                vscode.window.showErrorMessage(`Unsupported database type: ${dbType}`);
                return null;
        }

        return databaseConfig;
    }

    /**
     * パスワードをSecret Storageから取得して設定に追加
     */
    private async addPasswordToConfig(config: DatabaseConfig, context: vscode.ExtensionContext): Promise<void> {
        if (config.type === 'mysql' && config.mysql) {
            const password = await context.secrets.get('visualSql.mysql.password');
            if (password) {
                config.mysql.password = password;
            }
        } else if (config.type === 'postgresql' && config.postgresql) {
            const password = await context.secrets.get('visualSql.postgresql.password');
            if (password) {
                config.postgresql.password = password;
            }
        }
    }

    /**
     * データベース接続を初期化
     */
    async initialize(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            const config = this.loadConfigFromSettings();
            if (!config) {
                return false;
            }

            // パスワードを追加
            await this.addPasswordToConfig(config, context);

            // 既存の接続をクローズ
            if (this.connector) {
                await this.connector.close();
            }

            // 新しいコネクタを作成
            this.connector = DatabaseConnectorFactory.createConnector(config);
            this.currentConfig = config;

            // 接続テスト
            const isConnected = await this.connector.testConnection();
            if (!isConnected) {
                vscode.window.showErrorMessage('Failed to connect to database. Please check your configuration.');
                return false;
            }

            vscode.window.showInformationMessage(`Successfully connected to ${config.type} database.`);
            return true;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Database initialization failed: ${error.message}`);
            return false;
        }
    }

    /**
     * SQLクエリを実行
     */
    async executeQuery(sql: string, context: vscode.ExtensionContext): Promise<QueryResult> {
        // コネクタが未初期化の場合は初期化を試みる
        if (!this.connector) {
            const initialized = await this.initialize(context);
            if (!initialized) {
                throw new Error('Database connection is not initialized');
            }
        }

        try {
            return await this.connector!.executeQuery(sql);
        } catch (error: any) {
            throw {
                message: error.message || 'Query execution failed',
                code: error.code,
                detail: error.detail
            };
        }
    }

    /**
     * 接続をクローズ
     */
    async close(): Promise<void> {
        if (this.connector) {
            await this.connector.close();
            this.connector = null;
            this.currentConfig = null;
        }
    }

    /**
     * 現在の接続状態を取得
     */
    isConnected(): boolean {
        return this.connector !== null;
    }

    /**
     * 現在の接続設定を取得
     */
    getCurrentConfig(): DatabaseConfig | null {
        return this.currentConfig;
    }
}
