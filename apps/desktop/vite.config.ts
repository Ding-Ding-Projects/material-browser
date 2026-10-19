import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
export default defineConfig({ base: "./", define: { __MATERIAL_BROWSER_VERSION__: JSON.stringify(version) }, build: { target: "es2022" } });
