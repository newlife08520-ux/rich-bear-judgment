import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import fs from "fs";

const dbFile = process.env.DATABASE_URL?.replace(/^file:/, "") ?? path.join(process.cwd(), ".data", "workbench.db");
const dbPath = path.isAbsolute(dbFile) ? dbFile : path.resolve(process.cwd(), dbFile);
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
export const prisma = new PrismaClient({ adapter });
