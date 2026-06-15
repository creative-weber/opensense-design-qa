DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
    CREATE TYPE review_status AS ENUM ('open','acknowledged','ignored','resolved');
  END IF;
END;
$$;

ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS review_status review_status NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS findings_review_status_idx ON findings(review_status);
