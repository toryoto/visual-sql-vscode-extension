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
        console.log('Cleaned SQL (comments removed):', cleanedSQL);
        
        // セミコロンで分割
        const statements = cleanedSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt);
        
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
            
            // エラーメッセージから詳細を抽出
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // カラム数と値の数の不一致エラーの場合、特別な処理を行う
            if (errorMessage.includes('column count doesn\'t match value count')) {
                console.log('Detected column count mismatch error, attempting to fix...');
                return this.handleColumnCountMismatchError(statement, errorMessage);
            }
            
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
                
                // パターン1: ast.values.type === 'values' で ast.values.values が配列
                if (singleValues.type === 'values' && singleValues.values && Array.isArray(singleValues.values)) {
                    console.log('Processing ast.values.values array with', singleValues.values.length, 'items');
                    singleValues.values.forEach((valueSet: any, index: number) => {
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
                // パターン2: values.valueが配列の場合（古い形式のサポート）
                else if (singleValues.value && Array.isArray(singleValues.value)) {
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

        // データの整合性をチェックして修正
        const validatedValues = this.validateAndFixInsertData(columns, values);
        console.log('INSERT validated values:', validatedValues);

        return {
            type: 'insert',
            tableName,
            columns,
            values: validatedValues
        };
    }

    // 値を抽出するヘルパーメソッド
    private extractValue(val: any, row: any[]): void {
        console.log('Extracting value:', val);
        
        if (val === null || val === undefined) {
            row.push(null);
        } else if (val.type === 'bool') {
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
            console.warn('Unknown value type:', val);
            row.push(String(val));
        }
    }

    // INSERT文のデータ整合性をチェックして修正する
    private validateAndFixInsertData(columns: string[], values: any[][]): any[][] {
        const expectedColumnCount = columns.length;
        console.log(`Validating INSERT data: expected ${expectedColumnCount} columns`);
        
        const validatedValues = values.map((row, rowIndex) => {
            const currentValueCount = row.length;
            console.log(`Row ${rowIndex}: has ${currentValueCount} values, expected ${expectedColumnCount}`);
            
            if (currentValueCount === expectedColumnCount) {
                // カラム数が一致している場合、そのまま返す
                return row;
            } else if (currentValueCount > expectedColumnCount) {
                // 値が多すぎる場合、余分な値を削除
                console.warn(`Row ${rowIndex}: too many values (${currentValueCount}), trimming to ${expectedColumnCount}`);
                return row.slice(0, expectedColumnCount);
            } else {
                // 値が少なすぎる場合、不足分を空文字で埋める
                console.warn(`Row ${rowIndex}: too few values (${currentValueCount}), padding with empty strings to ${expectedColumnCount}`);
                const paddedRow = [...row];
                while (paddedRow.length < expectedColumnCount) {
                    paddedRow.push('');
                }
                return paddedRow;
            }
        });
        
        console.log('Validated values:', validatedValues);
        return validatedValues;
    }

    // カラム数不一致エラーを処理する
    private handleColumnCountMismatchError(statement: string, errorMessage: string): ParsedStatement | null {
        console.log('Attempting to parse INSERT statement with column count mismatch...');
        
        try {
            // INSERT文の基本的な構造を正規表現で抽出
            const insertMatch = statement.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*(.+)/is);
            if (!insertMatch) {
                console.error('Could not parse INSERT statement structure');
                return null;
            }

            const tableName = insertMatch[1];
            const columnsStr = insertMatch[2];
            const valuesStr = insertMatch[3];

            // カラム名を抽出
            const columns = columnsStr.split(',').map(col => col.trim().replace(/['"]/g, ''));
            console.log('Extracted columns:', columns);

            // VALUES句を解析して行データを抽出
            const values = this.extractValuesFromString(valuesStr);
            console.log('Extracted values:', values);

            // データの整合性をチェックして修正
            const validatedValues = this.validateAndFixInsertData(columns, values);

            return {
                type: 'insert',
                tableName,
                columns,
                values: validatedValues
            };
        } catch (error) {
            console.error('Failed to handle column count mismatch error:', error);
            return null;
        }
    }

    // VALUES句の文字列から行データを抽出する
    private extractValuesFromString(valuesStr: string): any[][] {
        const rows: any[][] = [];
        
        // VALUES句内の各行を抽出（括弧で囲まれた部分）
        const rowMatches = valuesStr.match(/\([^)]+\)/g);
        if (!rowMatches) {
            console.error('No value rows found in VALUES clause');
            return rows;
        }

        rowMatches.forEach((rowStr, index) => {
            console.log(`Processing row ${index}: ${rowStr}`);
            
            // 括弧を除去
            const cleanRowStr = rowStr.slice(1, -1);
            
            // カンマで分割（ただし、文字列内のカンマは除外）
            const values = this.splitValueString(cleanRowStr);
            console.log(`Row ${index} values:`, values);
            
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
                    // エスケープされたクォートかチェック
                    if (i + 1 < valueStr.length && valueStr[i + 1] === stringChar) {
                        currentValue += valueStr[i + 1];
                        i++; // 次の文字をスキップ
                    } else {
                        inString = false;
                        stringChar = '';
                    }
                }
            }
            i++;
        }

        // 最後の値を追加
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

        // その他は文字列として返す
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