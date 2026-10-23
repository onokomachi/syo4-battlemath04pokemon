/**
 * services/rewardToast.ts — 学習でもらったアイテム・コインのお知らせ。
 *
 * ふくしゅう・ミックスれんしゅう・ぼうけんなど、どの画面でもらっても同じ場所に出したいので、
 * 出す側(App)が受け取り口を1つ置き、もらった側はここに投げるだけにする。
 */
type Listener = (messages: string[]) => void;
let listener: Listener | null = null;

export const setRewardToastListener = (fn: Listener | null): void => { listener = fn; };

export const notifyRewards = (messages: string[]): void => {
  if (messages.length > 0) listener?.(messages);
};
