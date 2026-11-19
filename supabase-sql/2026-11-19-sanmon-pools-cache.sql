-- スタミナの計算を「変わったときだけ」にする（2026-11-19）。
--
-- なぜ：授業中（13〜15時）に、子どもの スタミナの読みこみ（sanmon_status）・バトル開始（sanmon_spend）・クラス対戦の へや作りが
-- 3秒（anon の statement_timeout）を超えて 数百回 失敗していた（ジムリーダーに挑むと「読み込みエラー」になったのも これ）。
-- スタミナの計算（_sanmon_pools）は その子の1年ぶんの記録を 毎回 数えなおすので重く、さらに 10分ごとに全員ぶんを数えなおす
-- cron（sanmon-status-cache）が データベースの CPU を使いきって、全部が 約10倍 遅くなっていた。
--
-- どうする：計算の しかた（数え方）は変えない。結果を 子どもごとに 表 sanmon_pools_cache に のこし、
-- 記録（learning_event）・本番テスト（test_result）・実力の階段（trial_result）・スタミナを使った記録（sanmon_spend）・
-- 練習の熟達（skill_state）が 増えた／変わったときだけ「数えなおす」しるし（ver）を 1 ふやす。日が かわったときも 数えなおす。
-- 10分ごとの cron は、しるしが ついた子だけ 数えなおす。

-- 1) もとの計算は そのまま名前を かえて のこす
alter function public._sanmon_pools(uuid) rename to _sanmon_pools_compute;
revoke all on function public._sanmon_pools_compute(uuid) from public, anon, authenticated;

-- 2) のこしておく表（RLS を入れて、だれも直接は読めない。読むのは security definer の関数だけ）
create table if not exists public.sanmon_pools_cache (
  student_id uuid primary key,
  pools jsonb,
  computed_on date,
  ver bigint not null default 0,        -- 記録が ふえるたびに +1
  done_ver bigint not null default -1,  -- pools が どの ver までを 数えた結果か
  computed_at timestamptz
);
alter table public.sanmon_pools_cache enable row level security;
revoke all on table public.sanmon_pools_cache from anon, authenticated;

-- 3) 新しい _sanmon_pools：のこした結果が 今の ver・きょうの日付なら それを返す。ちがえば 数えなおして のこす
create or replace function public._sanmon_pools(p_student_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.sanmon_pools_cache;
  v0 bigint;
  res jsonb;
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select * into c from public.sanmon_pools_cache where student_id = p_student_id;
  if found and c.pools is not null and c.done_ver = c.ver and c.computed_on = today then
    return c.pools;
  end if;
  v0 := coalesce(c.ver, 0);
  res := public._sanmon_pools_compute(p_student_id);
  -- 読むだけの取引（PRISM など）からも呼ばれるので、のこせないときは のこさずに 結果だけ返す
  begin
    insert into public.sanmon_pools_cache as pc (student_id, pools, computed_on, ver, done_ver, computed_at)
    values (p_student_id, res, today, v0, v0, now())
    on conflict (student_id) do update
      set pools = excluded.pools, computed_on = excluded.computed_on, done_ver = v0, computed_at = now();
  exception when others then
    null;
  end;
  return res;
end $$;
revoke all on function public._sanmon_pools(uuid) from public, anon, authenticated;

-- 4) しるしを ふやす トリガー（1つの命令で何行 入っても 1回だけ）
create or replace function public._sanmon_bump_ver() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.sanmon_pools_cache as pc (student_id, ver)
    select distinct n.student_id, 1 from new_rows n where n.student_id is not null
    on conflict (student_id) do update set ver = pc.ver + 1;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    insert into public.sanmon_pools_cache as pc (student_id, ver)
    select distinct o.student_id, 1 from old_rows o where o.student_id is not null
    on conflict (student_id) do update set ver = pc.ver + 1;
  end if;
  return null;
end $$;
revoke all on function public._sanmon_bump_ver() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['learning_event', 'test_result', 'trial_result', 'sanmon_spend', 'skill_state'] loop
    execute format('drop trigger if exists sanmon_bump_ins on public.%I', t);
    execute format('drop trigger if exists sanmon_bump_upd on public.%I', t);
    execute format('drop trigger if exists sanmon_bump_del on public.%I', t);
    execute format('create trigger sanmon_bump_ins after insert on public.%I referencing new table as new_rows for each statement execute function public._sanmon_bump_ver()', t);
    execute format('create trigger sanmon_bump_upd after update on public.%I referencing old table as old_rows new table as new_rows for each statement execute function public._sanmon_bump_ver()', t);
    execute format('create trigger sanmon_bump_del after delete on public.%I referencing old table as old_rows for each statement execute function public._sanmon_bump_ver()', t);
  end loop;
end $$;

-- 数え方に使う表（apps・sanmon_skill_town）が変わったら、全員 数えなおす
create or replace function public._sanmon_bump_all() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.sanmon_pools_cache set done_ver = -1;
  return null;
end $$;
revoke all on function public._sanmon_bump_all() from public, anon, authenticated;
drop trigger if exists sanmon_bump_all on public.apps;
create trigger sanmon_bump_all after insert or update or delete on public.apps for each statement execute function public._sanmon_bump_all();
drop trigger if exists sanmon_bump_all on public.sanmon_skill_town;
create trigger sanmon_bump_all after insert or update or delete on public.sanmon_skill_town for each statement execute function public._sanmon_bump_all();

-- 5) 子どもの画面の sanmon_status は、のこせるように volatile に（kit は POST で呼ぶので そのまま動く）
alter function public.sanmon_status(uuid) volatile;
alter function public._sanmon_stamina(uuid) volatile;

-- 6) PRISM 用の保存（sanmon_status_cache）も、変わった子だけ 数えなおす
alter table public.sanmon_status_cache add column if not exists src_ver bigint;

create or replace function public.refresh_sanmon_status_cache()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0; today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  for r in
    select s.id, coalesce(pc.ver, 0) v
    from public.students s
    left join public.sanmon_pools_cache pc on pc.student_id = s.id
    left join public.sanmon_status_cache sc on sc.student_id = s.id
    where sc.student_id is null
       or sc.src_ver is distinct from coalesce(pc.ver, 0)
       or (sc.computed_at at time zone 'Asia/Tokyo')::date <> today
  loop
    begin
      insert into public.sanmon_status_cache (student_id, status, computed_at, src_ver)
      values (r.id, public.sanmon_status(r.id), now(), r.v)
      on conflict (student_id) do update set status = excluded.status, computed_at = excluded.computed_at, src_ver = excluded.src_ver;
      n := n + 1;
    exception when others then
      null;
    end;
  end loop;
  return n;
end $$;

-- PRISM：のこした結果が 今の ver と同じ（その後 記録がふえていない）か、15分以内なら それを使う
create or replace function public._sanmon_status_cached(p_student_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select c.status from public.sanmon_status_cache c
       left join public.sanmon_pools_cache pc on pc.student_id = c.student_id
      where c.student_id = p_student_id
        and ((c.computed_at at time zone 'Asia/Tokyo')::date = (now() at time zone 'Asia/Tokyo')::date
             and c.src_ver is not distinct from coalesce(pc.ver, 0)
             or c.computed_at > now() - interval '15 minutes')),
    public.sanmon_status(p_student_id)
  );
$$;

-- 7) クラス対戦は スタミナを使わない（_duel_cost() = 0）あいだは、スタミナを数えない
do $$
declare f text; def text;
begin
  foreach f in array array['sanmon_duel_create', 'sanmon_duel_join', 'sanmon_pduel_create', 'sanmon_pduel_join'] loop
    select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = f;
    if position('if public._duel_cost() > 0 then select stamina' in def) = 0 then
      def := replace(def, 'select stamina into st from public._sanmon_stamina(p_student_id);',
                          'if public._duel_cost() > 0 then select stamina into st from public._sanmon_stamina(p_student_id); else st := 0; end if;');
      def := replace(def, 'select stamina into st_g from public._sanmon_stamina(p_student_id);',
                          'if public._duel_cost() > 0 then select stamina into st_g from public._sanmon_stamina(p_student_id); else st_g := 0; end if;');
      def := replace(def, 'select stamina into st_h from public._sanmon_stamina(d.host_id);',
                          'if public._duel_cost() > 0 then select stamina into st_h from public._sanmon_stamina(d.host_id); else st_h := 0; end if;');
      execute def;
    end if;
  end loop;
end $$;
