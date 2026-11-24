CREATE TABLE IF NOT EXISTS admission_messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sid TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  kind TEXT,
  evidence_json TEXT,
  suggestions_json TEXT,
  created_at TEXT NOT NULL
);
