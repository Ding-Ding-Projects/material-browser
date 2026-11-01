import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, ButtonGroup, Chip, Dropdown, IconBtn, Ms, Switch, TextField, WavyProgress, cx } from "../../m3";
import { SearchBar, useSearch } from "../../m3/search";
import { useApp } from "../context";
import { explain, onMinecraftEvent } from "../../minecraft-api";

function worldgen<T = any>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
  const bridge = (window as any).materialBrowser;
  if (!bridge?.worldgen) return Promise.reject(new Error("BACKEND_UNAVAILABLE"));
  return bridge.worldgen(operation, params);
}

type Layer = { block: string; height: number };
type GameRule = { name: string; type: "boolean" | "integer" | "unknown"; parser: string };
type WorldCatalogue = {
  supported: boolean;
  reason?: string;
  version: string;
  packFormat: number;
  presets: string[];
  presetOptions?: { id: string; supported: boolean; reason: string | null }[];
  biomes: string[];
  structureSets: string[];
  blocks: string[];
  gameRules: GameRule[];
  flatPresets: { id: string; settings: any }[];
  defaults: Options;
};
type Options = {
  name: string;
  seed: string;
  preset: string;
  flat: { biome: string; features: boolean; lakes: boolean; layers: Layer[]; structure_overrides?: unknown };
  singleBiome: string;
  structures: string[];
  generateStructures: boolean;
  noise: { sea_level: number; aquifers_enabled: boolean; ore_veins_enabled: boolean; disable_mob_generation: boolean; default_block: string; default_fluid: string };
  dimension: { height: number; min_y: number; logical_height: number };
  difficulty: string;
  hardcore: boolean;
  gameRules: Record<string, boolean | number>;
  area: { width: number; depth: number; centerX: number; centerZ: number };
  worldBorder: boolean;
  output: { kind: "folder" | "zip"; destination: string };
};

export const DEFAULT_SIZE = { width: 100, depth: 100 };
const PRESET_LABELS: Record<string, string> = { normal: "Normal", flat: "Superflat", large_biomes: "Large biomes", amplified: "Amplified", single_biome_surface: "Single biome" };
const pretty = (id: string) => id.replace(/^minecraft:/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const PRESET_UNSUPPORTED = "This preset is present in the selected version, but its generator is not implemented by the world customization builder.";
const presetValue = (id: string) => id.replace(/^minecraft:/, "");
function presetInventory(catalogue: WorldCatalogue) {
  return catalogue.presets.map(id => {
    const capability = catalogue.presetOptions?.find(option => option.id === id);
    return { id, value: presetValue(id), supported: capability?.supported === true, reason: capability?.reason || (capability ? PRESET_UNSUPPORTED : "Support information is unavailable for this preset.") };
  });
}
function WorldPresetChoices({ catalogue, value, onChange }: { catalogue: WorldCatalogue; value: string; onChange: (value: string) => void }) {
  const { t } = useApp();
  const inventory = presetInventory(catalogue);
  const selectable = catalogue.supported ? inventory.filter(option => option.supported) : [];
  const unavailable = catalogue.supported ? inventory.filter(option => !option.supported) : inventory;
  return <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
    {selectable.length > 0 && <ButtonGroup label={t("World type")} value={value} onChange={next => { if (selectable.some(option => option.value === next)) onChange(next); }} options={selectable.map(option => [option.value, t(PRESET_LABELS[option.value] || pretty(option.id))] as [string, string])} />}
    {unavailable.length > 0 && <div className="card outlined" style={{ padding: 12, borderRadius: 16 }}>
      <p className="label-l" style={{ margin: "0 0 8px" }}>{t("Unavailable world presets")}</p>
      <ul style={{ margin: 0, paddingInlineStart: 20 }}>
        {unavailable.map(option => <li key={option.id} style={{ overflowWrap: "anywhere" }}><code>{option.id}</code><p className="body-s on-sv" style={{ margin: "4px 0 12px" }}>{t(!catalogue.supported ? catalogue.reason || "World customization is unavailable for the selected version." : option.reason)}</p></li>)}
      </ul>
    </div>}
  </div>;
}

/** World generator, built from the WorldGenerator artboard. */
export function WorldGenerator({ onBack }: { onBack: () => void }) {
  const { t, snack } = useApp();
  const [releases, setReleases] = useState<string[]>([]);
  const [version, setVersion] = useState("");
  const [catalogue, setCatalogue] = useState<WorldCatalogue | null>(null);
  const catalogueRequest = useRef(0);
  const [loading, setLoading] = useState("");
  const [o, setO] = useState<Options | null>(null);
  const [eula, setEula] = useState(false);
  const [job, setJob] = useState<{ done: number; total: number; step: string; error?: string; result?: any } | null>(null);

  useEffect(() => {
    worldgen<{ latest: string; versions: string[] }>("releases")
      .then((r) => {
        setReleases(r.versions);
        setVersion(r.latest);
      })
      .catch((e) => snack(t(explain(e))));
    return onMinecraftEvent((e) => {
      if (e.type !== "minecraft.worldgen") return;
      setJob((j) => {
        const base = j || { done: 0, total: 0, step: "start" };
        if (e.step === "batch") return { ...base, step: "batch", done: e.done, total: e.total };
        if (e.step === "failed") return { ...base, step: "failed", error: e.error };
        if (e.step === "done" && e.result) return { ...base, step: "done", result: e.result };
        return { ...base, step: e.step };
      });
    });
  }, []);
  useEffect(() => {
    const request = ++catalogueRequest.current;
    if (!version) return;
    setCatalogue(null);
    setO(null);
    setLoading(t("Reading this version's world settings from its server…"));
    worldgen<WorldCatalogue>("catalogue", { version })
      .then((c) => {
        if (request !== catalogueRequest.current) return;
        setCatalogue(c);
        if (c.supported) setO({ ...c.defaults, area: { ...c.defaults.area, ...DEFAULT_SIZE } });
      })
      .catch((e) => { if (request === catalogueRequest.current) snack(t(explain(e))); })
      .finally(() => { if (request === catalogueRequest.current) setLoading(""); });
    return () => { if (catalogueRequest.current === request) catalogueRequest.current++; };
  }, [version]);

  const set = <K extends keyof Options>(key: K, value: Options[K]) => setO((x) => (x ? { ...x, [key]: value } : x));
  const running = job && !["done", "failed"].includes(job.step);
  const browse = async () => {
    if (!o) return;
    const dest = await worldgen<string | null>("browse", { kind: o.output.kind, name: o.name });
    if (dest) set("output", { ...o.output, destination: dest });
  };
  const presetReady = !!(catalogue?.supported && catalogue.version === version && o && presetInventory(catalogue).some(option => option.supported && option.value === o.preset));
  const start = async () => {
    if (!o) return;
    if (!presetReady) { snack(t(PRESET_UNSUPPORTED)); return; }
    try {
      const r = await worldgen<{ batches: number }>("start", { version, options: o, eulaAccepted: eula });
      setJob({ done: 0, total: r.batches, step: "start" });
    } catch (e) {
      snack(t(explain(e)));
    }
  };

  return (
    <section className="pane scroll" aria-labelledby="wg-h" style={{ flex: 1, minWidth: 0, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <IconBtn icon="arrow_back" label={t("Back to servers")} onClick={onBack} />
        <Ms name="public" size={32} className="c-primary" />
        <h1 id="wg-h" className="headline-s" style={{ margin: 0, flex: 1 }}>{t("Generate a world")}</h1>
        <div style={{ minWidth: 200 }}>
          <Dropdown label={t("Java version")} value={version} options={releases.map((v) => [v, v] as [string, string])} onChange={setVersion} />
        </div>
      </div>
      {loading && <p className="body-m on-sv">{loading}</p>}
      {catalogue && !catalogue.supported && <div className="card tint" style={{ padding: 16, borderRadius: 20, display: "flex", gap: 12 }}><Ms name="block" /><p className="body-m" style={{ margin: 0 }}>{t(catalogue.reason || "")}</p></div>}
      {catalogue && !catalogue.supported && <WorldPresetChoices catalogue={catalogue} value="" onChange={() => {}} />}
      {catalogue?.supported && o && (
        <>
          <span className="chip" style={{ pointerEvents: "none", alignSelf: "flex-start" }}><Ms name="verified" />Java {catalogue.version} · {t("lists read from this version's server")}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
            <SizePanel o={o} set={set} />
            <WorldPanel o={o} set={set} catalogue={catalogue} />
          </div>
          <section className="pane low" aria-labelledby="out-h" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 id="out-h" className="title-l" style={{ margin: 0 }}>{t("Save to")}</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <ButtonGroup label={t("Output format")} value={o.output.kind} onChange={(kind) => set("output", { kind, destination: "" })} options={[["folder", t("Folder")], ["zip", t("ZIP file")]]} />
              <div style={{ flex: "1 1 320px" }}><TextField label={t(o.output.kind === "zip" ? "ZIP file" : "Folder")} value={o.output.destination} mono onChange={() => {}} placeholder={t("Choose with Browse")} /></div>
              <Btn variant="tonal" size="m" icon="folder_open" onClick={() => void browse()}>{t("Browse")}</Btn>
            </div>
            <p className="body-s on-sv" style={{ margin: 0 }}>
              {t(o.output.kind === "zip" ? "One ZIP with the world and its data pack, ready to share or upload." : "A world folder you can drop into a server or a saves folder.")} {t("Existing files are never replaced. The result is opened and checked before it is called done.")}
            </p>
            <div className="li plain" style={{ gap: 12 }}>
              <span className="txt"><span className="body-l">{t("I have read and accept the Minecraft EULA")}</span><span className="sup">{t("Generating runs this version's server once in a private folder.")} <a href="https://www.minecraft.net/en-us/eula" target="_blank" rel="noreferrer">minecraft.net/eula</a></span></span>
              <Switch checked={eula} onChange={setEula} label={t("Accept the Minecraft EULA")} />
            </div>
            {job && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {running && <WavyProgress label={t("Generating")} value={job.total ? job.done / job.total : 0} indeterminate={!job.done} />}
                <p className="body-m" role="status" style={{ margin: 0 }}>
                  {job.step === "batch" ? `${t("Batch")} ${job.done} ${t("of")} ${job.total} · ${t("chunks loaded by the server")}`
                    : job.step === "failed" ? `${t("Generation stopped")}: ${t(explain(job.error || ""))}`
                    : job.step === "done" ? `${t("World saved")} · ${job.result?.files} ${t("files")} · ${job.result?.path}`
                    : t(job.step === "ready" ? "Server ready, setting rules" : job.step === "saved" ? "Saving the world" : "Starting the server")}
                </p>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Btn variant="outlined" size="m" disabled={!running} onClick={() => void worldgen("cancel")}>{t("Cancel")}</Btn>
              <Btn size="m" icon="public" disabled={!!running || !eula || !o.output.destination || !presetReady} onClick={() => void start()}>{t("Generate world")}</Btn>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

/** Drawing canvas plus steppers for the generation area, in chunks. */
function SizePanel({ o, set }: { o: Options; set: <K extends keyof Options>(k: K, v: Options[K]) => void }) {
  const { t } = useApp();
  const a = o.area;
  const view = Math.max(200, Math.ceil(Math.max(a.width, a.depth) * 1.25));
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<null | { mode: "move" | "draw"; sx: number; sz: number; ox: number; oz: number }>(null);
  const x1 = a.centerX - Math.floor(a.width / 2), z1 = a.centerZ - Math.floor(a.depth / 2);
  const setArea = (next: Partial<Options["area"]>) => {
    const n = { ...a, ...next };
    n.width = Math.max(1, Math.min(1000, Math.round(n.width)));
    n.depth = Math.max(1, Math.min(1000, Math.round(n.depth)));
    set("area", n);
  };
  const cell = (e: React.PointerEvent) => {
    const r = grid.current!.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * view - view / 2), Math.floor(((e.clientY - r.top) / r.height) * view - view / 2)];
  };
  const fromCorners = (ax: number, az: number, bx: number, bz: number) => {
    const w = Math.abs(bx - ax) + 1, d = Math.abs(bz - az) + 1;
    setArea({ width: w, depth: d, centerX: Math.min(ax, bx) + Math.floor(w / 2), centerZ: Math.min(az, bz) + Math.floor(d / 2) });
  };
  const keys = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key as string];
    if (!step) return;
    e.preventDefault();
    if (e.shiftKey) setArea({ width: a.width + step[0], depth: a.depth + step[1] });
    else setArea({ centerX: a.centerX + step[0], centerZ: a.centerZ + step[1] });
  };
  const pct = (v: number) => `${((v + view / 2) / view) * 100}%`;
  const chunks = a.width * a.depth;
  const batches = Math.ceil(a.width / 16) * Math.ceil(a.depth / 16);
  return (
    <section className="pane" aria-labelledby="size-h" style={{ flex: "1 1 460px", minWidth: 0, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 id="size-h" className="title-l" style={{ margin: 0 }}>{t("Size to generate")}</h2>
      <p className="body-s on-sv" style={{ margin: 0 }}>{t("Drag on the grid to draw the area, drag the area to move it, or use the fields. Each square is one chunk, 16 × 16 blocks.")} {t("With the grid focused, arrow keys move the area and Shift with arrow keys resizes it.")}</p>
      <div
        ref={grid}
        role="application"
        tabIndex={0}
        aria-label={`${t("Generation area drawing canvas")}, ${a.width} × ${a.depth} ${t("chunks")}`}
        onKeyDown={keys}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          const [cx, cz] = cell(e);
          const inside = cx >= x1 && cx < x1 + a.width && cz >= z1 && cz < z1 + a.depth;
          drag.current = inside ? { mode: "move", sx: cx, sz: cz, ox: cx - a.centerX, oz: cz - a.centerZ } : { mode: "draw", sx: cx, sz: cz, ox: 0, oz: 0 };
          if (!inside) fromCorners(cx, cz, cx, cz);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const [cx, cz] = cell(e);
          if (d.mode === "move") setArea({ centerX: cx - d.ox, centerZ: cz - d.oz });
          else fromCorners(d.sx, d.sz, cx, cz);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        style={{
          position: "relative", width: 400, maxWidth: "100%", aspectRatio: "1", borderRadius: 16, overflow: "hidden", touchAction: "none", cursor: "crosshair",
          backgroundColor: "var(--surface-container-highest)",
          backgroundImage: "linear-gradient(var(--outline-variant) 1px, transparent 1px), linear-gradient(90deg, var(--outline-variant) 1px, transparent 1px)",
          backgroundSize: `${(10 / view) * 100}% ${(10 / view) * 100}%`,
        }}
      >
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--outline)" }} />
        <div aria-hidden="true" style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "var(--outline)" }} />
        <div aria-hidden="true" style={{ position: "absolute", left: pct(x1), top: pct(z1), width: `${(a.width / view) * 100}%`, height: `${(a.depth / view) * 100}%`, boxSizing: "border-box", border: "2px solid var(--primary)", background: "color-mix(in srgb, var(--primary-container) 70%, transparent)", borderRadius: 6 }}>
          <span className="label-m" style={{ position: "absolute", left: 6, top: 4, color: "var(--on-primary-container)" }}>{a.width} × {a.depth}</span>
        </div>
        <span className="label-s on-sv" aria-hidden="true" style={{ position: "absolute", right: 6, bottom: 4 }}>{view} × {view} {t("chunks shown")}</span>
      </div>
      {(["width", "depth"] as const).map((k) => (
        <div key={k} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="label-l" style={{ minWidth: 64 }}>{t(k === "width" ? "Width" : "Depth")}</span>
          <IconBtn icon="remove" variant="outlined" size="sm" label={t(k === "width" ? "Narrower" : "Shallower")} onClick={() => setArea({ [k]: a[k] - 1 })} />
          <div style={{ width: 120 }}><TextField label={t("Chunks")} inputMode="numeric" value={String(a[k])} onChange={(v) => /^\d{1,4}$/.test(v) && setArea({ [k]: Number(v) })} /></div>
          <IconBtn icon="add" variant="outlined" size="sm" label={t(k === "width" ? "Wider" : "Deeper")} onClick={() => setArea({ [k]: a[k] + 1 })} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant="tonal" size="xs" icon="restart_alt" onClick={() => setArea({ ...DEFAULT_SIZE })}>{t("Default 100 × 100")}</Btn>
        <Btn variant="text" size="xs" icon="filter_center_focus" onClick={() => setArea({ centerX: 0, centerZ: 0 })}>{t("Centre on spawn")}</Btn>
      </div>
      <div className="card tint" style={{ padding: 14, borderRadius: 20 }}>
        <p className="body-m" style={{ margin: 0 }}>{a.width * 16} × {a.depth * 16} {t("blocks")} · {chunks.toLocaleString()} {t("chunks")} · {batches} {t("batches of up to 256 chunks")}</p>
        <p className="body-s on-sv" style={{ margin: "4px 0 0" }}>{t("Time and disk use grow with the area. Progress is reported by the server batch by batch.")}</p>
      </div>
      <div className="li plain" style={{ gap: 12 }}>
        <span className="txt"><span className="body-l">{t("Set the world border to this area")}</span><span className="sup mono">worldborder set</span></span>
        <Switch checked={o.worldBorder} onChange={(v) => set("worldBorder", v)} label={t("Set the world border to this area")} />
      </div>
    </section>
  );
}

/** Pick one id from a version's registry, with search; never free text. */
function RegistryPicker({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const { t } = useApp();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "_");
    return (q ? options.filter((id) => id.includes(q)) : options).slice(0, 8);
  }, [query, options]);
  return (
    <div style={{ flex: "2 1 200px", position: "relative" }}>
      <TextField label={label} value={open ? query : pretty(value)} icon="search" onChange={(v) => { setQuery(v); setOpen(true); }} onKeyDown={(e) => e.key === "Escape" && setOpen(false)} />
      {open && (
        <div className="menu" role="listbox" aria-label={label} style={{ position: "absolute", zIndex: 5, left: 0, right: 0, maxHeight: 280, overflow: "auto" }}>
          {matches.length === 0 && <div className="mi" aria-disabled="true">{t("Nothing in this version matches")}</div>}
          {matches.map((id) => (
            <button key={id} type="button" role="option" aria-selected={id === value} className={cx("mi", id === value && "sel")} onClick={() => { onChange(id); setOpen(false); setQuery(""); }}>
              {pretty(id)} <span className="mono body-s on-sv">{id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stepper({ label, value, step = 1, min, max, onChange, unit }: { label: string; value: number; step?: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) {
  const { t } = useApp();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <IconBtn icon="remove" variant="outlined" size="sm" label={`${t("Lower")} ${label}`} onClick={() => onChange(clamp(value - step))} />
      <div style={{ width: 110 }}><TextField label={unit || label} inputMode="numeric" value={String(value)} onChange={(v) => /^-?\d{1,5}$/.test(v) && onChange(clamp(Number(v)))} /></div>
      <IconBtn icon="add" variant="outlined" size="sm" label={`${t("Raise")} ${label}`} onClick={() => onChange(clamp(value + step))} />
    </div>
  );
}

function WorldPanel({ o, set, catalogue }: { o: Options; set: <K extends keyof Options>(k: K, v: Options[K]) => void; catalogue: WorldCatalogue }) {
  const { t } = useApp();
  const ruleSearch = useSearch(catalogue.gameRules.map((r) => r.name));
  const shownRules = ruleSearch.query ? ruleSearch.indices.map((i) => catalogue.gameRules[i]) : catalogue.gameRules;
  const layersTopDown = o.flat.layers.slice().reverse();
  const setLayers = (topDown: Layer[]) => set("flat", { ...o.flat, layers: topDown.slice().reverse() });
  const total = o.flat.layers.reduce((n, l) => n + l.height, 0);
  const applyFlatPreset = (id: string) => {
    const s = catalogue.flatPresets.find((p) => p.id === id)?.settings;
    if (!s) return;
    const so = Array.isArray(s.structure_overrides) ? s.structure_overrides : typeof s.structure_overrides === "string" && !s.structure_overrides.startsWith("#") ? [s.structure_overrides] : [];
    set("flat", { biome: s.biome, features: !!s.features, lakes: !!s.lakes, layers: s.layers });
    set("structures", so.filter((x: string) => catalogue.structureSets.includes(x)));
  };
  const toggleStructure = (id: string) => set("structures", o.structures.includes(id) ? o.structures.filter((s) => s !== id) : [...o.structures, id]);
  const dim = o.dimension;
  return (
    <section className="pane low" aria-labelledby="world-h" style={{ flex: "1.3 1 520px", minWidth: 0, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 id="world-h" className="title-l" style={{ margin: 0 }}>{t("World")}</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 200px" }}><TextField label={t("World name")} value={o.name} maxLength={40} onChange={(v) => set("name", v.replace(/[^A-Za-z0-9 _-]/g, ""))} /></div>
        <div style={{ flex: "1 1 200px" }}><TextField label={t("Seed")} value={o.seed} maxLength={64} supporting={t("Leave empty for a random seed")} onChange={(v) => set("seed", v.replace(/[\r\n]/g, ""))} /></div>
        <Btn variant="tonal" size="m" icon="casino" onClick={() => set("seed", String(Math.floor(Math.random() * 2 ** 53) - 2 ** 52))}>{t("Random seed")}</Btn>
      </div>
      <WorldPresetChoices catalogue={catalogue} value={o.preset} onChange={value => set("preset", value)} />
      {o.preset === "flat" && (
        <div className="card outlined" style={{ padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><h3 className="title-m" style={{ margin: 0, flex: 1 }}>{t("Superflat layers")}</h3><span className="label-s on-sv">{t("Top to bottom")}</span></div>
          <div role="group" aria-label={t("Start from a preset")} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {catalogue.flatPresets.map((p) => <Chip key={p.id} onClick={() => applyFlatPreset(p.id)}>{pretty(p.id)}</Chip>)}
          </div>
          <div className="seglist">
            {layersTopDown.map((l, i) => (
              <div key={i} className="li plain" style={{ gap: 6, flexWrap: "wrap" }}>
                <RegistryPicker label={`${t("Block for layer")} ${i + 1}`} value={l.block} options={catalogue.blocks} onChange={(b) => setLayers(layersTopDown.map((x, j) => (j === i ? { ...x, block: b } : x)))} />
                <Stepper label={`${t("Height of layer")} ${i + 1}`} unit={t("Height")} value={l.height} min={1} max={dim.height} onChange={(h) => setLayers(layersTopDown.map((x, j) => (j === i ? { ...x, height: h } : x)))} />
                <IconBtn icon="arrow_upward" size="sm" label={`${t("Move layer up")} ${i + 1}`} disabled={i === 0} onClick={() => { const n = layersTopDown.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; setLayers(n); }} />
                <IconBtn icon="arrow_downward" size="sm" label={`${t("Move layer down")} ${i + 1}`} disabled={i === layersTopDown.length - 1} onClick={() => { const n = layersTopDown.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; setLayers(n); }} />
                <IconBtn icon="delete" size="sm" label={`${t("Remove layer")} ${i + 1}`} onClick={() => setLayers(layersTopDown.filter((_, j) => j !== i))} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Btn variant="tonal" size="xs" icon="add" disabled={o.flat.layers.length >= 64} onClick={() => setLayers([{ block: "minecraft:stone", height: 1 }, ...layersTopDown])}>{t("Add layer")}</Btn>
            <span className={cx("body-s", total > dim.height ? "c-error" : "on-sv")}>{t("Total height")} {total} / {dim.height} {t("blocks")}</span>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <RegistryPicker label={t("Biome")} value={o.flat.biome} options={catalogue.biomes} onChange={(b) => set("flat", { ...o.flat, biome: b })} />
            <div className="li plain" style={{ gap: 8 }}><span className="txt body-m">{t("Features")}</span><Switch checked={o.flat.features} onChange={(v) => set("flat", { ...o.flat, features: v })} label={t("Features")} /></div>
            <div className="li plain" style={{ gap: 8 }}><span className="txt body-m">{t("Lakes")}</span><Switch checked={o.flat.lakes} onChange={(v) => set("flat", { ...o.flat, lakes: v })} label={t("Lakes")} /></div>
          </div>
        </div>
      )}
      {o.preset === "single_biome_surface" && <RegistryPicker label={t("Biome for the whole world")} value={o.singleBiome} options={catalogue.biomes} onChange={(b) => set("singleBiome", b)} />}
      <div className="li plain" style={{ gap: 12 }}><span className="txt body-l">{t("Generate structures")}</span><Switch checked={o.generateStructures} onChange={(v) => set("generateStructures", v)} label={t("Generate structures")} /></div>
      {o.preset === "flat" && (
        <div role="group" aria-label={t("Structures to generate")} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {catalogue.structureSets.map((s) => <Chip key={s} on={o.structures.includes(s)} onClick={() => toggleStructure(s)}>{pretty(s)}</Chip>)}
        </div>
      )}
      <details className="card outlined" style={{ padding: "12px 16px", borderRadius: 20 }}>
        <summary className="title-s" style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>{t("Terrain and dimension")}</summary>
        <div className="seglist" style={{ marginTop: 8 }}>
          <div className="li plain" style={{ gap: 8, flexWrap: "wrap" }}><span className="txt"><span className="body-l">{t("Sea level")}</span><span className="sup mono">noise_settings sea_level</span></span><Stepper label={t("Sea level")} unit="Y" value={o.noise.sea_level} min={dim.min_y} max={dim.min_y + dim.height} onChange={(v) => set("noise", { ...o.noise, sea_level: v })} /></div>
          <div className="li plain" style={{ gap: 8 }}><span className="txt"><span className="body-l">{t("Underground water and lava pockets")}</span><span className="sup mono">aquifers_enabled</span></span><Switch checked={o.noise.aquifers_enabled} onChange={(v) => set("noise", { ...o.noise, aquifers_enabled: v })} label={t("Underground water and lava pockets")} /></div>
          <div className="li plain" style={{ gap: 8 }}><span className="txt"><span className="body-l">{t("Large ore veins")}</span><span className="sup mono">ore_veins_enabled</span></span><Switch checked={o.noise.ore_veins_enabled} onChange={(v) => set("noise", { ...o.noise, ore_veins_enabled: v })} label={t("Large ore veins")} /></div>
          <div className="li plain" style={{ gap: 8 }}><span className="txt"><span className="body-l">{t("No animals when chunks are first made")}</span><span className="sup mono">disable_mob_generation</span></span><Switch checked={o.noise.disable_mob_generation} onChange={(v) => set("noise", { ...o.noise, disable_mob_generation: v })} label={t("No animals when chunks are first made")} /></div>
          <div className="li plain" style={{ gap: 8, flexWrap: "wrap" }}><span className="txt" style={{ flex: "1 1 160px" }}><span className="body-l">{t("Main block")}</span><span className="sup mono">default_block</span></span><RegistryPicker label={t("Main block")} value={o.noise.default_block} options={catalogue.blocks} onChange={(v) => set("noise", { ...o.noise, default_block: v })} /></div>
          <div className="li plain" style={{ gap: 8, flexWrap: "wrap" }}><span className="txt" style={{ flex: "1 1 160px" }}><span className="body-l">{t("Sea fluid")}</span><span className="sup mono">default_fluid</span></span><RegistryPicker label={t("Sea fluid")} value={o.noise.default_fluid} options={catalogue.blocks.filter((b) => b === "minecraft:water" || b === "minecraft:lava" || b === "minecraft:air")} onChange={(v) => set("noise", { ...o.noise, default_fluid: v })} /></div>
          <div className="li plain" style={{ gap: 8, flexWrap: "wrap" }}><span className="txt"><span className="body-l">{t("World height")}</span><span className="sup mono">dimension_type height · {t("multiple of 16")}</span></span><Stepper label={t("World height")} unit={t("Blocks")} step={16} value={dim.height} min={16} max={4064} onChange={(v) => set("dimension", { ...dim, height: v, logical_height: Math.min(dim.logical_height, v) })} /></div>
          <div className="li plain" style={{ gap: 8, flexWrap: "wrap" }}><span className="txt"><span className="body-l">{t("Lowest Y")}</span><span className="sup mono">dimension_type min_y · {t("multiple of 16")}</span></span><Stepper label={t("Lowest Y")} unit="Y" step={16} value={dim.min_y} min={-2032} max={2016} onChange={(v) => set("dimension", { ...dim, min_y: v })} /></div>
          <div className="li plain" style={{ gap: 8, flexWrap: "wrap" }}><span className="txt"><span className="body-l">{t("Height for portals and chorus fruit")}</span><span className="sup mono">logical_height</span></span><Stepper label={t("Logical height")} unit={t("Blocks")} value={dim.logical_height} min={0} max={dim.height} onChange={(v) => set("dimension", { ...dim, logical_height: v })} /></div>
        </div>
      </details>
      <details className="card outlined" style={{ padding: "12px 16px", borderRadius: 20 }}>
        <summary className="title-s" style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>{t("Game rules")} · {catalogue.gameRules.length} {t("for this version")}</summary>
        <div style={{ margin: "8px 0" }}><SearchBar small label={t("Search game rules")} placeholder={t("Search game rules")} query={ruleSearch.query} setQuery={ruleSearch.setQuery} state={ruleSearch.state} setState={ruleSearch.setState} status={ruleSearch.status} t={t} /></div>
        <div className="seglist">
          {shownRules.map((r) => {
            const value = o.gameRules[r.name];
            const change = (v: boolean | number | undefined) => { const next = { ...o.gameRules }; if (v === undefined) delete next[r.name]; else next[r.name] = v; set("gameRules", next); };
            return (
              <div key={r.name} className="li plain" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="txt" style={{ flex: "1 1 200px" }}><span className="body-l mono">{r.name}</span><span className="sup">{value === undefined ? t("Server default") : t("Set by you")}</span></span>
                {r.type === "boolean" ? <Switch checked={value === true} onChange={(v) => change(v)} label={r.name} />
                  : r.type === "integer" ? <Stepper label={r.name} unit={t("Value")} value={typeof value === "number" ? value : 0} min={-2147483648} max={2147483647} onChange={(v) => change(v)} />
                  : <span className="body-s on-sv">{t("No control for this rule type yet")} ({r.parser})</span>}
                {value !== undefined && <IconBtn icon="undo" size="sm" label={`${t("Use the server default for")} ${r.name}`} onClick={() => change(undefined)} />}
              </div>
            );
          })}
        </div>
      </details>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <ButtonGroup label={t("Difficulty")} value={o.difficulty} onChange={(v) => set("difficulty", v)} options={["peaceful", "easy", "normal", "hard"].map((d) => [d, t(d[0].toUpperCase() + d.slice(1))] as [string, string])} />
        <div className="li plain" style={{ gap: 8 }}><span className="txt body-m">{t("Hardcore")}</span><Switch checked={o.hardcore} onChange={(v) => set("hardcore", v)} label={t("Hardcore")} /></div>
      </div>
    </section>
  );
}


