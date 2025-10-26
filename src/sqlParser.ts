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
            const statements = this.splitSQLStatements(sqlContent);
            const parsedStatements: ParsedStatement[] = [];

            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
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
            // エラー時のみログ出力
            console.error('SQL Parsing Error:', error);
            return {
                success: false,
                statements: [],
                error: error instanceof Error ? error.message : 'Unknown error',
                raw: sqlContent
            };
        }
    }

    private splitSQLStatements(sql: string): string[] {
        // ブロックコメント /* */ を除去
        let cleanedSQL = sql.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // 行ごとに分割して行コメントを除去
        const lines = cleanedSQL.split('\n');
        const cleanedLines = lines
            .map(line => {
                const commentIndex = line.indexOf('--');
                return commentIndex !== -1 ? line.substring(0, commentIndex) : line;
            })
            .filter(line => line.trim());
        
        // 1つの文字列に結合
        cleanedSQL = cleanedLines.join('\n');
        
        // セミコロンで分割
        const statements = cleanedSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt);
        
        return statements;
    }

    private parseStatement(statement: string): ParsedStatement | null {
        try {
            const ast = this.parser.astify(statement);
            
            if (Array.isArray(ast)) {
                return this.parseAST(ast[0]);
            } else {
                return this.parseAST(ast);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // カラム数と値の数の不一致エラーの場合、特別な処理を行う
            if (errorMessage.includes('column count doesn\'t match value count')) {
                return this.handleColumnCountMismatchError(statement, errorMessage);
            }
            
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

        return {
            type: 'select',
            tableName,
            columns
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
            } else if (typeof ast.table === 'string') {
                tableName = ast.table;
            } else {
                tableName = ast.table.table || '';
            }
        }

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

        // VALUES句の解析
        if (ast.values) {
            if (!Array.isArray(ast.values)) {
                const singleValues = ast.values;
                
                if (singleValues.type === 'values' && singleValues.values && Array.isArray(singleValues.values)) {
                    singleValues.values.forEach((valueSet: any) => {
                        const row: any[] = [];
                        
                        if (valueSet.value && Array.isArray(valueSet.value)) {
                            valueSet.value.forEach((val: any) => {
                                this.extractValue(val, row);
                            });
                        } else if (valueSet.expr && Array.isArray(valueSet.expr)) {
                            valueSet.expr.forEach((val: any) => {
                                this.extractValue(val, row);
                            });
                        } else if (Array.isArray(valueSet)) {
                            valueSet.forEach((val: any) => {
                                this.extractValue(val, row);
                            });
                        } else if (valueSet.type === 'expr_list' && valueSet.value) {
                            valueSet.value.forEach((val: any) => {
                                this.extractValue(val, row);
                            });
                        }
                        
                        if (row.length > 0) {
                            values.push(row);
                        }
                    });
                } else if (singleValues.value && Array.isArray(singleValues.value)) {
                    const row: any[] = [];
                    singleValues.value.forEach((val: any) => {
                        this.extractValue(val, row);
                    });
                    if (row.length > 0) {
                        values.push(row);
                    }
                }
            } else {
                ast.values.forEach((valueSet: any) => {
                    const row: any[] = [];
                    
                    if (valueSet.value && Array.isArray(valueSet.value)) {
                        valueSet.value.forEach((val: any) => {
                            this.extractValue(val, row);
                        });
                    } else if (valueSet.expr && Array.isArray(valueSet.expr)) {
                        valueSet.expr.forEach((val: any) => {
                            this.extractValue(val, row);
                        });
                    } else if (Array.isArray(valueSet)) {
                        valueSet.forEach((val: any) => {
                            this.extractValue(val, row);
                        });
                    } else if (valueSet.type === 'expr_list' && valueSet.value) {
                        valueSet.value.forEach((val: any) => {
                            this.extractValue(val, row);
                        });
                    }
                    
                    if (row.length > 0) {
                        values.push(row);
                    }
                });
            }
        }

        // データの整合性をチェックして修正
        const validatedValues = this.validateAndFixInsertData(columns, values);

        return {
            type: 'insert',
            tableName,
            columns,
            values: validatedValues
        };
    }

    // 値を抽出するヘルパーメソッド
    private extractValue(val: any, row: any[]): void {
        if (val === null || val === undefined) {
            row.push(null);
        } else if (val.type === 'bool') {
            // boolean型の処理
            const boolValue = val.value === true || val.value === 'true' || val.value === 'TRUE' || val.value === 1;
            row.push(boolValue);
        } else if (val.value !== undefined) {
            row.push(val.value);
        } else if (val.type === 'single_quote_string' || val.type === 'double_quote_string') {
            row.push(val.value || '');
        } else if (val.type === 'number') {
            row.push(val.value);
        } else if (val.type === 'null') {
            row.push(null);
        } else if (typeof val === 'string' || typeof val === 'number') {
            row.push(val);
        } else if (typeof val === 'boolean') {
            row.push(val);
        } else {
            row.push(String(val));
        }
    }

    // INSERT文のデータ整合性をチェックして修正する
    private validateAndFixInsertData(columns: string[], values: any[][]): any[][] {
        const expectedColumnCount = columns.length;
        
        const validatedValues = values.map((row) => {
            const currentValueCount = row.length;
            
            if (currentValueCount === expectedColumnCount) {
                return row;
            } else if (currentValueCount > expectedColumnCount) {
                return row.slice(0, expectedColumnCount);
            } else {
                const paddedRow = [...row];
                while (paddedRow.length < expectedColumnCount) {
                    paddedRow.push('');
                }
                return paddedRow;
            }
        });
        
        return validatedValues;
    }

    // カラム数不一致エラーを処理する
    private handleColumnCountMismatchError(statement: string, errorMessage: string): ParsedStatement | null {
        try {
            const insertMatch = statement.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*(.+)/is);
            if (!insertMatch) {
                return null;
            }

            const tableName = insertMatch[1];
            const columnsStr = insertMatch[2];
            const valuesStr = insertMatch[3];

            const columns = columnsStr.split(',').map(col => col.trim().replace(/['"]/g, ''));
            const values = this.extractValuesFromString(valuesStr);
            const validatedValues = this.validateAndFixInsertData(columns, values);

            return {
                type: 'insert',
                tableName,
                columns,
                values: validatedValues
            };
        } catch (error) {
            return null;
        }
    }

    // VALUES句の文字列から行データを抽出する
    private extractValuesFromString(valuesStr: string): any[][] {
        const rows: any[][] = [];
        
        const rowMatches = valuesStr.match(/\([^)]+\)/g);
        if (!rowMatches) {
            return rows;
        }

        rowMatches.forEach((rowStr) => {
            const cleanRowStr = rowStr.slice(1, -1);
            const values = this.splitValueString(cleanRowStr);
            rows.push(values);
        });

        return rows;
    }

    // 値の文字列を分割する（文字列内のカンマを考慮）
    private splitValueString(valueStr: string): any[] {
        const values: any[] = [];
        let currentValue = '';
        let inString = false;
        let stringChar = '';
        let i = 0;

        while (i < valueStr.length) {
            const char = valueStr[i];

            if (!inString) {
                if (char === '\'' || char === '"') {
                    inString = true;
                    stringChar = char;
                    currentValue += char;
                } else if (char === ',') {
                    values.push(this.cleanValue(currentValue.trim()));
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            } else {
                currentValue += char;
                if (char === stringChar) {
                    if (i + 1 < valueStr.length && valueStr[i + 1] === stringChar) {
                        currentValue += valueStr[i + 1];
                        i++;
                    } else {
                        inString = false;
                        stringChar = '';
                    }
                }
            }
            i++;
        }

        if (currentValue.trim()) {
            values.push(this.cleanValue(currentValue.trim()));
        }

        return values;
    }

    // 値をクリーンアップする（クォートの除去、型変換など）
    private cleanValue(value: string): any {
        if (!value) {
            return '';
        }

        // 文字列値（シングルクォートまたはダブルクォートで囲まれている）
        if ((value.startsWith('\'') && value.endsWith('\'')) || 
            (value.startsWith('"') && value.endsWith('"'))) {
            return value.slice(1, -1);
        }

        // Boolean値の処理
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'true') {
            return true;
        }
        if (lowerValue === 'false') {
            return false;
        }

        // 数値
        if (!isNaN(Number(value)) && value.trim() !== '') {
            return Number(value);
        }

        // NULL
        if (value.toUpperCase() === 'NULL') {
            return null;
        }

        return value;
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