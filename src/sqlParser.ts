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
        console.log('=== Starting SQL Parse ===');
        console.log('Raw SQL:', sqlContent);
        
        try {
            // SQLを文ごとに分割
            const statements = this.splitSQLStatements(sqlContent);
            console.log('Split into', statements.length, 'statements');
            
            const parsedStatements: ParsedStatement[] = [];

            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                if (statement.trim()) {
                    console.log(`\n--- Parsing statement ${i + 1} ---`);
                    console.log('Statement:', statement);
                    const parsed = this.parseStatement(statement.trim());
                    console.log('Parsed result:', parsed);
                    if (parsed) {
                        parsedStatements.push(parsed);
                    }
                }
            }

            console.log('\n=== Parse Complete ===');
            console.log('Total parsed statements:', parsedStatements.length);
            console.log('Parsed statements:', JSON.stringify(parsedStatements, null, 2));

            return {
                success: true,
                statements: parsedStatements,
                raw: sqlContent
            };
        } catch (error) {
            console.error('=== SQL Parsing Error ===');
            console.error('Error:', error);
            return {
                success: false,
                statements: [],
                error: error instanceof Error ? error.message : 'Unknown error',
                raw: sqlContent
            };
        }
    }

    private splitSQLStatements(sql: string): string[] {
        console.log('Splitting SQL statements...');
        
        // 行ごとに分割してコメントを除去
        const lines = sql.split('\n');
        const cleanedLines: string[] = [];
        
        for (let line of lines) {
            // 行コメント (--) を除去
            const commentIndex = line.indexOf('--');
            if (commentIndex !== -1) {
                line = line.substring(0, commentIndex);
            }
            
            // 空白行でなければ追加
            const trimmed = line.trim();
            if (trimmed) {
                cleanedLines.push(line);
            }
        }
        
        // 1つの文字列に結合
        const cleanedSQL = cleanedLines.join('\n');
        console.log('Cleaned SQL (comments removed):', cleanedSQL);
        
        // セミコロンで分割
        const statements = cleanedSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => {
                // 空文字列を除外
                if (!stmt) return false;
                // ブロックコメントのみの文を除外
                if (stmt.startsWith('/*') && stmt.endsWith('*/')) return false;
                return true;
            });
        
        console.log('Statements after split:', statements);
        return statements;
    }

    private parseStatement(statement: string): ParsedStatement | null {
        try {
            console.log('Calling parser.astify...');
            const ast = this.parser.astify(statement);
            console.log('AST:', JSON.stringify(ast, null, 2));
            
            if (Array.isArray(ast)) {
                console.log('AST is array, processing first element');
                return this.parseAST(ast[0]);
            } else {
                console.log('AST is object, processing directly');
                return this.parseAST(ast);
            }
        } catch (error) {
            console.error('Statement parsing error:', error);
            console.error('Failed statement:', statement);
            return null;
        }
    }

    private parseAST(ast: any): ParsedStatement | null {
        if (!ast || typeof ast !== 'object') {
            console.warn('Invalid AST:', ast);
            return null;
        }

        const type = ast.type?.toLowerCase();
        console.log('AST type:', type);

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
                console.warn('Unknown statement type:', type);
                return {
                    type: 'unknown',
                    data: [['Type', type || 'unknown']]
                };
        }
    }

    private parseSelectStatement(ast: any): ParsedStatement {
        const columns: string[] = [];

        // SELECT句の解析
        if (ast.columns) {
            ast.columns.forEach((col: any) => {
                if (col.expr && col.expr.column) {
                    columns.push(col.expr.column);
                } else if (col.expr && col.expr.type === 'column_ref') {
                    columns.push(col.expr.column);
                } else if (col.as) {
                    columns.push(col.as);
                } else {
                    columns.push('*');
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

        console.log('SELECT parsed:', { tableName, columns });

        return {
            type: 'select',
            tableName,
            columns
        };
    }

    private parseInsertStatement(ast: any): ParsedStatement {
        const columns: string[] = [];
        const values: any[][] = [];

        console.log('INSERT AST full structure:', JSON.stringify(ast, null, 2));

        // INSERT INTO句の解析
        let tableName = '';
        if (ast.table) {
            if (Array.isArray(ast.table)) {
                tableName = ast.table[0]?.table || '';
            } else if (typeof ast.table === 'string') {
                tableName = ast.table;
            } else {
                tableName = ast.table.table || '';
            }
        }

        console.log('Table name:', tableName);

        // カラム名の解析
        if (ast.columns) {
            ast.columns.forEach((col: any) => {
                if (typeof col === 'string') {
                    columns.push(col);
                } else if (col.column) {
                    columns.push(col.column);
                }
            });
        }

        console.log('Columns:', columns);
        console.log('ast.values type:', typeof ast.values);
        console.log('ast.values is array?', Array.isArray(ast.values));
        console.log('ast.values:', ast.values);

        // VALUES句の解析 - 様々なパターンに対応
        if (ast.values) {
            // ast.valuesが配列でない場合（単一のvalues句）
            if (!Array.isArray(ast.values)) {
                console.log('ast.values is not an array, converting...');
                const singleValues = ast.values;
                
                // values.valueが配列の場合
                if (singleValues.value && Array.isArray(singleValues.value)) {
                    const row: any[] = [];
                    singleValues.value.forEach((val: any) => {
                        this.extractValue(val, row);
                    });
                    if (row.length > 0) {
                        values.push(row);
                    }
                }
            } 
            // ast.valuesが配列の場合（複数のvalues句）
            else {
                console.log('ast.values is an array with', ast.values.length, 'items');
                
                ast.values.forEach((valueSet: any, index: number) => {
                    console.log(`Processing value set ${index}:`, JSON.stringify(valueSet, null, 2));
                    const row: any[] = [];
                    
                    // パターン1: valueSet.value が配列
                    if (valueSet.value && Array.isArray(valueSet.value)) {
                        valueSet.value.forEach((val: any) => {
                            this.extractValue(val, row);
                        });
                    } 
                    // パターン2: valueSet.expr が存在
                    else if (valueSet.expr && Array.isArray(valueSet.expr)) {
                        valueSet.expr.forEach((val: any) => {
                            this.extractValue(val, row);
                        });
                    }
                    // パターン3: valueSet自体が配列
                    else if (Array.isArray(valueSet)) {
                        valueSet.forEach((val: any) => {
                            this.extractValue(val, row);
                        });
                    }
                    // パターン4: valueSet.type が 'expr_list'
                    else if (valueSet.type === 'expr_list' && valueSet.value) {
                        valueSet.value.forEach((val: any) => {
                            this.extractValue(val, row);
                        });
                    }
                    
                    console.log(`Row ${index} extracted:`, row);
                    
                    if (row.length > 0) {
                        values.push(row);
                    }
                });
            }
        }

        console.log('INSERT parsed - final values:', values);

        return {
            type: 'insert',
            tableName,
            columns,
            values
        };
    }

    // 値を抽出するヘルパーメソッド
    private extractValue(val: any, row: any[]): void {
        if (val === null || val === undefined) {
            row.push(null);
        } else if (val.value !== undefined) {
            row.push(val.value);
        } else if (val.type === 'single_quote_string' || val.type === 'double_quote_string') {
            row.push(val.value);
        } else if (val.type === 'number') {
            row.push(val.value);
        } else if (val.type === 'bool') {
            row.push(val.value);
        } else if (val.type === 'null') {
            row.push(null);
        } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
            row.push(val);
        } else {
            console.warn('Unknown value type:', val);
            row.push(String(val));
        }
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
                    const value = setItem.value?.value !== undefined ? setItem.value.value : setItem.value;
                    data.push([setItem.column, value]);
                }
            });
        }

        console.log('UPDATE parsed:', { tableName, columns, data });

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

        console.log('DELETE parsed:', { tableName });

        return {
            type: 'delete',
            tableName,
            where: ast.where
        };
    }
}