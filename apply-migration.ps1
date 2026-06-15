$env:PGPASSWORD = "opendesign"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "=== Applying migration: add review_status ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "CREATE TYPE review_status AS ENUM ('open', 'acknowledged', 'ignored', 'resolved'); ALTER TABLE findings ADD COLUMN review_note TEXT, ADD COLUMN review_status review_status NOT NULL DEFAULT 'open', ADD COLUMN reviewed_at TIMESTAMP(3); CREATE INDEX findings_review_status_idx ON findings(review_status);"

Write-Host "`n=== Marking migration as applied ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "UPDATE _prisma_migrations SET finished_at = NOW(), logs = NULL, rolled_back_at = NULL WHERE migration_name = '20260601125906_add_review_workflow_and_accessibility';"

Write-Host "`n=== Verify columns ==="
& $psql -h localhost -U opendesign -d opendesign_qa -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='findings' ORDER BY ordinal_position;"
