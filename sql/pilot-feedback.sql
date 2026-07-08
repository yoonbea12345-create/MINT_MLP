-- MINT 선발대 알고리즘 검증 피드백
-- 기존 MINT Supabase SQL Editor에서 실행하세요.

create table if not exists pilot_feedback (
  id text primary key,
  recommendation_image_paths jsonb not null,
  payment_image_paths jsonb not null,
  fit_rating integer not null check (fit_rating between 1 and 5),
  fit_text text not null,
  extra_text text not null,
  contact text,
  created_at timestamptz not null default now()
);

alter table pilot_feedback enable row level security;

-- 브라우저는 테이블에 직접 접근하지 않고 서버리스 API(service role)만 사용합니다.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'pilot_feedback'
  loop
    execute format('drop policy %I on public.pilot_feedback', pol.policyname);
  end loop;
end $$;

-- 이미지 저장 버킷. 공개 버킷으로 만들어 어드민에서 이미지를 바로 미리보기합니다.
insert into storage.buckets (id, name, public)
values ('pilot-feedback', 'pilot-feedback', true)
on conflict (id) do update set public = true;

-- 버킷 정책 정리 후, anon 업로드/공개 읽기만 허용합니다.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'pilot_feedback_%'
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy pilot_feedback_anon_upload on storage.objects
  for insert to anon
  with check (bucket_id = 'pilot-feedback');

create policy pilot_feedback_public_read on storage.objects
  for select to anon
  using (bucket_id = 'pilot-feedback');
