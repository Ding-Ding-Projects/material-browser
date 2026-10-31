import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
// The "updated" provenance shown in the title bar is the source commit date, so a
// rebuild of the same source reports the same date.
function sourceDate() {
  if (process.env.SOURCE_DATE_EPOCH) return new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString();
  try {
    return execFileSync("git", ["log", "-1", "--format=%cI"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}
export default defineConfig({
  base: "./",
  define: {
    __MATERIAL_BROWSER_VERSION__: JSON.stringify(version),
    __MATERIAL_BROWSER_BUILT_AT__: JSON.stringify(sourceDate()),
  },
  build: { target: "es2022" },
});
