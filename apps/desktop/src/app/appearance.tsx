import React, { useState } from "react";
import type { Profile } from "../api";
import { Avatar, Btn, ButtonGroup, Dialog, avatarStyle } from "../m3";
import { useApp } from "./context";

/** Per-profile avatar appearance, kept on this computer only. */
type Look = { shape: string; tone: string };
const KEY = "profile.appearance.v1";
function readAll(): Record<string, Look> {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
export function appearanceFor(id: string): Look {
  return readAll()[id] || avatarStyle(id);
}
export const SHAPES: [string, string][] = [
  ["shape-cookie", "Cookie"],
  ["shape-sunny", "Sunny"],
  ["shape-sq", "Square"],
  ["shape-arch", "Arch"],
  ["shape-pill", "Circle"],
];
export const TONES: [string, string][] = [
  ["p", "Primary"],
  ["t", "Tertiary"],
  ["s", "Secondary"],
  ["", "Container"],
];

export function AppearanceDialog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { t, snack } = useApp();
  const [look, setLook] = useState<Look>(appearanceFor(profile.id));
  return (
    <Dialog
      title={`${t("Edit appearance")} · ${profile.name}`}
      icon="format_paint"
      onClose={onClose}
      actions={
        <>
          <Btn
            variant="text"
            onClick={() => {
              const all = readAll();
              delete all[profile.id];
              localStorage.setItem(KEY, JSON.stringify(all));
              onClose();
              snack(t("Appearance reset"));
            }}
          >
            {t("Reset")}
          </Btn>
          <Btn
            onClick={() => {
              localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [profile.id]: look }));
              onClose();
              snack(t("Appearance saved"));
            }}
          >
            {t("Save")}
          </Btn>
        </>
      }
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Avatar name={profile.name} size="xl" shape={look.shape} tone={look.tone} />
      </div>
      <p className="label-l">{t("Shape")}</p>
      <ButtonGroup label={t("Shape")} value={look.shape} onChange={(shape) => setLook({ ...look, shape })} options={SHAPES.map(([k, v]) => [k, t(v)])} />
      <p className="label-l">{t("Colour")}</p>
      <ButtonGroup label={t("Colour")} value={look.tone} onChange={(tone) => setLook({ ...look, tone })} options={TONES.map(([k, v]) => [k, t(v)])} />
      <p className="body-s on-sv">{t("Saved on this computer only. Every shape keeps the same contrast.")}</p>
    </Dialog>
  );
}
