import { Spanner, Database } from '@google-cloud/spanner';
import { IDatabaseConnector, QueryResult, DatabaseConfig } from './IDatabaseConnector';

/**
 * Google Cloud Spanner接続実装
 */
export class SpannerConnector implements IDatabaseConnector {
    private spanner: Spanner;
    private database: Database;
    private config: DatabaseConfig['spanner'];

    constructor(config: DatabaseConfig['spanner']) {
        if (!config) {
            throw new Error('Spanner configuration is required');
        }

        this.config = config;

        // Spannerクライアントの初期化
        // gcloud auth application-default loginで認証済みの前提
        this.spanner = new Spanner({
            projectId: config.projectId
        });

        const instance = this.spanner.instance(config.instanceId);
        this.database = instance.database(config.databaseId);
    }

    async testConnection(): Promise<boolean> {
        try {
            // シンプルなクエリで接続テスト
            await this.database.run({
                sql: 'SELECT 1 as test'
            });
            return true;
        } catch (error) {
            console.error('Spanner connection test failed:', error);
            return false;
        }
    }

    async executeQuery(sql: string): Promise<QueryResult> {
        const startTime = Date.now();

        try {
            const [rows] = await this.database.run({
                sql: sql,
                json: true
            });

            const executionTimeMs = Date.now() - startTime;

            // 結果が空の場合
            if (rows.length === 0) {
                return {
                    columns: [],
                    rows: [],
                    rowCount: 0,
                    executionTimeMs
                };
            }

            // カラム名を取得（最初の行のキーから）
            const columns = Object.keys(rows[0]);

            // 行データを配列に変換
            const rowData = rows.map(row =>
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
                code: error.code?.toString(),
                detail: error.details
            };
        }
    }

    async close(): Promise<void> {
        // Spannerクライアントのクローズ
        await this.spanner.close();
    }
}
