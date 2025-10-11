import { Parser } from 'node-sql-parser';

export interface ParsedSQLData {
    success: boolean;
    statements: ParsedStatement[];
    error?: string;
    raw: string;
}

export interface ParsedStatement {
    type: 'select' | 'insert' | 'update' | 'delete' | 'unknown';
    tableName?: string;
    columns?: string[];
    values?: any[][];
    where?: any;
    set?: any;
    data?: any[][];
}

export class SQLParser {
    private parser: Parser;

    constructor() {
        this.parser = new Parser();
    }

    public parseSQL(sqlContent: string): ParsedSQLData {
        try {
            // SQLを文ごとに分割
            const statements = this.splitSQLStatements(sqlContent);
            const parsedStatements: ParsedStatement[] = [];

            for (const statement of statements) {
                if (statement.trim()) {
                    const parsed = this.parseStatement(statement.trim());
                    if (parsed) {
                        parsedStatements.push(parsed);
                    }
                }
            }

            return {
                success: true,
                statements: parsedStatements,
                raw: sqlContent
            };
        } catch (error) {
            return {
                success: false,
                statements: [],
                error: error instanceof Error ? error.message : 'Unknown error',
                raw: sqlContent
            };
        }
    }

    private splitSQLStatements(sql: string): string[] {
        // セミコロンで分割し、コメントを除去
        return sql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    }

    private parseStatement(statement: string): ParsedStatement | null {
        try {
            const ast = this.parser.astify(statement);
            
            if (Array.isArray(ast)) {
                // 複数の文がある場合は最初の文を処理
                return this.parseAST(ast[0]);
            } else {
                return this.parseAST(ast);
            }
        } catch (error) {
            console.error('Statement parsing error:', error);
            return null;
        }
    }

    private parseAST(ast: any): ParsedStatement | null {
        if (!ast || typeof ast !== 'object') {
            return null;
        }

        const type = ast.type?.toLowerCase();

        switch (type) {
            case 'select':
                return this.parseSelectStatement(ast);
            case 'insert':
                return this.parseInsertStatement(ast);
            case 'update':
                return this.parseUpdateStatement(ast);
            case 'delete':
                return this.parseDeleteStatement(ast);
            default:
                return {
                    type: 'unknown',
                    data: [['Raw SQL', ast]]
                };
        }
    }

    private parseSelectStatement(ast: any): ParsedStatement {
        const columns: string[] = [];
        const data: any[][] = [];

        // SELECT句の解析
        if (ast.columns) {
            ast.columns.forEach((col: any) => {
                if (col.expr && col.expr.column) {
                    columns.push(col.expr.column);
                } else if (col.expr && col.expr.ast) {
                    columns.push(col.expr.ast.value || 'Expression');
                } else if (typeof col.expr === 'string') {
                    columns.push(col.expr);
                }
            });
        }

        // FROM句の解析
        let tableName = '';
        if (ast.from) {
            if (Array.isArray(ast.from)) {
                tableName = ast.from[0]?.table || '';
            } else {
                tableName = ast.from.table || '';
            }
        }

        return {
            type: 'select',
            tableName,
            columns,
            data: data.length > 0 ? data : undefined
        };
    }

    private parseInsertStatement(ast: any): ParsedStatement {
        const columns: string[] = [];
        const values: any[][] = [];

        // INSERT INTO句の解析
        let tableName = '';
        if (ast.table) {
            if (Array.isArray(ast.table)) {
                tableName = ast.table[0]?.table || '';
            } else {
                tableName = ast.table.table || '';
            }
        }

        // カラム名の解析
        if (ast.columns) {
            ast.columns.forEach((col: any) => {
                columns.push(col);
            });
        }

        // VALUES句の解析
        if (ast.values) {
            ast.values.forEach((valueSet: any) => {
                const row: any[] = [];
                if (Array.isArray(valueSet)) {
                    valueSet.forEach((val: any) => {
                        if (val && val.value !== undefined) {
                            row.push(val.value);
                        } else if (typeof val === 'string' || typeof val === 'number') {
                            row.push(val);
                        } else {
                            row.push(val);
                        }
                    });
                }
                if (row.length > 0) {
                    values.push(row);
                }
            });
        }

        return {
            type: 'insert',
            tableName,
            columns,
            values
        };
    }

    private parseUpdateStatement(ast: any): ParsedStatement {
        const columns: string[] = [];
        const data: any[][] = [];

        // UPDATE句の解析
        let tableName = '';
        if (ast.table) {
            if (Array.isArray(ast.table)) {
                tableName = ast.table[0]?.table || '';
            } else {
                tableName = ast.table.table || '';
            }
        }

        // SET句の解析
        if (ast.set) {
            ast.set.forEach((setItem: any) => {
                if (setItem.column) {
                    columns.push(setItem.column);
                    const value = setItem.value?.value || setItem.value;
                    data.push([setItem.column, value]);
                }
            });
        }

        return {
            type: 'update',
            tableName,
            columns,
            data,
            where: ast.where
        };
    }

    private parseDeleteStatement(ast: any): ParsedStatement {
        let tableName = '';
        if (ast.from) {
            if (Array.isArray(ast.from)) {
                tableName = ast.from[0]?.table || '';
            } else {
                tableName = ast.from.table || '';
            }
        }

        return {
            type: 'delete',
            tableName,
            where: ast.where
        };
    }
}
