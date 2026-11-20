/** 小数の 本番テストを SANMON のスタミナ道場に出すための対応表（SANMON 用に手で書く） */
import type { AppTestDef } from '../types';
import { MockTestModule } from './components/modules/MockTestModule';

export const SYOUSU_TESTS: AppTestDef[] = [
  { key: 'mock-test', app: 'syousu', title: '小数の 本番テスト（2つの テストから えらべるよ）', desc: '「小数のしくみ」と「小数のかけ算とわり算」。はじめに どちらかを えらぶよ', Module: ({ onExit, onPractice }) => <MockTestModule onExit={onExit} onPractice={onPractice} /> },
];
