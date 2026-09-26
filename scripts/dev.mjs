// Helper: verify sibling workspaces exist before `npm run dev`.
// Usage: node scripts/dev.mjs  (also used as a predev sanity check)
import { existsSync } from "node:fs";

const required = ["apps/api/package.json", "apps/web/package.json"];
const missing = required.filter((p) => !existsSync(new URL(`../${p}`, import.meta.url)));

if (missing.length > 0) {
  console.error(`[echo:dev] waiting on sibling agents, missing:\n  - ${missing.join("\n  - ")}`);
  console.error(`[echo:dev] root glue is ready; run 'npm run dev' again once apps/* land.`);
  process.exitCode = 1;
} else {
  console.log("[echo:dev] apps/api + apps/web present. Run: npm run dev");
}
