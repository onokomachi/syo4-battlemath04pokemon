-- クラス対戦は、とりあえずスタミナなしで遊べる（2026-11-19 先生と決めた）。
-- 元にもどすときは _duel_cost() を 5 にするだけ（0 のときは スタミナの記録を入れない）。
create or replace function public._duel_cost() returns int language sql immutable as $$ select 0 $$;

-- 入室のとき sanmon_spend に入れる記録を「cost > 0 のときだけ」にする
-- （sanmon_spend は amount >= 1 の決まりがあり、0 の記録は入れられない）
do $$
declare f text; def text;
begin
  foreach f in array array['sanmon_duel_join', 'sanmon_pduel_join'] loop
    select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = f;
    if def is null then raise exception '% が見つかりません', f; end if;
    if position('if public._duel_cost() > 0 then' in def) = 0 then
      def := replace(def, 'insert into public.sanmon_spend', 'if public._duel_cost() > 0 then insert into public.sanmon_spend');
      def := replace(def, 'on conflict do nothing;', 'on conflict do nothing; end if;');
      execute def;
    end if;
  end loop;
end $$;
