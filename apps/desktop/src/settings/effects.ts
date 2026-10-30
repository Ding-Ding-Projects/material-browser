import { useEffect, useRef, useState } from "react";
import type { Preferences, SettingsRecord } from "./store";
import { applyPresentationTheme } from "../design-system/theme.mjs";
import { selectVoice, narrationAllowed } from "./messages.mjs";
import { enqueueSpeechGroups, takeSpeechPart } from "./speech-queue.mjs";
import { timeWindowMatches } from "./model.mjs";
export function usePresentationEffects(prefs: Preferences, record?: SettingsRecord) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accessibilityVisible = String(prefs.accessibilityVisible);
    root.dataset.dialogEmoji = String(prefs.dialogEmoji);
    root.dataset.language = prefs.language;
    root.dataset.theme = prefs.theme;
    root.dataset.density = prefs.density;
    root.dataset.motion = prefs.motion;
    root.dataset.contrast = String(prefs.highContrast);
    root.dataset.focus = String(prefs.strongFocus);
    root.dataset.targets = String(prefs.largeTargets);
    root.dataset.focusMode = String(prefs.focus);
    root.dataset.lowStimulation = String(prefs.lowStimulation);
    const families: Record<string, string> = {
      "Roboto Flex": '"Roboto Flex Variable","Noto Sans HK Variable","Microsoft JhengHei",sans-serif',
      Roboto: 'Roboto,"Noto Sans HK Variable","Microsoft JhengHei","PingFang HK",sans-serif',
      system: '"Segoe UI",system-ui,"Microsoft JhengHei",sans-serif',
      "sans-serif": 'Arial,"Microsoft JhengHei",sans-serif',
      serif: 'Georgia,"Microsoft JhengHei",serif',
      monospace: 'Consolas,"Microsoft JhengHei",monospace',
    };
    const font =
      families[prefs.fontFamily] ||
      `${JSON.stringify(prefs.fontFamily)},"Noto Sans HK Variable","Microsoft JhengHei",sans-serif`;
    root.style.setProperty("--interface-font", font);
    root.style.setProperty("--md-ref-typeface-plain", font);
    root.style.setProperty("--md-ref-typeface-brand", font);
    root.style.setProperty(
      "--text-scale",
      String(prefs.fontScale * prefs.textScale),
    );
    root.style.setProperty("--interface-weight", String(prefs.fontWeight));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => applyPresentationTheme(root, prefs, record, media.matches);
    applyTheme();
    media.addEventListener("change", applyTheme);
    root.lang = prefs.language === "yue" ? "zh-HK" : "en";
    return () => media.removeEventListener("change", applyTheme);
  }, [prefs, record]);
}
export function useNarrator(prefs: Preferences) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const [speechStatus, setSpeechStatus] = useState("");
  const activeGroup = useRef<string | null>(null);
  const queue = useRef<any[]>([]),
    cooldown = useRef<Record<string, number>>({}),
    active = useRef(false);
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => {
    if (!supported) return;
    const read = () => setVoices(window.speechSynthesis.getVoices());
    read();
    window.speechSynthesis.addEventListener("voiceschanged", read);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", read);
      window.speechSynthesis.cancel();
      queue.current = [];
    };
  }, [supported]);
  useEffect(() => {
    if (supported && (!prefs.narration || prefs.screenReaderMode)) {
      window.speechSynthesis.cancel();
      queue.current = [];
      active.current = false;
    }
  }, [supported, prefs.narration, prefs.screenReaderMode]);
  function drain() {
    if (!supported || active.current || !queue.current.length) return;
    const taken = takeSpeechPart(queue.current);
    queue.current = taken.queue;
    const next = taken.part;
    if (!next) return;
    activeGroup.current = taken.groupId;
    const p = prefsRef.current;
    const selection = selectVoice(
      window.speechSynthesis.getVoices(),
      next.language,
      next.language === "en" ? p.voiceEnglish : p.voiceCantonese,
    );
    if (!selection.voice) {
      drain();
      return;
    }
    const u = new SpeechSynthesisUtterance(next.text);
    u.voice = selection.voice;
    u.rate = p.speechRate;
    u.pitch = p.speechPitch;
    u.lang = selection.voice.lang;
    active.current = true;
    const end = () => {
      active.current = false;
      drain();
    };
    u.onend = end;
    u.onerror = end;
    window.speechSynthesis.speak(u);
  }
  function speak(en: string, yue: string, kind = "info", explicit = false) {
    if (!supported) return false;
    const p = prefsRef.current,
      d = new Date(),
      quiet =
        p.quietEnabled &&
        timeWindowMatches(
          p.quietStart,
          p.quietEnd,
          d.getHours() * 60 + d.getMinutes(),
        );
    if (!explicit && !narrationAllowed(p, kind, quiet)) return false;
    const now = Date.now();
    if (
      !explicit &&
      kind !== "error" &&
      now - (cooldown.current[kind] || 0) < 5000
    )
      return false;
    cooldown.current[kind] = now;
    const langs =
      p.narratorLanguage === "both" ? ["en", "yue"] : [p.narratorLanguage];
    const appended = enqueueSpeechGroups(
      queue.current,
      {
        id: crypto.randomUUID(),
        category: kind,
        critical: kind === "error" || kind === "warning",
        parts: langs.map((language) => ({
          text: language === "en" ? en : yue,
          language,
        })),
      },
      activeGroup.current,
    );
    queue.current = appended.queue;
    if (!appended.accepted) {
      setSpeechStatus(
        "The speech queue is full. Messages remain available in the notification centre.",
      );
      return false;
    }
    setSpeechStatus("");
    drain();
    return true;
  }
  return {
    supported,
    voices,
    speechStatus,
    speak,
    stop: () => {
      if (supported) window.speechSynthesis.cancel();
      queue.current = [];
      active.current = false;
    },
    pause: () => supported && window.speechSynthesis.pause(),
    resume: () => supported && window.speechSynthesis.resume(),
    english: selectVoice(voices, "en", prefs.voiceEnglish),
    cantonese: selectVoice(voices, "yue", prefs.voiceCantonese),
  };
}
