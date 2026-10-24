import './index.css';
// 学級／おためし の セーブの入れかえ。ストアが localStorage を読む前に動かすので、App より先に読みこむ
import './services/saveProfile';
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
    {/* 学級コードの入力（はじめの1回）。SOLO/DUO の確認もここが出す。
        右下の入口（chip）は出さない：おためしで バトルの「わからない」ボタンに重なって押せなかった。
        あとから名乗る入口は、はじめの画面の JoinSettingsRow（PortalLoginScreen）にある */}
    <JoinGate config={PORTAL} chip={false} />
  </React.StrictMode>
);
