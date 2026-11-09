-- 町ごとのスタミナ（2026-11-09 先生と決めた）
--
-- きまり：
--   - 単元アプリの正解でたまる分は、その単元の「町のスタミナ」になる（町ごとに50まで）。その町のぼうけんでだけ使える。
--   - がんばりボーナス（本番テスト8割 +5・実力の階段の新しい段 +3・はじめての熟達 +2）は「共通スタミナ」（100まで）。どこでも使える。
--   - ぼうけんのバトルは、その町のスタミナ → （2つの町にまたがるアプリの）共有ぶん → 共通 の順に使う。
--   - アプリの無い町（大きい数・折れ線グラフ・角）・スピード・モンスター対戦・クラス対戦は 共通だけを使う。
--   - 1つのアプリが2つの町にまたがるときは、項目で分ける：
--       わり算の筆算 hissan：筆算 hissan-?-1 → ÷1けた（div1）、hissan-?-2・?-3 → ÷2けた（div2）、ほかの項目は2つの町の共有（app:hissan）
--       小数 syousu：アプリの「小数のかけ算とわり算」の項目 → decmuldiv、そのほかの小数のしくみの項目 → decimal、分からない項目は共有（app:syousu）
--   - 町の無いアプリ（国語・英語・5〜6年など）の正解は 共通 にたまる。
--   - 切りかえ（2026-11-09 13:00）より前にたまっていた分は すべて 共通。それより前の使った分も共通から引く。
-- どの町で使ったかは、sanmon_spend の reason の「@町」で分かる（例 'wild@div1'）。@ が無い使い方は共通から。
-- たまる・使うは 時刻の順に1つずつ数える（2026-11-09-sanmon-stamina-chronological.sql と同じ）。

-- 小数アプリの項目 → 町（learning-app-kit の src/catalog/syousu.ts の module から作った）
create table if not exists public.sanmon_skill_town (
  app_id text not null, skill_id text not null, town text not null,
  primary key (app_id, skill_id)
);
alter table public.sanmon_skill_town enable row level security;  -- 関数からだけ読む
insert into public.sanmon_skill_town (app_id, skill_id, town) values
('syousu','addsub-add-basic','decimal'), ('syousu','addsub-add-diff','decimal'), ('syousu','addsub-sub-basic','decimal'), ('syousu','addsub-sub-diff','decimal'), ('syousu','addsub-sub-whole','decimal'),
('syousu','div-basic','decmuldiv'), ('syousu','div-carry','decmuldiv'), ('syousu','div-remainder','decmuldiv'), ('syousu','mul-tenths','decmuldiv'), ('syousu','mul-hundredths','decmuldiv'),
('syousu','mul-2digit','decmuldiv'), ('syousu','mul-zero-end','decmuldiv'), ('syousu','div-2digit','decmuldiv'), ('syousu','div-int','decmuldiv'), ('syousu','div-round','decmuldiv'),
('syousu','div-check','decmuldiv'), ('syousu','mul-mental','decmuldiv'), ('syousu','div-mental','decmuldiv'), ('syousu','mul-method','decmuldiv'), ('syousu','mul-point','decmuldiv'),
('syousu','div-point','decmuldiv'), ('syousu','mul-word','decmuldiv'), ('syousu','div-word','decmuldiv'), ('syousu','div-word-remainder','decmuldiv'), ('syousu','div-times','decmuldiv'),
('syousu','compare-tenths','decimal'), ('syousu','compare-mixed','decimal'), ('syousu','compare-int','decimal'), ('syousu','line-tenths','decimal'), ('syousu','line-0to10','decimal'),
('syousu','line-hundredths','decimal'), ('syousu','order-3','decimal'), ('syousu','order-5','decimal'), ('syousu','collect-basic','decimal'), ('syousu','collect-regroup','decimal'),
('syousu','compose-2','decimal'), ('syousu','compose-3','decimal'), ('syousu','placeid-2','decimal'), ('syousu','placeid-3','decimal'), ('syousu','scale-10','decimal'),
('syousu','scale-tenth','decimal'), ('syousu','scale-100','decimal'), ('syousu','scale-mix','decimal'), ('syousu','unit-length','decimal'), ('syousu','unit-mass','decimal'),
('syousu','unit-mix','decimal'), ('syousu','mock-test','decimal'), ('syousu','mock-test-muldiv','decmuldiv')
on conflict (app_id, skill_id) do update set town = excluded.town;

-- 正解1問が どこにたまるか（町のキー・'app:アプリ'＝2つの町の共有・null＝共通）
create or replace function public._sanmon_pool(p_app text, p_skill text)
returns text language sql immutable set search_path to '' as $$
  select case p_app
    when 'hissan' then case when p_skill ~ '^hissan-\d-1$' then 'div1' when p_skill ~ '^hissan-\d-[23]$' then 'div2' else 'app:hissan' end
    when 'syousu' then 'app:syousu'  -- 項目の表（sanmon_skill_town）で上書きする
    when 'suihei' then 'suihei' when 'gaisu' then 'rounding' when 'karakuri' then 'calcrules' when 'menseki4' then 'area'
    when 'bunsuu4' then 'fraction' when 'kawari' then 'change' when 'rippoutai' then 'solid' when 'bai' then 'ratio'
    else null end
$$;

-- 町 → その町で使える共有ぶん
create or replace function public._sanmon_shared_of(p_town text)
returns text language sql immutable set search_path to '' as $$
  select case when p_town in ('div1', 'div2') then 'app:hissan' when p_town in ('decimal', 'decmuldiv') then 'app:syousu' end
$$;

-- スタミナを、共通と町ごとに数える
create or replace function public._sanmon_pools(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  p_cutover constant date := date '2026-10-25';
  town_cut constant bigint := (extract(epoch from timestamptz '2026-11-09 13:00:00+09') * 1000)::bigint;
  town_cap constant numeric := 50;
  today date := (now() at time zone 'Asia/Tokyo')::date;
  sy int := public._school_year((now() at time zone 'Asia/Tokyo')::date);
  common numeric := 0; e_today numeric := 0; pools jsonb := '{}'::jsonb; r record;
  need numeric; have numeric; k text; towns jsonb := '{}'::jsonb;
begin
  for r in
    with ev as (
      select le.event_date d, le.app_id, le.skill_id, le.ts, le.pair,
             (le.correct and not le.abandoned) ok
      from public.learning_event le
      where le.student_id = p_student_id and le.app_id <> 'sanmon' and le.school_year = sy
    ),
    runs as (
      select ev.*, sum(case when ok then 0 else 1 end) over (partition by app_id, skill_id order by ts rows unbounded preceding) grp
      from ev
    ),
    streak as (
      select runs.*, case when ok then row_number() over (partition by app_id, skill_id, grp, ok order by ts) else 0 end n
      from runs
    ),
    mastery as (
      select distinct on (app_id, skill_id) app_id, skill_id, ts m_ts, d m_d
      from streak where n >= 5 order by app_id, skill_id, ts
    ),
    earn_old as (
      select (extract(epoch from (d::timestamp at time zone 'Asia/Tokyo')) * 1000)::bigint ts,
             least(30, floor(sum(case when pair then 0.5 else 1 end)))::numeric v, null::text pool
      from ev where ok and d < p_cutover group by d
    ),
    w as (
      select e.d, e.app_id, e.skill_id, e.ts,
             (case when e.pair then 0.5 else 1 end) * (case when m.m_ts is not null and e.ts > m.m_ts then 0.5 else 1 end) w
      from ev e left join mastery m on m.app_id = e.app_id and m.skill_id = e.skill_id
      where e.ok and e.d >= p_cutover
    ),
    cum as (
      select app_id, skill_id, ts, sum(w) over (partition by d, app_id, skill_id order by ts rows unbounded preceding) c, w from w
    ),
    earn_new as (
      select c.ts, least(5, c.c) - least(5, c.c - c.w) v,
             case when c.ts < town_cut then null else coalesce(st.town, public._sanmon_pool(c.app_id, c.skill_id)) end pool
      from cum c left join public.sanmon_skill_town st on st.app_id = c.app_id and st.skill_id = c.skill_id
    ),
    b_mastery as (select m_ts ts, 2::numeric v, null::text pool from mastery where m_d >= p_cutover),
    b_test as (
      select min(t.ts) ts, 5::numeric v, null::text pool from (
        select tr.app_id, le.skill_id, tr.taken_date d, tr.ts
        from public.test_result tr
        join public.learning_event le on le.device_key = tr.device_key and le.app_id = tr.app_id and le.event_id = tr.event_id
        where tr.student_id = p_student_id and tr.school_year = sy and tr.total_max > 0
          and tr.total * 5 >= tr.total_max * 4 and not le.pair and tr.taken_date >= p_cutover
      ) t group by t.app_id, t.skill_id, t.d
    ),
    trial_rows as (
      select taken_date d, ts, floor f,
             max(floor) over (partition by app_id order by ts rows between unbounded preceding and 1 preceding) prev
      from public.trial_result
      where student_id = p_student_id and school_year = sy and solo_complete
    ),
    b_trial as (select ts, (greatest(0, f - coalesce(prev, 0)) * 3)::numeric v, null::text pool from trial_rows where d >= p_cutover),
    spend as (
      select s.ts, -s.amount::numeric v,
             case when s.ts >= town_cut and position('@' in s.reason) > 0 then split_part(s.reason, '@', 2) end pool
      from public.sanmon_spend s
      where s.student_id = p_student_id and s.school_year = sy
    ),
    allx as (
      select ts, v, pool from earn_old union all select ts, v, pool from earn_new where v > 0
      union all select ts, v, pool from b_mastery union all select ts, v, pool from b_test
      union all select ts, v, pool from b_trial where v > 0 union all select ts, v, pool from spend
    )
    select ts, v, pool from allx order by ts, (v < 0)
  loop
    if r.v > 0 then
      if r.pool is null then
        common := least(100, common + r.v);
      else
        pools := jsonb_set(pools, array[r.pool], to_jsonb(least(town_cap, coalesce((pools ->> r.pool)::numeric, 0) + r.v)));
      end if;
      if (to_timestamp(r.ts / 1000.0) at time zone 'Asia/Tokyo')::date = today then e_today := e_today + r.v; end if;
    else
      need := -r.v;
      -- 町 → 共有 → 共通 の順に引く
      foreach k in array array_remove(array[r.pool, public._sanmon_shared_of(r.pool)], null) loop
        have := coalesce((pools ->> k)::numeric, 0);
        if have > 0 and need > 0 then
          pools := jsonb_set(pools, array[k], to_jsonb(have - least(have, need)));
          need := need - least(have, need);
        end if;
      end loop;
      common := greatest(0, common - need);
    end if;
  end loop;
  -- 町ごとに「その町で使える分」（自分の町＋共有。共通はふくめない）
  for k in select unnest(array['div1','div2','suihei','decimal','rounding','calcrules','area','decmuldiv','fraction','change','solid','ratio']) loop
    towns := towns || jsonb_build_object(k, floor(coalesce((pools ->> k)::numeric, 0) + coalesce((pools ->> public._sanmon_shared_of(k))::numeric, 0)));
  end loop;
  return jsonb_build_object('common', floor(common), 'towns', towns, 'pools', pools, 'earned_today', floor(e_today));
end $function$;

-- 前からの呼び名（対戦の関数が使う）：共通スタミナを返す
create or replace function public._sanmon_stamina(p_student_id uuid)
returns table (stamina integer, earned_today integer)
language plpgsql stable security definer set search_path to '' as $function$
declare p jsonb := public._sanmon_pools(p_student_id);
begin
  stamina := (p ->> 'common')::int; earned_today := (p ->> 'earned_today')::int;
  return next;
end $function$;

-- バトルのスタミナ：reason の @町 があれば、町 → 共有 → 共通 の合計で足りるかを見る。返す stamina は共通の残り
create or replace function public.sanmon_spend(p_student_id uuid, p_event_id text, p_amount integer, p_reason text default ''::text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  now_tokyo timestamp := now() at time zone 'Asia/Tokyo';
  v_class uuid;
  v_base text := split_part(coalesce(p_reason, ''), '@', 1);
  v_town text := nullif(split_part(coalesce(p_reason, ''), '@', 2), '');
  v_key text := case v_base when 'speed_duel' then 'speed' when 'monster_duel' then 'monster' else 'adventure' end;
  p jsonb; common int; here int; left_need int;
begin
  select class_id into v_class from public.students where id = p_student_id;
  if p_student_id is null or v_class is null then raise exception '未登録の student_id です'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 50 then raise exception 'amount が不正です'; end if;
  if p_event_id is null or length(p_event_id) not between 1 and 64 then raise exception 'event_id が不正です'; end if;
  if coalesce((public.sanmon_modes(p_student_id) ->> v_key)::boolean, true) = false then
    raise exception 'MODE_CLOSED: いまは つかえないよ';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_student_id::text));
  p := public._sanmon_pools(p_student_id);
  common := (p ->> 'common')::int;
  here := coalesce((p -> 'towns' ->> v_town)::int, 0);
  if exists (select 1 from public.sanmon_spend where student_id = p_student_id and event_id = p_event_id) then
    return jsonb_build_object('ok', true, 'stamina', common, 'town', here, 'duplicate', true);
  end if;
  if here + common < p_amount then
    return jsonb_build_object('ok', false, 'stamina', common, 'town', here);
  end if;
  insert into public.sanmon_spend (student_id, event_id, amount, reason, ts, spend_date, school_year)
  values (p_student_id, p_event_id, p_amount, left(coalesce(p_reason, ''), 40),
          (extract(epoch from now()) * 1000)::bigint, now_tokyo::date, public._school_year(now_tokyo::date));
  left_need := greatest(0, p_amount - here);
  return jsonb_build_object('ok', true, 'stamina', common - left_need, 'town', greatest(0, here - p_amount));
end $function$;

-- 子どもの画面（sanmon_status）に 町ごとのスタミナ（towns）を足す。stamina は共通スタミナ
do $$
declare def text;
begin
  def := pg_get_functiondef('public.sanmon_status(uuid)'::regprocedure);
  if position('_sanmon_pools' in def) = 0 then
    def := replace(def, 'st record;', 'st record; pl jsonb;');
    def := replace(def, 'select * into st from public._sanmon_stamina(p_student_id);',
      'pl := public._sanmon_pools(p_student_id); select (pl->>''common'')::int as stamina, (pl->>''earned_today'')::int as earned_today into st;');
    def := replace(def, '  return res;', '  return res || jsonb_build_object(''towns'', coalesce(pl->''towns'', ''{}''::jsonb));');
    execute def;
  end if;
end $$;

revoke all on function public._sanmon_pools(uuid) from public, anon, authenticated;
revoke all on function public._sanmon_pool(text, text) from public, anon, authenticated;
revoke all on function public._sanmon_shared_of(text) from public, anon, authenticated;
