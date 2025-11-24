import { Client } from 'pg';
import { IDatabaseConnector, QueryResult, DatabaseConfig } from './IDatabaseConnector';

/**
 * PostgreSQL接続実装
 */
export class PostgreSQLConnector implements IDatabaseConnector {
    private client: Client | null = null;
    private config: DatabaseConfig['postgresql'];

    constructor(config: DatabaseConfig['postgresql']) {
        if (!config) {
            throw new Error('PostgreSQL configuration is required');
        }
        this.config = config;
    }

    private async getClient(): Promise<Client> {
        if (!this.client) {
            this.client = new Client({
                host: this.config!.host,
                port: this.config!.port,
                database: this.config!.database,
                user: this.config!.user,
                password: this.config!.password
            });
            await this.client.connect();
        }
        return this.client;
    }

    async testConnection(): Promise<boolean> {
        try {
            const client = await this.getClient();
            await client.query('SELECT 1');
            return true;
        } catch (error) {
            console.error('PostgreSQL connection test failed:', error);
            return false;
        }
    }

    async executeQuery(sql: string): Promise<QueryResult> {
        const startTime = Date.now();

        try {
            const client = await this.getClient();
            const result = await client.query(sql);

            const executionTimeMs = Date.now() - startTime;

            // 結果がない場合（INSERT/UPDATE/DELETE等）
            if (!result.rows || result.rows.length === 0) {
                return {
                    columns: [],
                    rows: [],
                    rowCount: result.rowCount || 0,
                    executionTimeMs
                };
            }

            // カラム名を取得
            const columns = result.fields.map(field => field.name);

            // 行データを配列に変換
            const rowData = result.rows.map(row =>
                columns.map(col => row[col])
            );

            return {
                columns,
                rows: rowData,
                rowCount: result.rowCount || 0,
                executionTimeMs
            };
        } catch (error: any) {
            throw {
                message: error.message || 'Query execution failed',
                code: error.code,
                detail: error.detail
            };
        }
    }

    async close(): Promise<void> {
        if (this.client) {
            await this.client.end();
            this.client = null;
        }
    }
}
