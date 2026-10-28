-- Уникальные индексы для безопасного повторного импорта (по external_id).
-- Обычные (не partial): PostgREST upsert не умеет работать с partial-индексами. NULL-значения уникальность не нарушают.
create unique index if not exists students_external_uidx on students(external_id);
create unique index if not exists sessions_external_uidx on sessions(external_id);
