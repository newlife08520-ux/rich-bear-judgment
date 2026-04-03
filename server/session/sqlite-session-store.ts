import session from "express-session";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export class SqliteSessionStore extends session.Store {
  private db: Database.Database;
  private getStmt: Database.Statement;
  private setStmt: Database.Statement;
  private delStmt: Database.Statement;

  constructor(dbPath: string) {
    super();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expired INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
    `);
    this.getStmt = this.db.prepare(
      "SELECT sess FROM sessions WHERE sid = ? AND expired > ?"
    );
    this.setStmt = this.db.prepare(
      "INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)"
    );
    this.delStmt = this.db.prepare("DELETE FROM sessions WHERE sid = ?");
    this.prune();
  }

  private prune(): void {
    try {
      this.db.prepare("DELETE FROM sessions WHERE expired <= ?").run(Date.now());
    } catch {
      /* ignore */
    }
  }

  get(sid: string, callback: (err: unknown, sess?: session.SessionData | null) => void): void {
    try {
      const row = this.getStmt.get(sid, Date.now()) as { sess: string } | undefined;
      if (!row) return callback(null, null);
      callback(null, JSON.parse(row.sess) as session.SessionData);
    } catch (e) {
      callback(e);
    }
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    try {
      const exp =
        sess.cookie?.expires instanceof Date
          ? sess.cookie.expires.getTime()
          : Date.now() + 24 * 60 * 60 * 1000;
      this.setStmt.run(sid, JSON.stringify(sess), exp);
      callback?.();
    } catch (e) {
      callback?.(e);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      this.delStmt.run(sid);
      callback?.();
    } catch (e) {
      callback?.(e);
    }
  }

  touch(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    this.set(sid, sess, callback);
  }
}
