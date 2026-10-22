import React, { useState, useEffect } from "react";
import { Profile, request } from "../api";
import { Button, Modal } from "../components";
import { Search } from "../Search";
type Conflict = { profileId: string; revisionIds?: string[] };
type Props = {
  t: (s: string) => string;
  folder: string;
  busy: boolean;
  status: { unlocked?: boolean } | null;
  perform: (action: () => Promise<any>) => Promise<any>;
  chooseFolder: () => Promise<void>;
  loadConflicts: () => Promise<void>;
  refresh: () => Promise<void>;
  conflicts: Conflict[];
  profiles: Profile[];
};
export function Synchronization({
  t,
  folder,
  busy,
  status,
  perform,
  chooseFolder,
  loadConflicts,
  refresh,
  conflicts,
  profiles,
}: Props) {
  const [matched, setMatched] = useState<string[]>([]);
  const [review, setReview] = useState<{
    id: string;
    name: string;
    revisionId: string;
  } | null>(null);
  useEffect(() => {
    if (!status?.unlocked) setReview(null);
  }, [status?.unlocked]);
  return (
    <div className="sync-workspace">
      <div className="page-heading">
        <h1>{t("Synchronization")}</h1>
      </div>
      <section className="surface sync-folder-strip" aria-label={t("Folder")}>
        <div>
          <h2>{t("Folder")}</h2>
          <p className="literal">{folder || t("Unavailable")}</p>
        </div>
        <div className="actions">
          <Button
            disabled={busy || !status?.unlocked}
            onClick={() => void perform(chooseFolder)}
          >
            {t("Choose folder")}
          </Button>
          {[
            ["sync.push", "Upload changes"],
            ["sync.pull", "Download changes"],
          ].map(([method, label]) => (
            <Button
              key={method}
              secondary
              disabled={busy || !status?.unlocked}
              onClick={() =>
                void perform(async () => {
                  await request(method);
                  await loadConflicts();
                  await refresh();
                })
              }
            >
              {t(label)}
            </Button>
          ))}
        </div>
      </section>
      <section className="surface sync-conflicts" aria-label={t("Conflicts")}>
        <div className="page-heading">
          <h2>{t("Conflicts")}</h2>
          <Button
            secondary
            disabled={busy || !status?.unlocked}
            onClick={() => void perform(loadConflicts)}
          >
            {t("Refresh")}
          </Button>
        </div>
        <Search
          label={t("Search")}
          items={conflicts.map(
            (c) =>
              `${profiles.find((p) => p.id === c.profileId)?.name || c.profileId} ${(c.revisionIds || []).join(" ")}`,
          )}
          itemKeys={conflicts.map((c) => c.profileId)}
          onKeys={setMatched}
          t={t}
        />
        {!conflicts.length && <p>{t("No conflicts")}</p>}
        {conflicts
          .filter((c) => matched.includes(c.profileId))
          .map((conflict) => {
            const name =
              profiles.find((p) => p.id === conflict.profileId)?.name ||
              conflict.profileId;
            return (
              <article className="record" key={conflict.profileId}>
                <h3>{name}</h3>
                <p>
                  {t("Choose a revision candidate to resolve this conflict.")}
                </p>
                <ul className="conflict-candidates">
                  {(conflict.revisionIds || []).map((revisionId) => (
                    <li key={revisionId}>
                      <div>
                        <span>{t("Revision candidate")}</span>
                        <code>{revisionId}</code>
                      </div>
                      <Button
                        secondary
                        disabled={busy || !status?.unlocked}
                        onClick={() =>
                          setReview({
                            id: conflict.profileId,
                            name,
                            revisionId,
                          })
                        }
                      >
                        {t("Restore")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
      </section>
      {review && (
        <Modal
          title={t("Review conflict resolution")}
          closeLabel={t("Cancel")}
          onClose={() => {
            if (!busy) setReview(null);
          }}
          actions={
            <Button
              disabled={busy || !status?.unlocked}
              onClick={() =>
                void perform(async () => {
                  await request("sync.resolve", {
                    id: review.id,
                    revisionId: review.revisionId,
                  });
                  setReview(null);
                  await loadConflicts();
                  await refresh();
                })
              }
            >
              {t("Confirm")}
            </Button>
          }
        >
          <p>{t("Resolve this conflict using the selected revision?")}</p>
          <strong>{review.name}</strong>
          <code>{review.revisionId}</code>
        </Modal>
      )}
    </div>
  );
}
