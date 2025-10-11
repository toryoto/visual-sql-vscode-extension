import React from 'react';
import { createRoot } from 'react-dom/client';
import { SQLViewer } from './SQLViewer';

// VSCode APIの取得
declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

// 初期化ログ
console.log('Webview initializing...');

// Reactアプリの初期化
const container = document.getElementById('root');
if (container) {
    console.log('Root container found, rendering React app');
    const root = createRoot(container);
    root.render(<SQLViewer vscode={vscode} />);
    
    // 準備完了を通知
    setTimeout(() => {
        console.log('Sending ready message to extension');
        vscode.postMessage({ type: 'ready' });
    }, 100);
} else {
    console.error('Root container not found!');
}