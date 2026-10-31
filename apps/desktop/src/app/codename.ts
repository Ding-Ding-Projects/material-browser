import { DIM_SUM } from "./locks-model.mjs";
/** Every release carries a dim sum code name, chosen from its version number. */
export function codeName(version: string) {
  const parts = String(version).split(".").map((n) => Number(n) || 0);
  const index = (parts[0] * 100 + parts[1] * 10 + parts[2]) % DIM_SUM.length;
  return `${DIM_SUM[index][0]} · ${DIM_SUM[index][1]}`;
}
