/**
 * elements.ts — アドベンチャーモードの「タイプ」とその相性。
 *
 * 小4が覚えられる範囲に抑えるため、タイプは7つだけ。相性は
 * 「じゃんけんの輪」と同じ一方向の輪(7すくみ)にしてある。
 *
 *   かず → けいさん → しょうすう → ぶんすう → ばい → グラフ → ずけい → (かずへ戻る)
 *
 * 矢印の向きが「こうかは ばつぐん(×2)」。逆向きは「いまひとつ(×0.5)」。
 * それ以外はすべて等倍なので、覚えるのは輪の順番ひとつだけで済む。
 */

export type ElementId = 'kazu' | 'keisan' | 'shosu' | 'bunsu' | 'bai' | 'graph' | 'zukei';

export interface ElementDef {
  id: ElementId;
  name: string;      // 表示名(ひらがな・カタカナ)
  icon: string;      // 絵文字(HUD・図鑑のバッジ用)
  color: string;     // タイプカラー(#rrggbb)
  darkColor: string; // 濃い方(グラデーション用)
  /** このタイプに対応する単元名(MATH_CATEGORIES の name) */
  units: string[];
}

/** 7すくみの順番。ELEMENT_CYCLE[i] は ELEMENT_CYCLE[i+1] に強い。 */
export const ELEMENT_CYCLE: ElementId[] = [
  'kazu', 'keisan', 'shosu', 'bunsu', 'bai', 'graph', 'zukei',
];

export const ELEMENTS: Record<ElementId, ElementDef> = {
  kazu: {
    id: 'kazu',
    name: 'かず',
    icon: '🔢',
    color: '#f5b942',
    darkColor: '#b47c14',
    units: ['大きい数のしくみ', 'がい数'],
  },
  keisan: {
    id: 'keisan',
    name: 'けいさん',
    icon: '⚙️',
    color: '#ef6a5a',
    darkColor: '#a83527',
    units: ['わり算の筆算(÷1けた)', 'わり算の筆算(÷2けた)', '計算のきまり'],
  },
  shosu: {
    id: 'shosu',
    name: 'しょうすう',
    icon: '💧',
    color: '#4aa8e0',
    darkColor: '#1c6ba0',
    units: ['小数のしくみ', '小数のかけ算とわり算'],
  },
  bunsu: {
    id: 'bunsu',
    name: 'ぶんすう',
    icon: '🍰',
    color: '#e86fae',
    darkColor: '#a03a72',
    units: ['分数'],
  },
  bai: {
    id: 'bai',
    name: 'ばい',
    icon: '🌱',
    color: '#5cbf7a',
    darkColor: '#25834a',
    units: ['倍の見方'],
  },
  graph: {
    id: 'graph',
    name: 'グラフ',
    icon: '📈',
    color: '#8f7ae5',
    darkColor: '#54409f',
    units: ['折れ線グラフと表', '変わり方調べ'],
  },
  zukei: {
    id: 'zukei',
    name: 'ずけい',
    icon: '📐',
    color: '#c9a227',
    darkColor: '#8a6c10',
    units: ['角の大きさ', '面積', '直方体と立方体'],
  },
};

/** 単元名 → タイプ。MATH_CATEGORIES の全14単元を覆う。 */
export const UNIT_TO_ELEMENT: Record<string, ElementId> = (() => {
  const map: Record<string, ElementId> = {};
  for (const def of Object.values(ELEMENTS)) {
    for (const unit of def.units) map[unit] = def.id;
  }
  return map;
})();

/**
 * こうかばいりつ。輪でひとつ先なら×2、ひとつ手前なら×0.5、それ以外は×1。
 * 攻撃側が有利なときだけ大きく増えるので「相性を考えると気持ちいい」が
 * 「相性を外すと詰む」にはならない。
 */
export const getTypeMultiplier = (attacker: ElementId, defender: ElementId): number => {
  const a = ELEMENT_CYCLE.indexOf(attacker);
  const d = ELEMENT_CYCLE.indexOf(defender);
  if (a < 0 || d < 0) return 1;
  const n = ELEMENT_CYCLE.length;
  if ((a + 1) % n === d) return 2;
  if ((d + 1) % n === a) return 0.5;
  return 1;
};

export const getTypeMatchupLabel = (mult: number): string | null => {
  if (mult > 1) return 'こうかは ばつぐんだ！';
  if (mult < 1) return 'こうかは いまひとつ…';
  return null;
};

/** 図鑑・手持ち画面で「なにに強いか」を出すためのヘルパー */
export const getStrongAgainst = (id: ElementId): ElementId => {
  const i = ELEMENT_CYCLE.indexOf(id);
  return ELEMENT_CYCLE[(i + 1) % ELEMENT_CYCLE.length];
};

export const getWeakAgainst = (id: ElementId): ElementId => {
  const i = ELEMENT_CYCLE.indexOf(id);
  return ELEMENT_CYCLE[(i - 1 + ELEMENT_CYCLE.length) % ELEMENT_CYCLE.length];
};
