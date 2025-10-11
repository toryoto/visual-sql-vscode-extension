import React, { useState, useEffect } from 'react';
import { ParsedSQLData, ParsedStatement } from '../sqlParser';
import { SQLTable } from './SQLTable';

interface SQLViewerProps {
    vscode: any;
}

export const SQLViewer: React.FC<SQLViewerProps> = ({ vscode }) => {
    const [data, setData] = useState<ParsedSQLData | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        // メッセージリスナー
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'updateData':
                    setData(message.data);
                    setFileName(message.fileName);
                    setLoading(false);
                    break;
                case 'currentSQL':
                    // 現在のSQLを取得
                    break;
            }
        };

        window.addEventListener('message', handleMessage);

        // 初期化時に現在のSQLを取得
        vscode.postMessage({ type: 'getCurrentSQL' });

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [vscode]);

    const handleCellEdit = (statementIndex: number, rowIndex: number, columnIndex: number, value: any): void => {
        if (!data || !data.success) return;

        const newData = { ...data };
        const statement = newData.statements[statementIndex];

        if (statement.type === 'insert' && statement.values) {
            if (statement.values[rowIndex]) {
                statement.values[rowIndex][columnIndex] = value;
            }
        } else if (statement.type === 'update' && statement.data) {
            if (statement.data[rowIndex]) {
                statement.data[rowIndex][columnIndex] = value;
            }
        }

        setData(newData);
        
        // SQLファイルを更新
        const newSQL = generateSQLFromData(newData);
        vscode.postMessage({ type: 'updateSQL', sql: newSQL });
    };

    const handleAddRow = (statementIndex: number): void => {
        if (!data || !data.success) return;

        const newData = { ...data };
        const statement = newData.statements[statementIndex];

        if (statement.type === 'insert' && statement.columns) {
            const newRow = new Array(statement.columns.length).fill('');
            if (!statement.values) {
                statement.values = [];
            }
            statement.values.push(newRow);
        } else if (statement.type === 'update' && statement.columns) {
            const newRow = [statement.columns[0] || '', ''];
            if (!statement.data) {
                statement.data = [];
            }
            statement.data.push(newRow);
        }

        setData(newData);
        
        // SQLファイルを更新
        const newSQL = generateSQLFromData(newData);
        vscode.postMessage({ type: 'updateSQL', sql: newSQL });
    };

    const handleDeleteRow = (statementIndex: number, rowIndex: number): void => {
        if (!data || !data.success) return;

        const newData = { ...data };
        const statement = newData.statements[statementIndex];

        if (statement.type === 'insert' && statement.values) {
            statement.values.splice(rowIndex, 1);
        } else if (statement.type === 'update' && statement.data) {
            statement.data.splice(rowIndex, 1);
        }

        setData(newData);
        
        // SQLファイルを更新
        const newSQL = generateSQLFromData(newData);
        vscode.postMessage({ type: 'updateSQL', sql: newSQL });
    };

    if (loading) {
        return (
            <div className="loading">
                SQLファイルを開いてください
            </div>
        );
    }

    if (!data) {
        return (
            <div className="container">
                <div className="header">
                    <h3>SQL Viewer</h3>
                    <div>SQLファイルを開いてください</div>
                </div>
            </div>
        );
    }

    if (!data.success) {
        return (
            <div className="container">
                <div className="header">
                    <h3>SQL Viewer</h3>
                    <div>ファイル: {fileName.split('/').pop()}</div>
                </div>
                <div className="content">
                    <div className="error">
                        <strong>SQL解析エラー:</strong><br />
                        {data.error}
                    </div>
                    <pre>{data.raw}</pre>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="header">
                <h3>SQL Viewer</h3>
                <div>ファイル: {fileName.split('/').pop()}</div>
            </div>
            <div className="content">
                {data.statements.map((statement, index) => (
                    <div key={index} className="statement-container">
                        <h4>
                            {statement.type.toUpperCase()}文
                            {statement.tableName && ` - ${statement.tableName}`}
                        </h4>
                        <SQLTable
                            statement={statement}
                            onCellEdit={(rowIndex: number, columnIndex: number, value: any) => 
                                handleCellEdit(index, rowIndex, columnIndex, value)
                            }
                            onAddRow={() => handleAddRow(index)}
                            onDeleteRow={(rowIndex: number) => handleDeleteRow(index, rowIndex)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

// SQLデータからSQL文を生成する関数
function generateSQLFromData(data: ParsedSQLData): string {
    if (!data.success) return data.raw;

    return data.statements.map(statement => {
        switch (statement.type) {
            case 'insert':
                if (statement.tableName && statement.columns && statement.values) {
                    const columnsStr = statement.columns.join(', ');
                    const valuesStr = statement.values.map(row => 
                        `(${row.map(val => typeof val === 'string' ? `'${val}'` : val).join(', ')})`
                    ).join(',\n  ');
                    return `INSERT INTO ${statement.tableName} (${columnsStr})\nVALUES\n  ${valuesStr};`;
                }
                break;
            case 'update':
                if (statement.tableName && statement.data) {
                    const setClause = statement.data.map(([col, val]) => 
                        `${col} = ${typeof val === 'string' ? `'${val}'` : val}`
                    ).join(', ');
                    return `UPDATE ${statement.tableName}\nSET ${setClause};`;
                }
                break;
            case 'select':
                if (statement.tableName && statement.columns) {
                    const columnsStr = statement.columns.join(', ');
                    return `SELECT ${columnsStr}\nFROM ${statement.tableName};`;
                }
                break;
        }
        return '';
    }).filter(sql => sql).join('\n\n');
}
