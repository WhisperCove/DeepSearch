use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

/// Database manager with thread-safe connection
pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    /// Open or create the database at the given path
    pub fn open(db_path: &Path) -> Result<Self> {
        tracing::info!("[DB] Opening database at: {:?}", db_path);

        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(db_path)?;

        // Performance pragmas
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        conn.execute_batch("PRAGMA synchronous=NORMAL;")?;
        conn.execute_batch("PRAGMA cache_size=-64000;")?; // 64MB cache

        // Create tables from schema
        conn.execute_batch(include_str!("schema.sql"))?;

        tracing::info!("[DB] Database initialized successfully");

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}
