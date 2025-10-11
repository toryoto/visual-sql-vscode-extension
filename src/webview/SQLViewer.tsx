import React, { useState, useEffect } from 'react';
import { SQLTable } from './SQLTable';

// ParsedSQLData型とParsedStatement型をここで定義
interface ParsedSQLData {
    success: boolean;
    statements: ParsedStatement[];
    error?: string;
    raw: string;
}

interface ParsedStatement {
    type: 'select' | 'insert' | 'update' | 'delete' | 'unknown';
    tableName?: string;
    columns?: string[];
    values?: any[][];
    where?: any;
    set?: any;
    data?: any[][];
}

interface SQLViewerProps {
    vscode: any;
}

export const SQLViewer: React.FC<SQLViewerProps> = ({ vscode }) => {
    const [data, setData] = useState<ParsedSQLData | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        console.log('SQLViewer component mounted');
        
        // メッセージリスナー
        const handleMessage = (event: MessageEvent) => {
            console.log('Message received in webview:', event.data);
            const message = event.data;
            switch (message.type) {
                case 'updateData':
                    console.log('Updating data:', message.data);
                    setData(message.data);
                    setFileName(message.fileName);
                    setLoading(false);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [vscode]);

    const handleCellEdit = (statementIndex: number, rowIndex: number, columnIndex: number, value: any): void => {
        vscode.postMessage({ 
            type: 'cellEdit', 
            statementIndex, 
            rowIndex, 
            columnIndex, 
            value 
        });
    };

    const handleAddRow = (statementIndex: number): void => {
        vscode.postMessage({ 
            type: 'addRow', 
            statementIndex 
        });
    };

    const handleDeleteRow = (statementIndex: number, rowIndex: number): void => {
        vscode.postMessage({ 
            type: 'deleteRow', 
            statementIndex, 
            rowIndex 
        });
    };

    const handleAddColumn = (statementIndex: number): void => {
        vscode.postMessage({ 
            type: 'addColumn', 
            statementIndex 
        });
    };

    const handleDeleteColumn = (statementIndex: number, columnIndex: number): void => {
        vscode.postMessage({ 
            type: 'deleteColumn', 
            statementIndex, 
            columnIndex 
        });
    };

    const handleEditColumnName = (statementIndex: number, columnIndex: number, newName: string): void => {
        vscode.postMessage({ 
            type: 'editColumnName', 
            statementIndex, 
            columnIndex, 
            newName 
        });
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
                {data.statements.length === 0 ? (
                    <div className="info-text">
                        SQLが見つかりませんでした
                    </div>
                ) : (
                    data.statements.map((statement, index) => (
                        <div key={index} className="statement-container">
                            <h4>
                                {statement.type.toUpperCase()}
                                {statement.tableName && ` - ${statement.tableName}`}
                            </h4>
                            <SQLTable
                                statement={statement}
                                onCellEdit={(rowIndex: number, columnIndex: number, value: any) => 
                                    handleCellEdit(index, rowIndex, columnIndex, value)
                                }
                                onAddRow={() => handleAddRow(index)}
                                onDeleteRow={(rowIndex: number) => handleDeleteRow(index, rowIndex)}
                                onAddColumn={() => handleAddColumn(index)}
                                onDeleteColumn={(columnIndex: number) => handleDeleteColumn(index, columnIndex)}
                                onEditColumnName={(columnIndex: number, newName: string) => handleEditColumnName(index, columnIndex, newName)}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};