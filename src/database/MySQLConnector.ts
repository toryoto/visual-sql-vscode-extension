import * as mysql from 'mysql2/promise';
import { IDatabaseConnector, QueryResult, DatabaseConfig } from './IDatabaseConnector';

/**
 * MySQL接続実装
 */
export class MySQLConnector implements IDatabaseConnector {
    private connection: mysql.Connection | null = null;
    private config: DatabaseConfig['mysql'];

    constructor(config: DatabaseConfig['mysql']) {
        if (!config) {
            throw new Error('MySQL configuration is required');
        }
        this.config = config;
    }

    private async getConnection(): Promise<mysql.Connection> {
        if (!this.connection) {
            this.connection = await mysql.createConnection({
                host: this.config!.host,
                port: this.config!.port,
                database: this.config!.database,
                user: this.config!.user,
                password: this.config!.password
            });
        }
        return this.connection;
    }

    async testConnection(): Promise<boolean> {
        try {
            const conn = await this.getConnection();
            await conn.ping();
            return true;
        } catch (error) {
            console.error('MySQL connection test failed:', error);
            return false;
        }
    }

    async executeQuery(sql: string): Promise<QueryResult> {
        const startTime = Date.now();

        try {
            const conn = await this.getConnection();
            const [rows, fields] = await conn.query(sql);

            const executionTimeMs = Date.now() - startTime;

            // 結果がない場合（INSERT/UPDATE/DELETE等）
            if (!Array.isArray(rows) || rows.length === 0) {
                return {
                    columns: [],
                    rows: [],
                    rowCount: Array.isArray(rows) ? rows.length : 0,
                    executionTimeMs
                };
            }

            // カラム名を取得
            const columns = fields.map((field: any) => field.name);

            // 行データを配列に変換
            const rowData = rows.map((row: any) =>
                columns.map(col => row[col])
            );

            return {
                columns,
                rows: rowData,
                rowCount: rows.length,
                executionTimeMs
            };
        } catch (error: any) {
            throw {
                message: error.message || 'Query execution failed',
                code: error.code,
                detail: error.sqlMessage
            };
        }
    }

    async close(): Promise<void> {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }
}
