-- Incomplete native analysis has no numeric headline. SQLite cannot alter a
-- NOT NULL column, so rebuild while preserving existing append-only rows.
CREATE TABLE audit_runs_next (
  id INTEGER PRIMARY KEY, repo_root TEXT NOT NULL, repo_identity TEXT NOT NULL,
  schema_version TEXT NOT NULL, analyzer_version TEXT NOT NULL, scoring_version TEXT NOT NULL,
  sloppiness_index REAL, partial INTEGER NOT NULL, completeness TEXT NOT NULL,
  report_json TEXT NOT NULL, audited_at TEXT NOT NULL
);
INSERT INTO audit_runs_next
SELECT id, repo_root, repo_identity, schema_version, analyzer_version, scoring_version,
       CASE WHEN partial = 1 THEN NULL ELSE sloppiness_index END,
       partial, completeness, report_json, audited_at FROM audit_runs;
DROP TABLE audit_runs;
ALTER TABLE audit_runs_next RENAME TO audit_runs;
CREATE INDEX audit_runs_identity_time ON audit_runs (repo_identity, audited_at);
