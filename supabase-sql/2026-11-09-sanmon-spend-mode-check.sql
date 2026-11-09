-- バトルのスタミナを使うとき、そのモードが いま開いているかをサーバで確かめる（2026-11-09 先生と決めた）
-- なぜ：ぼうけん・スピードデュエル・モンスター対戦（CPU）の中にいると、授業の時間になっても・先生が PRISM で閉じても、
--   メニューにもどらないかぎり遊び続けられた。画面は2分ごとの読みなおしでメニューにもどす（App.tsx）。ここは画面をいじられても止める守り。
-- reason でモードを見分ける：'speed_duel' → speed、'monster_duel' → monster、それ以外（ぼうけんのバトル）→ adventure。
-- 閉じていれば例外（スタミナは使わない）。アプリはモードを読みなおして「じゅぎょうの じかん」などを出す。
-- 足すのは学級の設定1行の読み取りだけ（バトル1回に1回）。
create or replace function public.sanmon_spend(p_student_id uuid, p_event_id text, p_amount integer, p_reason text default ''::text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  cur int;
  now_tokyo timestamp := now() at time zone 'Asia/Tokyo';
  v_class uuid;
  v_key text := case coalesce(p_reason, '') when 'speed_duel' then 'speed' when 'monster_duel' then 'monster' else 'adventure' end;
begin
  select class_id into v_class from public.students where id = p_student_id;
  if p_student_id is null or v_class is null then
    raise exception '未登録の student_id です';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 50 then raise exception 'amount が不正です'; end if;
  if p_event_id is null or length(p_event_id) not between 1 and 64 then raise exception 'event_id が不正です'; end if;
  if coalesce((public._sanmon_effective_modes(v_class) ->> v_key)::boolean, true) = false then
    raise exception 'MODE_CLOSED: いまは つかえないよ';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_student_id::text));
  if exists (select 1 from public.sanmon_spend where student_id = p_student_id and event_id = p_event_id) then
    select stamina into cur from public._sanmon_stamina(p_student_id);
    return jsonb_build_object('ok', true, 'stamina', cur, 'duplicate', true);
  end if;
  select stamina into cur from public._sanmon_stamina(p_student_id);
  if cur < p_amount then
    return jsonb_build_object('ok', false, 'stamina', cur);
  end if;
  insert into public.sanmon_spend (student_id, event_id, amount, reason, ts, spend_date, school_year)
  values (p_student_id, p_event_id, p_amount, left(coalesce(p_reason, ''), 40),
          (extract(epoch from now()) * 1000)::bigint, now_tokyo::date, public._school_year(now_tokyo::date));
  return jsonb_build_object('ok', true, 'stamina', cur - p_amount);
end $function$;
