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
import { enterDemo, isDemo, trialOnClassDevice } from './services/saveProfile';
import { endTrial } from 'learning-app-kit/sync';

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
      {trialOnClassDevice() ? (
        // 学級コードが入っている端末で、体験のリンクから開いた（学級のセーブを守るため、このタブでは遊ばせない）
        <div className="w-full h-screen grid place-items-center p-6 text-center text-white">
          <div className="hud-panel rounded-2xl p-6 max-w-sm">
            <p className="text-lg font-black mb-2">この たんまつは がっきゅうコードが 入っているよ</p>
            <p className="text-sm text-gray-300 mb-4">たいけんばんでは なく、ふつうの SANMON で あそんでね。</p>
            <button onClick={endTrial} className="w-full btn-tactical py-3 rounded-xl font-bold">ふつうの SANMON を ひらく</button>
          </div>
        </div>
      ) : <App />}
    </ErrorBoundary>
    {/* 学級コードの入力（はじめの1回）。SOLO/DUO の確認もここが出す。
        右下の入口（chip）は出さない：おためしで バトルの「わからない」ボタンに重なって押せなかった。
        あとから名乗る入口は、はじめの画面の JoinSettingsRow（PortalLoginScreen）にある */}
    <JoinGate config={PORTAL} chip={false} allowWithout={isDemo} onDemo={enterDemo} />
  </React.StrictMode>
);

// ぼうけんの絵と曲を端末に残す（public/sw.js。docs/OFFLINE_ASSETS.md）。開発中は入れない。
// プログラム本体は残さないので、月曜の自動更新はこれまでどおり届く。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* 入れられない端末は今までどおり */ });
  });
}
