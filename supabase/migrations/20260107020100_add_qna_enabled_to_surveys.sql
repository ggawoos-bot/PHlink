alter table if exists phlink.surveys
add column if not exists qna_enabled boolean not null default true;

update phlink.surveys
set qna_enabled = true
where qna_enabled is null;
