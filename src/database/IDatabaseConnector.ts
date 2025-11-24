/**
 * データベース接続結果の型定義
 */
export interface QueryResult {
    columns: string[];
    rows: any[][];
    rowCount: number;
    executionTimeMs: number;
}

/**
 * データベース接続エラーの型定義
 */
export interface DatabaseError {
    message: string;
    code?: string;
    detail?: string;
}

/**
 * データベース接続設定の型定義
 */
export interface DatabaseConfig {
    type: 'spanner' | 'mysql' | 'postgresql';

    // Spanner用
    spanner?: {
        projectId: string;
        instanceId: string;
        databaseId: string;
    };

    // MySQL用
    mysql?: {
        host: string;
        port: number;
        database: string;
        user: string;
        password?: string;
    };

    // PostgreSQL用
    postgresql?: {
        host: string;
        port: number;
        database: string;
        user: string;
        password?: string;
    };
}

/**
 * データベース接続の抽象インターフェース
 */
export interface IDatabaseConnector {
    /**
     * データベースへの接続をテスト
     */
    testConnection(): Promise<boolean>;

    /**
     * SQLクエリを実行
     * @param sql 実行するSQLクエリ
     */
    executeQuery(sql: string): Promise<QueryResult>;

    /**
     * 接続をクローズ
     */
    close(): Promise<void>;
}
