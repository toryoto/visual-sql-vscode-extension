import React, { useState } from 'react';

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
}

export const SQLTable: React.FC<SQLTableProps> = ({ 
    statement, 
    onCellEdit, 
    onAddRow, 
    onDeleteRow,
    onAddColumn,
    onDeleteColumn,
    onEditColumnName
}) => {
    const [editingCell, setEditingCell] = useState<{row: number, col: number} | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [editingColumn, setEditingColumn] = useState<number | null>(null);
    const [editColumnValue, setEditColumnValue] = useState<string>('');

    const handleCellClick = (rowIndex: number, colIndex: number, currentValue: any) => {
        setEditingCell({ row: rowIndex, col: colIndex });
        setEditValue(String(currentValue || ''));
    };

    const handleCellSave = () => {
        if (editingCell) {
            onCellEdit(editingCell.row, editingCell.col, editValue);
            setEditingCell(null);
            setEditValue('');
        }
    };

    const handleCellCancel = () => {
        setEditingCell(null);
        setEditValue('');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCellSave();
        } else if (e.key === 'Escape') {
            handleCellCancel();
        }
    };

    const handleColumnClick = (columnIndex: number, currentName: string) => {
        setEditingColumn(columnIndex);
        setEditColumnValue(currentName);
    };

    const handleColumnSave = () => {
        if (editingColumn !== null) {
            onEditColumnName(editingColumn, editColumnValue);
            setEditingColumn(null);
            setEditColumnValue('');
        }
    };

    const handleColumnCancel = () => {
        setEditingColumn(null);
        setEditColumnValue('');
    };

    const handleColumnKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleColumnSave();
        } else if (e.key === 'Escape') {
            handleColumnCancel();
        }
    };

    const renderTable = () => {
        switch (statement.type) {
            case 'insert':
                return renderInsertTable();
            case 'update':
                return renderUpdateTable();
            case 'select':
                return renderSelectTable();
            default:
                return <div>未対応のSQL文タイプ: {statement.type}</div>;
        }
    };

    const renderInsertTable = () => {
        if (!statement.columns || !statement.values) {
            return <div>INSERT文のデータがありません</div>;
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
                                            cell
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
            return <div>UPDATE文のデータがありません</div>;
        }

        return (
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
                                        row[0]
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
                                        row[1]
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
        );
    };

    const renderSelectTable = () => {
        if (!statement.columns) {
            return <div>SELECT文のカラム情報がありません</div>;
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
                    SELECT文は読み取り専用です
                </div>
            </div>
        );
    };

    return (
        <div className="sql-table-wrapper">
            {renderTable()}
        </div>
    );
};
