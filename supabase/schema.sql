-- =============================================
-- OneNote Clone – Supabase SQL Migration
-- Supabase SQL Editor에 전체 내용을 붙여넣고 실행하세요.
-- =============================================

-- UUID 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- notebooks 테이블 (자기참조 트리, 최대 depth 3)
-- =============================================
CREATE TABLE IF NOT EXISTS notebooks (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id   UUID        REFERENCES notebooks(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT '제목 없음',
  icon        TEXT        NOT NULL DEFAULT '📁',
  color       TEXT,
  depth       INTEGER     NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 3),
  is_expanded BOOLEAN     NOT NULL DEFAULT false,
  is_pinned   BOOLEAN     NOT NULL DEFAULT false,
  is_archived BOOLEAN     NOT NULL DEFAULT false,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- pages 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS pages (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id        UUID        NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title              TEXT        NOT NULL DEFAULT '제목 없음',
  content            JSONB,                    -- TipTap JSON
  plain_text_content TEXT        NOT NULL DEFAULT '',  -- 전문 검색용
  is_pinned          BOOLEAN     NOT NULL DEFAULT false,
  is_archived        BOOLEAN     NOT NULL DEFAULT false,
  sort_order         INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- tags
-- =============================================
CREATE TABLE IF NOT EXISTS tags (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS page_tags (
  page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
  tag_id  UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

-- =============================================
-- attachments (Supabase Storage 연동)
-- =============================================
CREATE TABLE IF NOT EXISTS attachments (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id      UUID        NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  file_name    TEXT        NOT NULL,
  file_size    INTEGER     NOT NULL,
  mime_type    TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,  -- Supabase Storage bucket 내 경로
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- favorites (즐겨찾기)
-- =============================================
CREATE TABLE IF NOT EXISTS favorites (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type  TEXT        NOT NULL CHECK (item_type IN ('notebook', 'page')),
  item_id    UUID        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- =============================================
-- recent_pages (최근 방문 페이지)
-- =============================================
CREATE TABLE IF NOT EXISTS recent_pages (
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id    UUID        REFERENCES pages(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page_id)
);

-- =============================================
-- trash (휴지통)
-- =============================================
CREATE TABLE IF NOT EXISTS trash (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type          TEXT        NOT NULL CHECK (item_type IN ('notebook', 'page')),
  item_id            UUID        NOT NULL,
  original_parent_id UUID,               -- 복원 위치
  deleted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- =============================================
-- profiles (사용자 공개 정보)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 회원가입 시 자동으로 profile 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================
-- notebook depth 강제 트리거 (최대 3단계)
-- =============================================
CREATE OR REPLACE FUNCTION check_notebook_depth()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  parent_depth INTEGER;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.depth := 0;
    RETURN NEW;
  END IF;

  SELECT depth INTO parent_depth FROM notebooks WHERE id = NEW.parent_id;

  IF parent_depth IS NULL THEN
    RAISE EXCEPTION 'Parent notebook not found: %', NEW.parent_id;
  END IF;

  IF parent_depth >= 3 THEN
    RAISE EXCEPTION 'Maximum notebook depth (3) exceeded';
  END IF;

  NEW.depth := parent_depth + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_notebook_depth ON notebooks;
CREATE TRIGGER enforce_notebook_depth
  BEFORE INSERT OR UPDATE ON notebooks
  FOR EACH ROW EXECUTE PROCEDURE check_notebook_depth();

-- =============================================
-- updated_at 자동 갱신 트리거
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER notebooks_updated_at
  BEFORE UPDATE ON notebooks
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- =============================================
-- Row Level Security (RLS)
-- =============================================
ALTER TABLE notebooks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_tags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE trash        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;

-- notebooks
CREATE POLICY "own notebooks" ON notebooks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pages
CREATE POLICY "own pages" ON pages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tags
CREATE POLICY "own tags" ON tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- page_tags (pages를 통해 소유 확인)
CREATE POLICY "own page_tags" ON page_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pages
      WHERE pages.id = page_tags.page_id
        AND pages.user_id = auth.uid()
    )
  );

-- attachments
CREATE POLICY "own attachments" ON attachments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- favorites
CREATE POLICY "own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- recent_pages
CREATE POLICY "own recent_pages" ON recent_pages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- trash
CREATE POLICY "own trash" ON trash
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- profiles
CREATE POLICY "profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);
CREATE POLICY "users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX IF NOT EXISTS idx_notebooks_user_id   ON notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_parent_id ON notebooks(parent_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_depth     ON notebooks(user_id, depth);

CREATE INDEX IF NOT EXISTS idx_pages_user_id     ON pages(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_notebook_id ON pages(notebook_id);
-- 한국어 전문 검색 인덱스 (korean 사전 필요 시 simple로 대체)
CREATE INDEX IF NOT EXISTS idx_pages_fts ON pages
  USING gin(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(plain_text_content,'')));

CREATE INDEX IF NOT EXISTS idx_recent_pages_visited ON recent_pages(user_id, visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id    ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_trash_user_id        ON trash(user_id);

-- =============================================
-- Realtime 구독 활성화
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE notebooks;
ALTER PUBLICATION supabase_realtime ADD TABLE pages;
