/** 垂直・平行と四角形の 本番テストを SANMON のスタミナ道場に出すための対応表（SANMON 用に手で書く） */
import type { AppTestDef } from '../types';
import { MockTestModule } from './components/modules/MockTestModule';

export const SUIHEI_TESTS: AppTestDef[] = [
  { key: 'mock-test', app: 'suihei', title: '垂直・平行と四角形の 本番テスト', desc: 'アプリの 本番テストと 同じ もんだい・同じ 点数（表と裏）', Module: ({ onExit, onPractice }) => <MockTestModule onExit={onExit} onPractice={onPractice} /> },
];
