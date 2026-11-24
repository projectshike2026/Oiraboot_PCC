CREATE TABLE IF NOT EXISTS scholarships(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT,
  min_cgpa REAL NOT NULL DEFAULT 0,
  departments_json TEXT NOT NULL,
  need_based INTEGER NOT NULL DEFAULT 0,
  amount_text TEXT,
  amount_value REAL,
  deadline TEXT,
  deadline_text TEXT,
  url TEXT,
  description TEXT,
  requirements TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS searches(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sid TEXT NOT NULL,
  cgpa REAL NOT NULL,
  department TEXT NOT NULL,
  needs_support INTEGER NOT NULL,
  lang TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reasons(
  cache_key TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  steps_json TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);
