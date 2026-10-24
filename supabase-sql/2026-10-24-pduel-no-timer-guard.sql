-- モンスター対戦（クラス対戦）: さいしょの子が答えるまで時間せいげんなし・答えたら のこり60秒・
-- 正解した子の まもり（受けるダメージ ×0.85）・がんばり 0.7（3ターンまで）・強さの比の上限 1.7。
-- CPU 戦の data/partyDuel.ts（PARTY_DUEL）と同じ数。数を変えるときは両方を変え、scripts/sim-party-duel.mjs で確かめる。

create or replace function public._pduel_cap_seconds() returns integer
  language sql immutable set search_path to '' as $$ select 300 $$;
create or replace function public._pduel_after_first_seconds() returns integer
  language sql immutable set search_path to '' as $$ select 60 $$;
create or replace function public._pduel_guard() returns numeric
  language sql immutable set search_path to '' as $$ select 0.85 $$;

drop function if exists public._pduel_hit(jsonb, jsonb, boolean, integer);
create function public._pduel_hit(att jsonb, def jsonb, faster boolean, miss integer, guard boolean default false)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  cyc text[] := array['kazu', 'keisan', 'shosu', 'bunsu', 'bai', 'graph', 'zukei'];
  r numeric; ai int; di int; tf numeric := 1; mult numeric := 1; crit boolean; roll numeric; f numeric; g int;
begin
  r := least(1.7, greatest(1 / 1.7, (att ->> 'power')::numeric / greatest(0.001, (def ->> 'power')::numeric)));
  ai := array_position(cyc, att ->> 'type') - 1;
  di := array_position(cyc, def ->> 'type') - 1;
  if ai is not null and di is not null then
    if (ai + 1) % 7 = di then tf := 1.5; mult := 2;
    elsif (di + 1) % 7 = ai then tf := 0.67; mult := 0.5;
    end if;
  end if;
  g := least(3, greatest(0, coalesce(miss, 0)));
  crit := random() < 0.15;
  roll := (0.7 + random() * 0.6) * (case when crit then 1.6 else 1 end);
  f := least(0.7, 0.36 * sqrt(r) * tf * (case when faster then 1.05 else 1 end) * (1 + 0.7 * g) * roll)
       * (case when guard then public._pduel_guard() else 1 end);
  return jsonb_build_object('damage', greatest(1, round((def ->> 'maxHp')::numeric * f)), 'crit', crit, 'type', mult, 'grit', g,
    'guard', coalesce(guard, false));
end $function$;

create or replace function public._pduel_resolve(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  d public.sanmon_duel; ha jsonb; ga jsonb; hp jsonb; gp jsonb; hm jsonb; gm jsonb;
  hc boolean; gc boolean; hh jsonb; gh jsonb; hko boolean; gko boolean;
  nha int; nga int; h_alive boolean; g_alive boolean; v_winner text; rh numeric; rg numeric; nxt int; sub text; lt jsonb;
begin
  select * into d from public.sanmon_duel where id = p_id;
  if d.status <> 'playing' or d.party_size is null then return; end if;
  ha := d.host_answer; ga := d.guest_answer;
  hp := d.host_party; gp := d.guest_party;
  hm := hp -> d.host_active; gm := gp -> d.guest_active;
  hc := coalesce((ha ->> 'correct')::boolean, false);
  gc := coalesce((ga ->> 'correct')::boolean, false);
  -- 受ける側も正解していれば まもり（最後の引数）
  if hc then hh := public._pduel_hit(hm, gm, gc and (ha ->> 'at')::timestamptz < (ga ->> 'at')::timestamptz, d.host_miss, gc); end if;
  if gc then gh := public._pduel_hit(gm, hm, hc and (ga ->> 'at')::timestamptz < (ha ->> 'at')::timestamptz, d.guest_miss, hc); end if;
  if hh is not null then
    gp := jsonb_set(gp, array[d.guest_active::text, 'hp'], to_jsonb(greatest(0, (gm ->> 'hp')::int - (hh ->> 'damage')::int)));
  end if;
  if gh is not null then
    hp := jsonb_set(hp, array[d.host_active::text, 'hp'], to_jsonb(greatest(0, (hm ->> 'hp')::int - (gh ->> 'damage')::int)));
  end if;
  hko := (hp -> d.host_active ->> 'hp')::int <= 0;
  gko := (gp -> d.guest_active ->> 'hp')::int <= 0;
  nha := d.host_active + (case when hko then 1 else 0 end);
  nga := d.guest_active + (case when gko then 1 else 0 end);
  h_alive := nha < jsonb_array_length(hp);
  g_alive := nga < jsonb_array_length(gp);
  if not h_alive and not g_alive then
    -- さいごの1匹どうしが同時に たおれたら、そのターンに速く正解した方の勝ち
    v_winner := case when hc and gc and (ha ->> 'at') <> (ga ->> 'at')
      then (case when (ha ->> 'at')::timestamptz < (ga ->> 'at')::timestamptz then 'host' else 'guest' end) else 'draw' end;
  elsif not h_alive then v_winner := 'guest';
  elsif not g_alive then v_winner := 'host';
  elsif d.round >= 60 then
    select coalesce(sum(greatest(0, (e ->> 'hp')::numeric) / (e ->> 'maxHp')::numeric), 0) into rh from jsonb_array_elements(hp) e;
    select coalesce(sum(greatest(0, (e ->> 'hp')::numeric) / (e ->> 'maxHp')::numeric), 0) into rg from jsonb_array_elements(gp) e;
    v_winner := case when rh > rg then 'host' when rg > rh then 'guest' else 'draw' end;
  end if;
  lt := jsonb_build_object('turn', d.round, 'host_hit', hh, 'guest_hit', gh, 'host_ko', hko, 'guest_ko', gko,
    'host_correct', case when ha is null then null else hc end, 'guest_correct', case when ga is null then null else gc end,
    'host_defid', hm ->> 'defId', 'guest_defid', gm ->> 'defId');
  if v_winner is not null then
    update public.sanmon_duel set host_party = hp, guest_party = gp, host_active = nha, guest_active = nga,
      host_score = nga, guest_score = nha, last_turn = lt,
      status = 'finished', finished_at = now(), end_reason = 'score', winner = v_winner
    where id = p_id;
    return;
  end if;
  nxt := d.round + 1;
  -- 奇数ターンは部屋を作った子の場のモンスター、偶数ターンは入った子の場のモンスターの分野
  sub := case when nxt % 2 = 1 then hp -> nha ->> 'subtopic' else gp -> nga ->> 'subtopic' end;
  update public.sanmon_duel set host_party = hp, guest_party = gp, host_active = nha, guest_active = nga,
    host_miss = case when hh is null then d.host_miss + 1 else 0 end,
    guest_miss = case when gh is null then d.guest_miss + 1 else 0 end,
    host_score = nga, guest_score = nha, last_turn = lt,
    round = nxt, round_subtopic = sub, host_answer = null, guest_answer = null,
    -- 結果を見せる時間＋カウントダウン。しめきりは「だれも答えないとき」の打ち切り（さいしょの答えで ちぢめる）
    round_start = now() + interval '4 seconds',
    round_deadline = now() + interval '4 seconds' + make_interval(secs => public._pduel_cap_seconds())
  where id = p_id;
end $function$;

create or replace function public.sanmon_pduel_answer(p_student_id uuid, p_duel_id uuid, p_round integer, p_correct boolean, p_ms integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare d public.sanmon_duel; am_host boolean; mine jsonb; theirs jsonb;
begin
  perform public._duel_student(p_student_id);
  select * into d from public.sanmon_duel where id = p_duel_id for update;
  if not found or (d.host_id <> p_student_id and d.guest_id is distinct from p_student_id) then
    raise exception 'この へやの 子では ないよ';
  end if;
  if d.party_size is null then raise exception 'アプリを よみなおしてね'; end if;
  am_host := d.host_id = p_student_id;
  if am_host then update public.sanmon_duel set host_seen = now() where id = d.id;
  else update public.sanmon_duel set guest_seen = now() where id = d.id; end if;
  mine := case when am_host then d.host_answer else d.guest_answer end;
  theirs := case when am_host then d.guest_answer else d.host_answer end;
  if d.status = 'playing' and d.round = p_round and mine is null
     and now() >= d.round_start - interval '1 second' and now() <= d.round_deadline + interval '1 second' then
    mine := jsonb_build_object('correct', coalesce(p_correct, false), 'ms', greatest(0, least(coalesce(p_ms, 0), 600000)), 'at', clock_timestamp());
    if am_host then
      update public.sanmon_duel set host_answer = mine, host_correct = host_correct + (case when p_correct then 1 else 0 end) where id = d.id;
    else
      update public.sanmon_duel set guest_answer = mine, guest_correct = guest_correct + (case when p_correct then 1 else 0 end) where id = d.id;
    end if;
    if theirs is not null then
      perform public._pduel_resolve(d.id);
    else
      -- さいしょの答え：のこりの子は ここから60秒まで（それまでは時間せいげんなし）
      update public.sanmon_duel
        set round_deadline = least(round_deadline, clock_timestamp() + make_interval(secs => public._pduel_after_first_seconds()))
        where id = d.id;
    end if;
  else
    perform public._duel_tick(d.id, p_student_id);
  end if;
  select * into d from public.sanmon_duel where id = p_duel_id;
  return public._duel_view(d, p_student_id);
end $function$;

-- 作り直した _pduel_hit は、前と同じく 端末（anon・authenticated）からは呼べないようにする
revoke all on function public._pduel_hit(jsonb, jsonb, boolean, integer, boolean) from public, anon, authenticated;
grant execute on function public._pduel_hit(jsonb, jsonb, boolean, integer, boolean) to service_role;

-- へやに入ったときの1ターン目のしめきりも「だれも答えないとき」の打ち切りにする（ほかは そのまま）
do $do$
declare src text;
begin
  src := pg_get_functiondef('public.sanmon_pduel_join(uuid, uuid, text[])'::regprocedure);
  if position('public._duel_round_seconds()' in src) = 0 then raise exception 'sanmon_pduel_join の形が かわっている'; end if;
  execute replace(src, 'public._duel_round_seconds()', 'public._pduel_cap_seconds()');
end $do$;

-- うまく入ったかの確かめ（3行とも true なら成功）
select '_pduel_cap_seconds' as name, public._pduel_cap_seconds() = 300 as ok
union all select '_pduel_guard', public._pduel_guard() = 0.85
union all select 'join uses cap', position('_pduel_cap_seconds' in pg_get_functiondef('public.sanmon_pduel_join(uuid, uuid, text[])'::regprocedure)) > 0;
