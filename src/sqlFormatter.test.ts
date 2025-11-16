import { formatStatement, formatStatements } from './sqlFormatter';
import { ParsedStatement } from './sqlParser';

describe('SQLFormatter', () => {
    describe('INSERT文のフォーマット', () => {
        test('単一レコードのINSERT文を複数行で整形する', () => {
            const statement: ParsedStatement = {
                type: 'insert',
                tableName: 'users',
                columns: ['id', 'name', 'email'],
                columnTypes: ['number', 'string', 'string'],
                values: [[1, 'Taro', 'taro@example.com']]
            };

            const result = formatStatement(statement);

            expect(result).toBe(
`INSERT INTO users (
    id,
    name,
    email
)
VALUES
(
    1,
    'Taro',
    'taro@example.com'
);`
            );
        });

        test('複数レコードのINSERT文を複数行で整形する', () => {
            const statement: ParsedStatement = {
                type: 'insert',
                tableName: 'users',
                columns: ['id', 'name'],
                columnTypes: ['number', 'string'],
                values: [
                    [1, 'Taro'],
                    [2, 'Hanako']
                ]
            };

            const result = formatStatement(statement);

            expect(result).toBe(
`INSERT INTO users (
    id,
    name
)
VALUES
(
    1,
    'Taro'
),
(
    2,
    'Hanako'
);`
            );
        });

        test('NULL値を含むINSERT文を正しく整形する', () => {
            const statement: ParsedStatement = {
                type: 'insert',
                tableName: 'users',
                columns: ['id', 'name', 'email'],
                columnTypes: ['number', 'string', 'null'],
                values: [[1, 'Taro', null]]
            };

            const result = formatStatement(statement);

            expect(result).toContain('NULL');
        });

        test('シングルクォートを含む文字列をエスケープする', () => {
            const statement: ParsedStatement = {
                type: 'insert',
                tableName: 'users',
                columns: ['name'],
                columnTypes: ['string'],
                values: [["O'Brien"]]
            };

            const result = formatStatement(statement);

            expect(result).toContain("'O''Brien'");
        });
    });

    describe('UPDATE文のフォーマット', () => {
        test('UPDATE文を複数行で整形する', () => {
            const statement: ParsedStatement = {
                type: 'update',
                tableName: 'users',
                data: [
                    ['name', 'NewName'],
                    ['email', 'new@example.com']
                ],
                where: 'id = 1'
            };

            const result = formatStatement(statement);

            expect(result).toBe(
`UPDATE users
SET
    name = 'NewName',
    email = 'new@example.com'
WHERE id = 1;`
            );
        });

        test('WHERE句なしのUPDATE文を整形する', () => {
            const statement: ParsedStatement = {
                type: 'update',
                tableName: 'users',
                data: [['status', 'active']]
            };

            const result = formatStatement(statement);

            expect(result).not.toContain('WHERE');
            expect(result).toContain('SET\n    status = \'active\';');
        });
    });

    describe('DELETE文のフォーマット', () => {
        test('DELETE文を整形する', () => {
            const statement: ParsedStatement = {
                type: 'delete',
                tableName: 'users',
                where: 'id = 1'
            };

            const result = formatStatement(statement);

            expect(result).toBe('DELETE FROM users\nWHERE id = 1;');
        });

        test('WHERE句なしのDELETE文を整形する', () => {
            const statement: ParsedStatement = {
                type: 'delete',
                tableName: 'users'
            };

            const result = formatStatement(statement);

            expect(result).toBe('DELETE FROM users;');
        });
    });

    describe('SELECT文のフォーマット', () => {
        test('SELECT文を複数行で整形する', () => {
            const statement: ParsedStatement = {
                type: 'select',
                tableName: 'users',
                columns: ['id', 'name', 'email']
            };

            const result = formatStatement(statement);

            expect(result).toBe(
`SELECT
    id,
    name,
    email
FROM users;`
            );
        });
    });

    describe('複数SQL文のフォーマット', () => {
        test('複数のSQL文を空行で区切って結合する', () => {
            const statements: ParsedStatement[] = [
                {
                    type: 'insert',
                    tableName: 'users',
                    columns: ['id', 'name'],
                    columnTypes: ['number', 'string'],
                    values: [[1, 'Taro']]
                },
                {
                    type: 'select',
                    tableName: 'users',
                    columns: ['id', 'name']
                }
            ];

            const result = formatStatements(statements);

            // 2つのSQL文が空行で区切られている
            expect(result.split('\n\n')).toHaveLength(2);
            expect(result).toContain('INSERT INTO users');
            expect(result).toContain('SELECT');
        });
    });

    describe('エッジケース', () => {
        test('不明な型のSQL文は空文字列を返す', () => {
            const statement: ParsedStatement = {
                type: 'unknown'
            };

            const result = formatStatement(statement);

            expect(result).toBe('');
        });

        test('必須フィールドが不足しているINSERT文は空文字列を返す', () => {
            const statement: ParsedStatement = {
                type: 'insert',
                tableName: 'users'
                // columns と values が欠落
            };

            const result = formatStatement(statement);

            expect(result).toBe('');
        });

        test('空の配列を含むSQL文配列をフィルタリングする', () => {
            const statements: ParsedStatement[] = [
                {
                    type: 'unknown'
                },
                {
                    type: 'select',
                    tableName: 'users',
                    columns: ['id']
                }
            ];

            const result = formatStatements(statements);

            // unknownの空文字列は除外される
            expect(result).not.toContain('unknown');
            expect(result).toContain('SELECT');
        });
    });
});
