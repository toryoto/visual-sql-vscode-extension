import React from 'react';
import { createRoot } from 'react-dom/client';
import { SQLViewer } from './SQLViewer';

// VSCode APIの取得
declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

// Reactアプリの初期化
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<SQLViewer vscode={vscode} />);
}
