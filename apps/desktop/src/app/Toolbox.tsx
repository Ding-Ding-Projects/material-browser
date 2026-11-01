/* Toolbox: the local file converter and the offline changelog, side by side as in
   design/remaining-features/Toolbox.dc.html. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Btn, ButtonGroup, Chip, IconBtn, LinearProgress, Ms, TextField, cx } from "../m3";
import { SearchBar, useSearch } from "../m3/search";
import { useApp } from "./context";
import {
  converter,
  converterAvailable,
  pathOfDroppedFile,
  type ConverterCategory,
  type ConverterCategoryId,
  type ConverterJob,
  type ConverterTarget,
  type InspectedFile,
} from "../converter-api";
import changelog from "../../assets/changelog.json";
import { APP_VERSION } from "../build-version";

const CATEGORY_ORDER: [ConverterCategoryId, string][] = [
  ["image", "Images"],
  ["document", "Documents"],
  ["data", "Data"],
  ["media", "Audio and video"],
];
const CATEGORY_ICON: Record<string, string> = { image: "image", document: "description", data: "table", media: "movie" };
const TARGET_LABEL: Record<string, string> = {
  png: "PNG",
  jpeg: "JPEG",
  json: "JSON",
  "json-pretty": "JSON",
  "json-minified": "Minified JSON",
  csv: "CSV",
};
const ERROR_TEXT: Record<string, string> = {
  TOO_LARGE: "The file is larger than the limit for its category",
  CSV_INVALID: "The file is not valid CSV",
  CSV_ROW_WIDTH: "A CSV record has a different number of fields from the header",
  JSON_INVALID: "The file is not valid JSON",
  JSON_SHAPE: "This JSON is not a table, so it cannot become CSV",
  BOOKMARKS_INVALID: "This file is not a browser bookmark export",
  NOT_UTF8: "Data files must be UTF-8 text",
  IMAGE_INVALID: "The image could not be decoded",
  VERIFY_FAILED: "The output did not pass verification. Changed files were preserved; check the output folder before retrying.",
  OUTPUT_FOLDER_CHANGED: "The selected output folder changed. Reselect the output folder before converting again.",
  NOT_A_FILE: "The input is not a regular file",
  ENOENT: "The file could not be read",
  EACCES: "The file could not be read",
  EPERM: "The file could not be read",
};
const STAGE_TEXT: Record<string, string> = { reading: "Reading", converting: "Converting", writing: "Writing", checking: "Checking" };

function formatSize(bytes: number | null) {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The design's per-category unavailable sentence, so audio and video read as in the artboard. */
function unavailableText(category: string | null, file: string) {
  if (category === "media") {
    return /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file)
      ? "Unavailable: no bundled audio converter in this build"
      : "Unavailable: no bundled video converter in this build";
  }
  if (category === "document") return "Unavailable: no bundled document converter in this build";
  return null;
}

/** The target named in the row title: "photo.png → JPEG". For unavailable media, the usual target. */
function targetLabel(job: ConverterJob) {
  if (job.target && TARGET_LABEL[job.target]) return TARGET_LABEL[job.target];
  if (job.category === "media") return /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(job.name) ? "MP3" : "MP4";
  if (job.category === "document") return "PDF";
  return "";
}

export function ToolboxPage() {
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", overflow: "auto" }}>
      <ConverterPane />
      <ChangelogPane />
    </div>
  );
}

function ConverterPane() {
  const { t, snack } = useApp();
  const ready = converterAvailable();
  const [categories, setCategories] = useState<ConverterCategory[]>([]);
  const [category, setCategory] = useState<ConverterCategoryId>("image");
  const [target, setTarget] = useState<Record<string, ConverterTarget>>({ image: "jpeg", data: "json" });
  const [width, setWidth] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ConverterJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const depth = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const status = await converter("status");
      setJobs(status.jobs);
      setBusy(status.busy);
      setFolder(status.outputFolder);
    } catch {}
  }, []);

  useEffect(() => {
    if (!ready) return;
    void converter("capabilities").then((c) => setCategories(c.categories)).catch(() => {});
    void refresh();
  }, [ready, refresh]);

  const active = busy || jobs.some((j) => j.state === "queued" || j.state === "running");
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void refresh(), 250);
    return () => clearInterval(timer);
  }, [active, refresh]);

  const current = categories.find((c) => c.id === category);
  const targets = (current?.targets || []) as ConverterTarget[];

  const ensureFolder = async () => {
    if (folder) return folder;
    const chosen = await converter("choose-folder");
    setFolder(chosen.outputFolder);
    return chosen.outputFolder;
  };

  const start = async (files: InspectedFile[]) => {
    if (!files.length) return;
    setError("");
    try {
      const convertible = files.some((f) => f.available);
      if (convertible && !(await ensureFolder())) {
        setError(t("Choose a folder before converting."));
        return;
      }
      const wanted = Number(width);
      await converter("enqueue", {
        items: files.map((f) => {
          const own = f.category ? target[f.category] : undefined;
          const pick = own && f.targets.includes(own) ? own : f.defaultTarget ?? undefined;
          return { path: f.path, target: pick, width: f.category === "image" && Number.isInteger(wanted) && wanted > 0 ? wanted : undefined };
        }),
      });
      await refresh();
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
      const folderChanged = code === "OUTPUT_FOLDER_CHANGED" || /(?:^|:\s*)OUTPUT_FOLDER_CHANGED(?:\b|$)/.test(message);
      setError(t(folderChanged ? ERROR_TEXT.OUTPUT_FOLDER_CHANGED : "The converter is not available in this window."));
    }
  };

  const choose = async () => {
    try {
      await start(await converter("choose-files", { category }));
    } catch {
      setError(t("The converter is not available in this window."));
    }
  };

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    // Keep the drop here; the window-level drop handler is for other imports.
    event.stopPropagation();
    depth.current = 0;
    setDragging(false);
    const paths = Array.from(event.dataTransfer.files).map(pathOfDroppedFile).filter(Boolean);
    if (!paths.length) {
      if (event.dataTransfer.files.length) setError(t("Dropped files could not be read here. Use Choose files."));
      return;
    }
    try {
      await start(await converter("inspect", { paths: paths.slice(0, 100) }));
    } catch {
      setError(t("The converter is not available in this window."));
    }
  };

  const changeFolder = async () => {
    try {
      const chosen = await converter("choose-folder");
      setFolder(chosen.outputFolder);
    } catch {
      setError(t("The converter is not available in this window."));
    }
  };

  const finished = jobs.some((j) => !["queued", "running"].includes(j.state));
  const shown = [...jobs].reverse();

  return (
    <section className="pane" aria-labelledby="fc-h" style={{ flex: "999 1 560px", minWidth: 0, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <h1 id="fc-h" className="headline-s" style={{ margin: 0 }}>{t("Convert files")}</h1>
      <div
        className="card outlined"
        style={{
          padding: 28,
          borderRadius: 28,
          borderStyle: "dashed",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          textAlign: "center",
          ...(dragging ? { borderColor: "var(--primary)", background: "var(--secondary-container)" } : {}),
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current++;
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (!depth.current) setDragging(false);
        }}
        onDrop={(e) => void onDrop(e)}
      >
        <Ms name="upload_file" size={32} />
        <p className="title-m" style={{ margin: 0 }}>{t("Drop files here")}</p>
        <p className="body-s on-sv" style={{ margin: 0 }}>{t("Converted on this PC with bundled tools. Nothing is uploaded.")}</p>
        <Btn variant="tonal" size="m" icon="folder_open" disabled={!ready} onClick={() => void choose()}>{t("Choose files")}</Btn>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label={t("Category")}>
        {CATEGORY_ORDER.map(([id, label]) => (
          <Chip key={id} on={category === id} onClick={() => setCategory(id)}>{t(label)}</Chip>
        ))}
      </div>

      {/* Not in the artboard: target, resize and output folder controls. Needs design review. */}
      {current && !current.available && (
        <p className="body-s on-sv" style={{ margin: 0 }}>{t(unavailableText(current.id, "") || current.reason || "")}</p>
      )}
      {current?.available && targets.length > 0 && (
        <ButtonGroup
          label={t("Convert to")}
          showLabel
          value={target[category] || targets[0]}
          onChange={(value) => setTarget({ ...target, [category]: value })}
          options={targets.map((x) => [x, t(TARGET_LABEL[x] || x)] as [ConverterTarget, string])}
        />
      )}
      {category === "image" && current?.available && (
        <TextField
          label={t("Width in pixels (optional)")}
          value={width}
          onChange={(v) => setWidth(v.replace(/\D/g, "").slice(0, 5))}
          inputMode="numeric"
          supporting={t("Keeps the aspect ratio. Leave empty to keep the size.")}
        />
      )}
      <div className="tf">
        <span className="lab">{t("Save converted files to")}</span>
        <span className="val mono body-m" title={folder || undefined} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {folder || t("Not chosen yet")}
        </span>
        <Btn variant="text" size="xs" disabled={!ready} onClick={() => void changeFolder()}>{folder ? t("Change") : t("Choose a folder")}</Btn>
      </div>
      <p className="body-s on-sv" style={{ margin: 0 }}>{t("Existing files are never replaced; a number is added to the name.")}</p>
      {error && <p role="alert" className="body-m c-error" style={{ margin: 0 }}>{error}</p>}

      {shown.length > 0 && (
        <div className="seglist" aria-live="polite">
          {shown.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}
      {finished && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="text" size="xs" onClick={() => void converter("clear").then(refresh).catch(() => snack(t("The converter is not available in this window.")))}>
            {t("Clear finished")}
          </Btn>
        </div>
      )}
    </section>
  );
}

function JobRow({ job }: { job: ConverterJob }) {
  const { t, snack } = useApp();
  const title = `${job.name} → ${targetLabel(job)}`;
  const icon = CATEGORY_ICON[job.category || ""] || "draft";
  if (job.state === "unavailable") {
    const reason = unavailableText(job.category, job.name) || job.error || "Unavailable: no bundled converter in this build";
    return (
      <div className="li">
        <Ms name={icon} className="on-sv" />
        <div className="txt">
          <span className="on-sv">{title}</span>
          <span className="body-s on-sv">{t(reason)}</span>
        </div>
      </div>
    );
  }
  if (job.state === "queued" || job.state === "running") {
    return (
      <div className="li">
        <Ms name={icon} />
        <div className="txt">
          <span>{title}</span>
          {job.state === "queued" ? (
            <span className="body-s on-sv">{t("Waiting")}</span>
          ) : (
            <LinearProgress value={job.progress} label={t(STAGE_TEXT[job.stage] || "Converting")} />
          )}
        </div>
        <IconBtn icon="close" size="sm" label={t("Cancel conversion")} onClick={() => void converter("cancel", { id: job.id }).catch(() => {})} />
      </div>
    );
  }
  if (job.state === "done") {
    return (
      <div className="li">
        <Ms name={icon} />
        <div className="txt">
          <span>{title}</span>
          <span className="body-s on-sv" title={job.output || undefined}>
            {t("Done · reopened and checked")} · {formatSize(job.bytes)}
          </span>
        </div>
        <Btn variant="text" size="xs" onClick={() => void converter("reveal", { id: job.id }).catch(() => snack(t("The file could not be read")))}>
          {t("Show")}
        </Btn>
      </div>
    );
  }
  const failure = job.state === "canceled" ? t("Canceled") : `${t("Failed")} · ${t(ERROR_TEXT[job.error || ""] || "The conversion failed")}`;
  return (
    <div className="li">
      <Ms name={icon} className={job.state === "failed" ? "c-error" : "on-sv"} />
      <div className="txt">
        <span>{title}</span>
        <span className={cx("body-s", job.state === "failed" ? "c-error" : "on-sv")} title={job.detail || undefined}>{failure}</span>
      </div>
    </div>
  );
}

type Release = { version: string; date: string | null; summary: string; notes: string[] };

function ChangelogPane() {
  const { t } = useApp();
  const releases = useMemo(() => {
    const list = ((changelog as { releases?: Release[] }).releases || []).slice();
    const key = (v: string) => v.split(".").map((n) => Number(n) || 0);
    return list.sort((a, b) => {
      const x = key(a.version);
      const y = key(b.version);
      for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i];
      return 0;
    });
  }, []);
  const haystack = useMemo(() => releases.map((r) => [r.version, r.date || "", r.summary, ...r.notes].join("\n")), [releases]);
  const search = useSearch(haystack);
  const visible = search.indices.map((i) => releases[i]);
  const dateText = (date: string | null) => (date ? new Date(`${date}T00:00:00`).toLocaleDateString() : t("Date not recorded"));
  return (
    <section className="pane low" aria-labelledby="cl-h" style={{ flex: "1 1 380px", minWidth: 0, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 id="cl-h" className="title-l" style={{ margin: 0 }}>{t("What's new")}</h2>
      <SearchBar
        small
        label={t("Search the changelog")}
        placeholder={t("Search releases")}
        query={search.query}
        setQuery={search.setQuery}
        state={search.state}
        setState={search.setState}
        status={search.status}
        t={t}
      />
      {visible.length > 0 ? (
        <div className="seglist">
          {visible.map((release) => {
            const current = release.version === APP_VERSION;
            return (
              <div key={release.version} className="li tall" aria-current={current ? "true" : undefined}>
                <Ms name={current ? "new_releases" : "history"} fill={current} className={current ? "c-primary" : undefined} />
                <div className="txt">
                  <span className="ov">{current ? `${t("This version")} · ${dateText(release.date)}` : dateText(release.date)}</span>
                  <span className="title-s">{release.version}</span>
                  {release.summary && <span className="body-s on-sv">{release.summary}</span>}
                  {/* Not in the artboard: the full notes under each summary. Needs design review. */}
                  {release.notes.length > 0 && (
                    <ul className="body-s on-sv" style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                      {release.notes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="body-m on-sv" role="status" style={{ margin: 0 }}>{t("No releases match this search")}</p>
      )}
      <p className="body-s on-sv" style={{ margin: 0 }}>{t("Read from the release notes bundled with this build, so it works offline.")}</p>
    </section>
  );
}
