import React, { useState, useEffect, useCallback } from 'react';
import { SQLTable } from './SQLTable';

type ColumnType = 'string' | 'number' | 'boolean' | 'null';

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
    columnTypes?: ColumnType[];
    values?: any[][];
    where?: any;
    set?: any;
    data?: any[][];
}

interface SQLViewerProps {
    vscode: any;
}

interface QueryResult {
    columns: string[];
    rows: any[][];
    rowCount: number;
    executionTimeMs: number;
}

interface QueryState {
    executing: boolean;
    result?: QueryResult;
    error?: {
        message: string;
        code?: string;
        detail?: string;
    };
}

export const SQLViewer: React.FC<SQLViewerProps> = ({ vscode }) => {
    const [data, setData] = useState<ParsedSQLData | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [validationErrors, setValidationErrors] = useState<Map<number, string>>(new Map());
    const [queryStates, setQueryStates] = useState<Map<number, QueryState>>(new Map());

    useEffect(() => {
        // メッセージリスナー
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'updateData') {
                setData(message.data);
                setFileName(message.fileName);
                setLoading(false);
            } else if (message.type === 'whereValidationError') {
                setValidationErrors(prev => {
                    const newErrors = new Map(prev);
                    newErrors.set(message.statementIndex, message.error);
                    return newErrors;
                });
            } else if (message.type === 'whereValidationSuccess') {
                setValidationErrors(prev => {
                    const newErrors = new Map(prev);
                    newErrors.delete(message.statementIndex);
                    return newErrors;
                });
            } else if (message.type === 'queryExecutionStart') {
                setQueryStates(prev => {
                    const newStates = new Map(prev);
                    newStates.set(message.statementIndex, { executing: true });
                    return newStates;
                });
            } else if (message.type === 'queryExecutionSuccess') {
                setQueryStates(prev => {
                    const newStates = new Map(prev);
                    newStates.set(message.statementIndex, {
                        executing: false,
                        result: message.result
                    });
                    return newStates;
                });
            } else if (message.type === 'queryExecutionError') {
                setQueryStates(prev => {
                    const newStates = new Map(prev);
                    newStates.set(message.statementIndex, {
                        executing: false,
                        error: message.error
                    });
                    return newStates;
                });
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

    const handleChangeColumnType = useCallback((statementIndex: number, columnIndex: number, columnType: ColumnType): void => {
        vscode.postMessage({ 
            type: 'changeColumnType', 
            statementIndex, 
            columnIndex, 
            columnType 
        });
    }, [vscode]);

    const handleReload = useCallback(() => {
        vscode.postMessage({
            type: 'reload'
        });
    }, [vscode]);

    const handleExecuteQuery = useCallback((statementIndex: number, sql: string): void => {
        vscode.postMessage({
            type: 'executeQuery',
            statementIndex,
            sql
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
                    <div className="header-content">
                        <div>
                            <h3>Visual SQL</h3>
                            <div>SQLファイルを開いてください</div>
                        </div>
                        <button onClick={handleReload} className="reload-btn" title="リロード">
                            ⟳
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!data.success) {
        return (
            <div className="container">
                <div className="header">
                    <div className="header-content">
                        <div>
                            <h3>Visual SQL</h3>
                            <div>ファイル: {fileName.split('/').pop()}</div>
                        </div>
                        <button onClick={handleReload} className="reload-btn" title="リロード">
                            ⟳
                        </button>
                    </div>
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
                <div className="header-content">
                    <div>
                        <h3>Visual SQL</h3>
                        <div>ファイル: {fileName.split('/').pop()}</div>
                    </div>
                    <button onClick={handleReload} className="reload-btn" title="リロード">
                        ⟳
                    </button>
                </div>
            </div>
            <div className="content">
                {data.statements.length === 0 ? (
                    <div className="info-text">
                        SQLが見つかりませんでした
                    </div>
                ) : (
                    data.statements.map((statement, index) => {
                        // 現在のステートメントのSQLを取得（生のSQLから抽出）
                        const statementSQL = data.raw.split(';')[index]?.trim() || '';

                        return (
                            <div key={index} className="statement-container">
                                <h4>
                                    {statement.type.toUpperCase()}
                                    {statement.tableName && ` - ${statement.tableName}`}
                                </h4>
                                <SQLTable
                                    statement={statement}
                                    statementSQL={statementSQL}
                                    onCellEdit={(rowIndex: number, columnIndex: number, value: any) =>
                                        handleCellEdit(index, rowIndex, columnIndex, value)
                                    }
                                    onAddRow={() => handleAddRow(index)}
                                    onDeleteRow={(rowIndex: number) => handleDeleteRow(index, rowIndex)}
                                    onAddColumn={() => handleAddColumn(index)}
                                    onDeleteColumn={(columnIndex: number) => handleDeleteColumn(index, columnIndex)}
                                    onEditColumnName={(columnIndex: number, newName: string) => handleEditColumnName(index, columnIndex, newName)}
                                    onEditWhere={(whereClause: string) => handleEditWhere(index, whereClause)}
                                    onChangeColumnType={(columnIndex: number, columnType: ColumnType) => handleChangeColumnType(index, columnIndex, columnType)}
                                    onExecuteQuery={(sql: string) => handleExecuteQuery(index, sql)}
                                    validationError={validationErrors.get(index)}
                                    queryState={queryStates.get(index)}
                                />
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};