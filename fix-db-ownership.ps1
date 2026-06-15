# Run as postgres to fix ownership and add missing column
$env:PGPASSWORD = "postgres"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "=== Transferring table ownership to opendesign ==="
$tables = @("projects","audit_runs","viewport_runs","findings","finding_evidence","capture_artifacts","figma_references","ignore_rules","_prisma_migrations")
foreach ($t in $tables) {
    $result = & $psql -h localhost -U postgres -d opendesign_qa -c "ALTER TABLE $t OWNER TO opendesign;" 2>&1
    Write-Host "  $t : $result"
}

Write-Host "`n=== Adding missing review columns to findings ==="
$addCols = @"
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
    CREATE TYPE review_status AS ENUM ('open','acknowledged','ignored','resolved');
  END IF;
END;
\$\$;

ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS review_status review_status NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP(3);
"@
$result2 = & $psql -h localhost -U postgres -d opendesign_qa -c $addCols 2>&1
Write-Host $result2

Write-Host "`n=== Verify findings columns ==="
& $psql -h localhost -U postgres -d opendesign_qa -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='findings' ORDER BY ordinal_position;"
