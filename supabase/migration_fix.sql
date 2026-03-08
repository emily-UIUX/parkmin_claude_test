-- =============================================
-- Fix: pages 테이블 스키마 수정
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. pages: is_archived → is_deleted 으로 변경, deleted_at 추가
ALTER TABLE pages RENAME COLUMN is_archived TO is_deleted;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. trash: title 컬럼 추가
ALTER TABLE trash ADD COLUMN IF NOT EXISTS title TEXT;

-- 3. 인덱스 재생성 (컬럼명 변경 반영)
DROP INDEX IF EXISTS idx_pages_fts;
CREATE INDEX IF NOT EXISTS idx_pages_fts ON pages
  USING gin(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(plain_text_content,'')));
