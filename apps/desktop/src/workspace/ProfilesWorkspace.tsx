import "./surfaces.css";
import { Icon } from "../Icon";
import { mdiPlus } from "@mdi/js";
import { ProfileTable } from "./ProfileTable";
import { ConfirmAction } from "../settings/ConfirmAction";
import { ProfileInspector } from "./ProfileInspector";
import React, { useEffect, useRef, useState } from "react";
import { Profile, request } from "../api";
import { Button, Field, Modal } from "../components";
import { operationFailure } from "../operation-errors.mjs";
import {
  createOperationRegistry,
  runTargets,
  selectedTargets,
  visibleProfiles,
  timestampDate,
  inspectorWidth,
  profileOperationParams,
} from "./model.mjs";
type Props = {
  profiles: Profile[];
  selected: string;
  onSelect: (id: string) => void;
  unlocked: boolean;
  t: (s: string) => string;
  onCreate: () => void;
  onLaunch: (profile: Profile) => void;
  refresh: () => Promise<void>;
  operations: ReturnType<typeof createOperationRegistry>;
  pending: string[];
  onResults: (results: Result[]) => void;
};
type Review = {
  method: string;
  label: string;
  targets: Profile[];
  revisionId?: string;
};
type Result = { id: string; name: string; ok: boolean; message: string };
export function ProfilesWorkspace({
  profiles,
  selected,
  onSelect,
  unlocked,
  t,
  onCreate,
  onLaunch,
  refresh,
  operations,
  pending,
  onResults,
}: Props) {
  const [matched, setMatched] = useState<string[]>(profiles.map((p) => p.id)),
    [engine, setEngine] = useState("all");
  const [sort, setSort] = useState({ key: "name", direction: "asc" }),
    [checked, setChecked] = useState<string[]>([]),
    [showDetail, setShowDetail] = useState(false);
  const [tab, setTab] = useState("overview"),
    [runtime, setRuntime] = useState<any>(null),
    [revisions, setRevisions] = useState<any[]>([]),
    [revisionKeys, setRevisionKeys] = useState<string[]>([]);
  const [results, setResults] = useState<Result[]>([]),
    [review, setReview] = useState<Review | null>(null),
    [editing, setEditing] = useState(false),
    [draftName, setDraftName] = useState(""),
    [draftAutomation, setDraftAutomation] = useState("off");
  const selection = useRef(selected);
  selection.current = selected;
  const access = useRef({ selected, unlocked, epoch: 0 });
  if (
    access.current.selected !== selected ||
    access.current.unlocked !== unlocked
  )
    access.current = { selected, unlocked, epoch: access.current.epoch + 1 };
  const vaultAccess = useRef({ unlocked, epoch: 0 });
  if (vaultAccess.current.unlocked !== unlocked)
    vaultAccess.current = { unlocked, epoch: vaultAccess.current.epoch + 1 };
  const revisionRequest = useRef(0);
  useEffect(() => {
    if (!unlocked) {
      setResults([]);
      setChecked([]);
    }
  }, [unlocked]);
  const profile = profiles.find((p) => p.id === selected);
  const busy = pending.includes("*") || pending.includes(selected);
  const rows = visibleProfiles(profiles, matched, engine, sort) as Profile[];
  const targets = selectedTargets(profiles, checked) as Profile[];
  useEffect(() => {
    setChecked((ids) => ids.filter((id) => profiles.some((p) => p.id === id)));
  }, [profiles]);
  useEffect(() => {
    setRuntime(null);
    setRevisions([]);
    setEditing(false);
    setReview(null);
    setTab("overview");
    setDraftAutomation(profile?.automation || "off");
  }, [selected, unlocked]);
  useEffect(() => {
    let active = true;
    setRuntime(null);
    if (profile && unlocked)
      request("profiles.status", { id: profile.id })
        .then((value) => {
          if (active)
            setRuntime(
              Array.isArray(value)
                ? value.find((r) => r.profileId === profile.id)
                : value,
            );
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [selected, profiles, unlocked]);
  const execute = async (
    method: string,
    items: Profile[],
    extra: Record<string, unknown> = {},
  ) => {
    if (!unlocked) return false;
    const ids = items.map((p) => p.id);
    const epoch = vaultAccess.current.epoch;
    const reservation = await operations.runMany(ids, async () => {
      try {
        const outcome = await runTargets(
          items,
          (p: Profile) =>
            request(
              method,
              profileOperationParams(method, p, extra, t("Copy")),
            ),
          (error: unknown) => operationFailure(error)[0],
        );
        if (
          !vaultAccess.current.unlocked ||
          vaultAccess.current.epoch !== epoch
        )
          return false;
        setResults((previous) => [
          ...previous.filter((result) => !ids.includes(result.id)),
          ...outcome,
        ]);
        onResults(outcome);
        await refresh();
        if (
          ["profiles.snapshot", "revisions.restore"].includes(method) &&
          ids.includes(selection.current)
        ) {
          const id = selection.current;
          const selectionEpoch = access.current.epoch;
          const requestId = ++revisionRequest.current;
          const updated = await request("revisions.list", { id });
          if (
            vaultAccess.current.unlocked &&
            vaultAccess.current.epoch === epoch &&
            selection.current === id &&
            access.current.epoch === selectionEpoch &&
            revisionRequest.current === requestId
          )
            setRevisions(
              Array.isArray(updated) ? updated : updated.revisions || [],
            );
        }
        return outcome.every((result: Result) => result.ok);
      } catch (error) {
        if (
          !vaultAccess.current.unlocked ||
          vaultAccess.current.epoch !== epoch
        )
          return false;
        setResults((previous) => [
          ...previous.filter((result) => result.id !== "refresh"),
          {
            id: "refresh",
            name: t("Refresh"),
            ok: false,
            message: operationFailure(error)[0],
          },
        ]);
        return false;
      }
    });
    return reservation.accepted && reservation.value === true;
  };
  const loadRevisions = async () => {
    if (!profile) return;
    const id = profile.id;
    const epoch = access.current.epoch,
      requestId = ++revisionRequest.current;
    try {
      const value = await request("revisions.list", { id });
      if (
        access.current.unlocked &&
        access.current.epoch === epoch &&
        revisionRequest.current === requestId &&
        selection.current === id
      )
        setRevisions(Array.isArray(value) ? value : value.revisions || []);
    } catch (error) {
      if (
        access.current.unlocked &&
        access.current.epoch === epoch &&
        revisionRequest.current === requestId &&
        selection.current === id
      )
        setResults([
          {
            id,
            name: profile.name,
            ok: false,
            message: operationFailure(error)[0],
          },
        ]);
    }
  };
  const act = (method: string, label: string, items: Profile[]) => {
    if (["profiles.stop", "profiles.remove"].includes(method))
      setReview({ method, label, targets: items });
    else void execute(method, items);
  };
  const sortBy = (key: string) =>
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  const workspaceRef = useRef<HTMLDivElement>(null);
  const focusDetail = () => requestAnimationFrame(() => workspaceRef.current?.querySelector<HTMLElement>(".detail-title")?.focus());
  const returnToList = (show: boolean) => {
    setShowDetail(show);
    if (!show) requestAnimationFrame(() => workspaceRef.current?.querySelector<HTMLElement>(".profile-card.selected .record-name")?.focus());
  };
  const select = (id: string) => {
    onSelect(id);
    setShowDetail(true);
    focusDetail();
  };
  const date = (value?: number | string) =>
    timestampDate(value)?.toLocaleString() || t("Unavailable");
  const [width, setWidth] = useState(() => {
    try {
      return inspectorWidth(
        localStorage.getItem("profileInspectorWidth") || 336,
      );
    } catch {
      return 336;
    }
  });
  const resize = (value: number) => {
    const next = inspectorWidth(value);
    setWidth(next);
    try {
      localStorage.setItem("profileInspectorWidth", String(next));
    } catch {}
  };
  return (
    <div
      ref={workspaceRef}
      className={`profile-workspace ${showDetail && profile ? "show-detail" : ""}`}
    >
      <div className="page-heading">
        <div>
          <h1>{t("Profiles")}</h1>
          <p>
            {profiles.length} {t("Profiles")} ·{" "}
            {t("Saved locally in the encrypted vault")}
          </p>
        </div>
        <Button disabled={!unlocked || busy} onClick={onCreate}>
          <Icon path={mdiPlus} size={18} /> {t("Create profile")}
        </Button>
      </div>
      <div
        className="profiles-layout"
        style={{ "--inspector-width": `${width}px` } as React.CSSProperties}
      >
        <ProfileTable
          {...{
            profiles,
            rows,
            targets,
            selected,
            runtime,
            engine,
            sort,
            checked,
            pending,
            busy,
            unlocked,
            t,
            setMatched,
            setEngine,
            setChecked,
            sortBy,
            select,
            date,
            refresh,
            setResults,
            act,
            onLaunch,
          }}
        />
        <ProfileInspector
          {...{
            profile,
            width,
            resize,
            runtime,
            tab,
            revisions,
            revisionKeys,
            draftAutomation,
            busy,
            unlocked,
            t,
            setShowDetail: returnToList,
            setTab,
            loadRevisions,
            date,
            onLaunch,
            act,
            setDraftName,
            setEditing,
            setRevisionKeys,
            setReview,
            setDraftAutomation,
            execute,
          }}
        />
      </div>
      {unlocked && results.length > 0 && (
        <section className="operation-results" role="status" aria-live="polite">
          <h2>{t("Operation results")}</h2>
          <ul>
            {results.map((result) => (
              <li key={result.id}>
                <strong>{result.name}</strong>: {t(result.message)}{" "}
                {result.ok ? "✓" : "!"}
              </li>
            ))}
          </ul>
        </section>
      )}
      {review?.method === "profiles.remove" && <ConfirmAction title={t("Remove")} description={`${t("Remove these profiles and their revision history? This cannot be undone.")} ${review.targets.map((p) => p.name).join(", ")}`} t={t}
        onCancel={() => { if (!busy) setReview(null); }} onConfirm={async () => {
          if (!unlocked || busy) return { ok: false, message: t("Unavailable") };
          const success = await execute(review.method, review.targets);
          if (success) setReview(null);
          return success ? { ok: true } : { ok: false, message: t("Some operations failed") };
        }}/>}
      {review && review.method !== "profiles.remove" && (
        <Modal
          title={t(review.label)}
          closeLabel={t("Cancel")}
          onClose={() => {
            if (!busy) setReview(null);
          }}
          actions={
            <Button
              disabled={busy || !unlocked}
              onClick={() => {
                const value = review;
                setReview(null);
                void execute(
                  value.method,
                  value.targets,
                  value.revisionId ? { revisionId: value.revisionId } : {},
                );
              }}
            >
              {t("Confirm")}
            </Button>
          }
        >
          <p>
            {t(
              review.method === "profiles.remove"
                ? "Remove these profiles and their revision history? This cannot be undone."
                : review.method === "profiles.stop"
                  ? "Stop these profiles? Unsaved browser work may be lost."
                  : "Restore this revision? Current profile data will be replaced.",
            )}
          </p>
          <ul>
            {review.targets.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
          {review.revisionId && <p className="literal">{review.revisionId}</p>}
        </Modal>
      )}
      {editing && profile && (
        <Modal
          title={t("Edit name")}
          closeLabel={t("Cancel")}
          onClose={() => {
            if (!busy) setEditing(false);
          }}
          actions={
            <Button
              disabled={busy || !unlocked || !draftName.trim()}
              onClick={() => {
                void execute("profiles.update", [profile], {
                  name: draftName.trim(),
                }).then((saved) => {
                  if (saved) setEditing(false);
                });
              }}
            >
              {t("Save")}
            </Button>
          }
        >
          <Field
            label={t("Name")}
            value={draftName}
            onChange={setDraftName}
            required
          />
        </Modal>
      )}
    </div>
  );
}
