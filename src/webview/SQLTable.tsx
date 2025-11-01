import React, { useState, useCallback, useEffect } from 'react';

interface ParsedStatement {
    type: 'select' | 'insert' | 'update' | 'delete' | 'unknown';
    tableName?: string;
    columns?: string[];
    values?: any[][];
    where?: any;
    set?: any;
    data?: any[][];
}

interface SQLTableProps {
    statement: ParsedStatement;
    onCellEdit: (rowIndex: number, columnIndex: number, value: any) => void;
    onAddRow: () => void;
    onDeleteRow: (rowIndex: number) => void;
    onAddColumn: () => void;
    onDeleteColumn: (columnIndex: number) => void;
    onEditColumnName: (columnIndex: number, newName: string) => void;
    onEditWhere: (whereClause: string) => void;
    validationError?: string;
}

// 値を表示用の文字列に変換するヘルパー関数
const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) {
        return 'NULL';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    return String(value);
};

export const SQLTable: React.FC<SQLTableProps> = React.memo(({ 
    statement, 
    onCellEdit, 
    onAddRow, 
    onDeleteRow,
    onAddColumn,
    onDeleteColumn,
    onEditColumnName,
    onEditWhere,
    validationError
}) => {
    const [editingCell, setEditingCell] = useState<{row: number, col: number} | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [editingColumn, setEditingColumn] = useState<number | null>(null);
    const [editColumnValue, setEditColumnValue] = useState<string>('');
    const [editingWhere, setEditingWhere] = useState<boolean>(false);
    const [whereValue, setWhereValue] = useState<string>('');
    const [whereError, setWhereError] = useState<string>('');
    const [showWhereError, setShowWhereError] = useState<boolean>(false);

    // 外部からのバリデーションエラーを反映
    useEffect(() => {
        if (validationError) {
            setWhereError(validationError);
            setShowWhereError(true);
        } else {
            setShowWhereError(false);
        }
    }, [validationError]);

    const handleCellClick = useCallback((rowIndex: number, colIndex: number, currentValue: any) => {
        setEditingCell({ row: rowIndex, col: colIndex });
        setEditValue(formatCellValue(currentValue));
    }, []);

    const handleCellSave = useCallback(() => {
        if (editingCell) {
            onCellEdit(editingCell.row, editingCell.col, editValue);
            setEditingCell(null);
            setEditValue('');
        }
    }, [editingCell, editValue, onCellEdit]);

    const handleCellCancel = useCallback(() => {
        setEditingCell(null);
        setEditValue('');
    }, []);

    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCellSave();
        } else if (e.key === 'Escape') {
            handleCellCancel();
        }
    }, [handleCellSave, handleCellCancel]);

    const handleColumnClick = useCallback((columnIndex: number, currentName: string) => {
        setEditingColumn(columnIndex);
        setEditColumnValue(currentName);
    }, []);

    const handleColumnSave = useCallback(() => {
        if (editingColumn !== null) {
            onEditColumnName(editingColumn, editColumnValue);
            setEditingColumn(null);
            setEditColumnValue('');
        }
    }, [editingColumn, editColumnValue, onEditColumnName]);

    const handleColumnCancel = useCallback(() => {
        setEditingColumn(null);
        setEditColumnValue('');
    }, []);

    const handleColumnKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleColumnSave();
        } else if (e.key === 'Escape') {
            handleColumnCancel();
        }
    }, [handleColumnSave, handleColumnCancel]);

    const handleWhereClick = useCallback(() => {
        setEditingWhere(true);
        setWhereValue(statement.where ? String(statement.where) : '');
        setWhereError('');
        setShowWhereError(false);
    }, [statement.where]);

    const handleWhereSave = useCallback(() => {
        // 空の場合はそのまま保存
        if (!whereValue.trim()) {
            onEditWhere(whereValue.trim());
            setEditingWhere(false);
            setWhereError('');
            setShowWhereError(false);
            return;
        }

        // バリデーション要求をVSCodeに送信
        // 一時的に保存してバリデーション結果を待つ
        onEditWhere(whereValue);
        setEditingWhere(false);
    }, [whereValue, onEditWhere]);

    const handleWhereCancel = useCallback(() => {
        setEditingWhere(false);
        setWhereValue('');
        setWhereError('');
        setShowWhereError(false);
    }, []);

    const handleWhereKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleWhereSave();
        } else if (e.key === 'Escape') {
            handleWhereCancel();
        }
    }, [handleWhereSave, handleWhereCancel]);

    const renderTable = () => {
        switch (statement.type) {
            case 'insert':
                return renderInsertTable();
            case 'update':
                return renderUpdateTable();
            case 'select':
                return renderSelectTable();
            case 'delete':
                return renderDeleteTable();
            default:
                return <div>未対応のSQLタイプ: {statement.type}</div>;
        }
    };

    const renderInsertTable = () => {
        if (!statement.columns || !statement.values) {
            return <div>INSERTのデータがありません</div>;
        }

        return (
            <div className="table-container">
                <table className="sql-table">
                    <thead>
                        <tr>
                            {statement.columns.map((col, index) => (
                                <th key={index} className="editable-cell" style={{ position: 'relative' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {editingColumn === index ? (
                                            <input
                                                type="text"
                                                value={editColumnValue}
                                                onChange={(e) => setEditColumnValue(e.target.value)}
                                                onBlur={handleColumnSave}
                                                onKeyDown={handleColumnKeyPress}
                                                autoFocus
                                                className="cell-input"
                                                style={{ flex: 1 }}
                                            />
                                        ) : (
                                            <div 
                                                onClick={() => handleColumnClick(index, col)}
                                                style={{ cursor: 'pointer', flex: 1 }}
                                                title="クリックしてカラム名を編集"
                                            >
                                                {col}
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => onDeleteColumn(index)}
                                            className="column-delete-btn"
                                            title="カラムを削除"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </th>
                            ))}
                            <th style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                    <button 
                                        onClick={onAddColumn}
                                        className="add-row-btn"
                                        title="カラムを追加"
                                        style={{ fontSize: '12px' }}
                                    >
                                        + カラム
                                    </button>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {statement.values.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {row.map((cell, colIndex) => (
                                    <td 
                                        key={colIndex}
                                        className="editable-cell"
                                        onClick={() => handleCellClick(rowIndex, colIndex, cell)}
                                    >
                                        {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={handleCellSave}
                                                onKeyDown={handleKeyPress}
                                                autoFocus
                                                className="cell-input"
                                            />
                                        ) : (
                                            formatCellValue(cell)
                                        )}
                                    </td>
                                ))}
                                <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                        <button 
                                            onClick={() => onDeleteRow(rowIndex)}
                                            className="column-delete-btn"
                                            title="行を削除"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={onAddRow} className="add-row-btn">
                    + 行を追加
                </button>
            </div>
        );
    };

    const renderUpdateTable = () => {
        if (!statement.data) {
            return <div>UPDATEのデータがありません</div>;
        }

        return (
            <>
                <div className="info-text" style={{ marginBottom: '10px' }}>
                    UPDATE文: テーブル <strong>{statement.tableName}</strong> のデータを更新します
                </div>
                <div className="table-container">
                    <table className="sql-table">
                        <thead>
                            <tr>
                                <th>カラム</th>
                                <th>値</th>
                                <th style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                        <button 
                                            onClick={onAddColumn}
                                            className="add-row-btn"
                                            title="カラムを追加"
                                            style={{ fontSize: '12px' }}
                                        >
                                            + カラム
                                        </button>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {statement.data.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    <td 
                                        className="editable-cell"
                                        onClick={() => handleCellClick(rowIndex, 0, row[0])}
                                    >
                                        {editingCell?.row === rowIndex && editingCell?.col === 0 ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={handleCellSave}
                                                onKeyDown={handleKeyPress}
                                                autoFocus
                                                className="cell-input"
                                            />
                                        ) : (
                                            formatCellValue(row[0])
                                        )}
                                    </td>
                                    <td 
                                        className="editable-cell"
                                        onClick={() => handleCellClick(rowIndex, 1, row[1])}
                                    >
                                        {editingCell?.row === rowIndex && editingCell?.col === 1 ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={handleCellSave}
                                                onKeyDown={handleKeyPress}
                                                autoFocus
                                                className="cell-input"
                                            />
                                        ) : (
                                            formatCellValue(row[1])
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                            <button 
                                                onClick={() => onDeleteRow(rowIndex)}
                                                className="column-delete-btn"
                                                title="行を削除"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={onAddRow} className="add-row-btn">
                        + 行を追加
                    </button>
                </div>
                {renderWhereClause()}
            </>
        );
    };

    const renderSelectTable = () => {
        if (!statement.columns) {
            return <div>SELECTのカラム情報がありません</div>;
        }

        return (
            <div className="table-container">
                <table className="sql-table">
                    <thead>
                        <tr>
                            <th>カラム名</th>
                        </tr>
                    </thead>
                    <tbody>
                        {statement.columns.map((col, index) => (
                            <tr key={index}>
                                <td>{col}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="info-text">
                    SELECTは読み取り専用です
                </div>
            </div>
        );
    };

    const renderDeleteTable = () => {
        return (
            <>
                <div className="info-text" style={{ marginBottom: '10px' }}>
                    DELETE文: テーブル <strong>{statement.tableName}</strong> からデータを削除します
                </div>
                {renderWhereClause()}
            </>
        );
    };

    const renderWhereClause = () => {
        const hasError = showWhereError && whereError;
        
        return (
            <div style={{ 
                marginTop: '15px', 
                padding: '10px', 
                border: hasError ? '2px solid var(--vscode-inputValidation-errorBorder)' : '1px solid var(--vscode-panel-border)', 
                borderRadius: '4px',
                backgroundColor: hasError ? 'var(--vscode-inputValidation-errorBackground)' : 'transparent'
            }}>
                <div style={{ 
                    marginBottom: '8px', 
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    WHERE句:
                    {hasError && (
                        <span style={{ 
                            color: 'var(--vscode-errorForeground)',
                            fontSize: '12px',
                            fontWeight: 'normal'
                        }}>
                            ⚠️ 構文エラー
                        </span>
                    )}
                </div>
                {editingWhere ? (
                    <>
                        <input
                            type="text"
                            value={whereValue}
                            onChange={(e) => setWhereValue(e.target.value)}
                            onBlur={handleWhereSave}
                            onKeyDown={handleWhereKeyPress}
                            autoFocus
                            className="cell-input"
                            placeholder="例: id = 1 または age > 25"
                            style={{ 
                                width: '100%', 
                                padding: '4px',
                                borderColor: whereError ? 'var(--vscode-inputValidation-errorBorder)' : undefined
                            }}
                        />
                        {whereError && (
                            <div style={{ 
                                color: 'var(--vscode-errorForeground)',
                                backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
                                padding: '4px 8px',
                                marginTop: '4px',
                                borderRadius: '2px',
                                fontSize: '12px'
                            }}>
                                {whereError}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div 
                            onClick={handleWhereClick}
                            style={{ 
                                cursor: 'pointer', 
                                padding: '4px',
                                minHeight: '24px',
                                backgroundColor: 'var(--vscode-input-background)',
                                border: hasError ? '2px solid var(--vscode-inputValidation-errorBorder)' : '1px solid var(--vscode-input-border)',
                                borderRadius: '2px'
                            }}
                            title="クリックしてWHERE句を編集"
                        >
                            {statement.where || '(クリックして条件を追加)'}
                        </div>
                        {hasError && (
                            <div style={{ 
                                color: 'var(--vscode-errorForeground)',
                                backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
                                padding: '8px',
                                marginTop: '8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'normal' }}>{whereError}</div>
                                    <div style={{ marginTop: '8px', fontSize: '11px', fontStyle: 'italic', opacity: 0.8 }}>
                                        クリックして修正してください。このWHERE句は実行できません。
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
                {!hasError && (
                    <div className="info-text" style={{ marginTop: '8px', fontSize: '12px' }}>
                        例: id = 1, name = 'John', age &gt; 25, status = 'active' AND age &lt; 30
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="sql-table-wrapper">
            {renderTable()}
        </div>
    );
});

// displayNameを設定(React DevToolsでの表示用)
SQLTable.displayName = 'SQLTable';