import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { adoptStudentFromUrl } from 'learning-app-kit/sync';
import { JoinGate } from 'learning-app-kit/react';
import { PORTAL } from './services/portal';

// 子ども用ハブから #c=<学級コード>&n=<番号> 付きで来たら、その子として名乗る（await しない）
void adoptStudentFromUrl(PORTAL);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    {/* 学級コードの入力（はじめの1回）と、あとから名乗る入口（右下）。SOLO/DUO の確認もここが出す */}
    <JoinGate config={PORTAL} />
  </React.StrictMode>
);
