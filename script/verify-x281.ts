import * as fs from "fs";
import * as path from "path";
const r = path.join(process.cwd());
const led = fs.readFileSync(path.join(r, "server", "modules", "execution", "execution-adjust-ledger.ts"), "utf8");
const pause = fs.readFileSync(
  path.join(r, "server", "modules", "execution", "handlers", "meta-campaign-pause-handler.ts"),
  "utf8"
);
if (!led.includes("campaign:") || !led.includes("metaAdSetId")) process.exit(1);
if (!pause.includes("entityKeys")) process.exit(1);
console.log("[verify:batch28_1:adjust-ledger-autoappend] OK");
