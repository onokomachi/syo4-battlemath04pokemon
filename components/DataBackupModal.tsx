import React, { useRef, useState } from 'react';

/**
 * DataBackupModal.tsx — 手動セーブ/ロード(バックアップの書き出し・読みこみ)。
 *
 * ふだんは状態が変わるたびに localStorage へ自動保存しているが、それは
 * 「この端末・このブラウザ」にしか残らない。端末を変える・ブラウザのデータを
 * 消す・ゲストプレイ(ログインなし)のときに備えて、手で書き出し/もどしが
 * できるようにしておく。
 *
 * 中身は「このオリジンの localStorage をまるごと」。個々の保存キーを
 * 知らなくてよいようにしてあるので、きろく・ぼうけん・アイテムなど、
 * 保存先が増えても このファイルを直す必要がない。
 */

const FILE_TAG = 'sanmon04-backup';

interface BackupFile {
  app: string;
  exportedAt: number;
  data: Record<string, string>;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const readAllLocalStorage = (): Record<string, string> => {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const v = localStorage.getItem(key);
    if (v !== null) data[key] = v;
  }
  return data;
};

const DataBackupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Record<string, string> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = () => {
    try {
      const payload: BackupFile = { app: FILE_TAG, exportedAt: Date.now(), data: readAllLocalStorage() };
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const d = new Date();
      const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `${FILE_TAG}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage('バックアップを 保存したよ！');
    } catch {
      setMessage('保存に 失敗したよ。');
    }
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || parsed.app !== FILE_TAG || typeof parsed.data !== 'object') {
        setMessage('このファイルは バックアップとして 読みこめなかったよ。');
        return;
      }
      setPending(parsed.data);
    } catch {
      setMessage('このファイルは バックアップとして 読みこめなかったよ。');
    }
  };

  const confirmRestore = () => {
    if (!pending) return;
    try {
      for (const [k, v] of Object.entries(pending)) localStorage.setItem(k, v);
      // 個々の Zustand ストアは起動時に localStorage を読むので、
      // かきかえた内容を確実に反映するには読みこみ直すのがいちばん安全。
      window.location.reload();
    } catch {
      setMessage('もどすのに 失敗したよ。空き容量が たりないかも。');
      setPending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl bg-white border-8 border-emerald-400 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-2xl font-black text-emerald-700 mb-1">💾 データのバックアップ</h3>
        <p className="text-sm font-bold text-slate-500 mb-5">
          きろくを ファイルに 保存したり、もどしたり できるよ。ブラウザを かえるときは 保存してから 引っこそう。
        </p>

        <button
          onClick={handleExport}
          className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg mb-3 active:scale-95 transition"
        >
          ⬇ バックアップを 保存する
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          className="w-full py-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-lg active:scale-95 transition"
        >
          ⬆ バックアップを もどす
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFileChosen}
        />

        {message && <p className="mt-4 text-center text-sm font-bold text-slate-600">{message}</p>}

        <button onClick={onClose} className="mt-5 w-full py-2 text-slate-400 font-bold text-sm">
          とじる
        </button>
      </div>

      {pending && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPending(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white border-8 border-amber-400 p-6 shadow-2xl text-center"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-2xl mb-2">⚠️</p>
            <h3 className="text-xl font-black text-slate-800 mb-2">今の きろくと 入れかえる？</h3>
            <p className="text-sm font-bold text-slate-500 mb-5">
              今 この ブラウザに ある きろくは、ファイルの 内容で 上書きされるよ。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPending(null)}
                className="py-3 rounded-2xl bg-slate-200 text-slate-700 font-black text-lg active:scale-95 transition"
              >
                もどる
              </button>
              <button
                onClick={confirmRestore}
                className="py-3 rounded-2xl bg-rose-500 text-white font-black text-lg active:scale-95 transition"
              >
                入れかえる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataBackupModal;
