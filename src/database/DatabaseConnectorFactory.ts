import { IDatabaseConnector, DatabaseConfig } from './IDatabaseConnector';
import { SpannerConnector } from './SpannerConnector';
import { MySQLConnector } from './MySQLConnector';
import { PostgreSQLConnector } from './PostgreSQLConnector';

/**
 * データベースコネクタのファクトリクラス
 */
export class DatabaseConnectorFactory {
    /**
     * 設定に基づいて適切なデータベースコネクタを作成
     * @param config データベース設定
     * @returns データベースコネクタ
     */
    static createConnector(config: DatabaseConfig): IDatabaseConnector {
        switch (config.type) {
            case 'spanner':
                if (!config.spanner) {
                    throw new Error('Spanner configuration is missing');
                }
                return new SpannerConnector(config.spanner);

            case 'mysql':
                if (!config.mysql) {
                    throw new Error('MySQL configuration is missing');
                }
                return new MySQLConnector(config.mysql);

            case 'postgresql':
                if (!config.postgresql) {
                    throw new Error('PostgreSQL configuration is missing');
                }
                return new PostgreSQLConnector(config.postgresql);

            default:
                throw new Error(`Unsupported database type: ${config.type}`);
        }
    }
}
