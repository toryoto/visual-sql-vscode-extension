import React, { useState, useEffect, useCallback } from 'react';
import { SQLTable } from './SQLTable';

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
        // メッセージリスナー
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'updateData') {
                setData(message.data);
                setFileName(message.fileName);
                setLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    // useCallbackでメモ化してパフォーマンスを向上
    const handleCellEdit = useCallback((statementIndex: number, rowIndex: number, columnIndex: number, value: any): void => {
        vscode.postMessage({ 
            type: 'cellEdit', 
            statementIndex, 
            rowIndex, 
            columnIndex, 
            value 
        });
    }, [vscode]);

    const handleAddRow = useCallback((statementIndex: number): void => {
        vscode.postMessage({ 
            type: 'addRow', 
            statementIndex 
        });
    }, [vscode]);

    const handleDeleteRow = useCallback((statementIndex: number, rowIndex: number): void => {
        vscode.postMessage({ 
            type: 'deleteRow', 
            statementIndex, 
            rowIndex 
        });
    }, [vscode]);

    const handleAddColumn = useCallback((statementIndex: number): void => {
        vscode.postMessage({ 
            type: 'addColumn', 
            statementIndex 
        });
    }, [vscode]);

    const handleDeleteColumn = useCallback((statementIndex: number, columnIndex: number): void => {
        vscode.postMessage({ 
            type: 'deleteColumn', 
            statementIndex, 
            columnIndex 
        });
    }, [vscode]);

    const handleEditColumnName = useCallback((statementIndex: number, columnIndex: number, newName: string): void => {
        vscode.postMessage({ 
            type: 'editColumnName', 
            statementIndex, 
            columnIndex, 
            newName 
        });
    }, [vscode]);

    const handleEditWhere = useCallback((statementIndex: number, whereClause: string): void => {
        vscode.postMessage({ 
            type: 'editWhere', 
            statementIndex, 
            whereClause 
        });
    }, [vscode]);

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
                    <h3>Visual SQL</h3>
                    <div>SQLファイルを開いてください</div>
                </div>
            </div>
        );
    }

    if (!data.success) {
        return (
            <div className="container">
                <div className="header">
                    <h3>Visual SQL</h3>
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
                <h3>Visual SQL</h3>
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
                                onEditWhere={(whereClause: string) => handleEditWhere(index, whereClause)}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};