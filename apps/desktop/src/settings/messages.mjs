const framing = {
  en: {
    info: [
      "",
      "Update: ",
      "Here is the update: ",
      "One thing at a time. ",
      "The controls have news. ",
    ],
    success: [
      "",
      "Saved: ",
      "That change is recorded. ",
      "One less loose end. ",
      "That setting has found its seat. ",
    ],
    warning: [
      "",
      "Warning: ",
      "Please check this detail. ",
      "A small pause is useful here. ",
      "This detail deserves a second look. ",
    ],
    error: [
      "",
      "Error: ",
      "This action needs attention. ",
      "The action stopped here. ",
      "This action has put its tools down. ",
    ],
    progress: [
      "",
      "In progress: ",
      "Work is underway. ",
      "The operation is moving along. ",
      "The operation is doing its homework. ",
    ],
    validation: [
      "",
      "Check the value: ",
      "This value needs a correction. ",
      "A quick correction is needed. ",
      "This value has not passed the door yet. ",
    ],
    security: [
      "",
      "Access detail: ",
      "Check the access requirement. ",
      "The access rule still applies. ",
      "The access rule is keeping its chair. ",
    ],
    accessibility: [
      "",
      "Accessibility: ",
      "This changes the interface. ",
      "The interface can make room. ",
      "The interface is moving its furniture. ",
    ],
    destructive: [
      "",
      "Review carefully: ",
      "Review the affected items. ",
      "Pause and check the exact action. ",
      "The delete button can wait while you check. ",
    ],
  },
  yue: {
    info: ["", "更新：", "有一項更新。", "逐件事嚟。", "控制項有消息。"],
    success: [
      "",
      "已儲存：",
      "更改已經記錄。",
      "又少一件未完嘅事。",
      "呢個設定搵到自己個位。",
    ],
    warning: [
      "",
      "注意：",
      "請睇清楚呢個細節。",
      "停一停睇清楚先。",
      "呢個細節值得再望一眼。",
    ],
    error: [
      "",
      "錯誤：",
      "呢個操作需要處理。",
      "操作喺呢度停咗。",
      "呢個操作暫時放低工具。",
    ],
    progress: [
      "",
      "處理中：",
      "工作進行中。",
      "操作逐步進行。",
      "操作做緊功課。",
    ],
    validation: [
      "",
      "請檢查輸入：",
      "呢個值需要修正。",
      "改一改呢個值先。",
      "呢個值仲未入到門。",
    ],
    security: [
      "",
      "存取事項：",
      "請檢查存取要求。",
      "存取規則仍然適用。",
      "存取規則仲坐喺度。",
    ],
    accessibility: [
      "",
      "無障礙：",
      "呢個設定會改變介面。",
      "介面可以讓一讓位。",
      "介面準備搬一搬傢俬。",
    ],
    destructive: [
      "",
      "請小心檢查：",
      "請確認受影響項目。",
      "停一停確認實際操作。",
      "刪除掣可以等你睇清楚先。",
    ],
  },
};
export function styledMessage(kind, en, yue, prefs) {
  const k = Object.hasOwn(framing.en, kind) ? kind : "info";
  const a = Math.max(1, Math.min(5, Number(prefs.funnyEnglish) || 5)) - 1,
    b = Math.max(1, Math.min(5, Number(prefs.funnyCantonese) || 5)) - 1;
  const english = framing.en[k][a] + en,
    cantonese = framing.yue[k][b] + (yue || en);
  return prefs.language === "yue"
    ? cantonese
    : prefs.language === "both"
      ? english + " · " + cantonese
      : english;
}
export function selectVoice(voices, language, chosen = "") {
  const matching = voices.filter((v) =>
    language === "en"
      ? /^en(?:-|$)/i.test(v.lang)
      : /^(yue(?:-|$)|zh-HK$)/i.test(v.lang),
  );
  const exact = matching.find((v) => v.voiceURI === chosen);
  return {
    voice: exact || matching.find((v) => v.localService) || matching[0] || null,
    missing: !!chosen && !exact,
    available: matching,
  };
}
export function narrationAllowed(prefs, kind, quiet) {
  return (
    !!prefs.narration &&
    !prefs.screenReaderMode &&
    (!(prefs.lowStimulation || quiet) || kind === "error" || kind === "warning")
  );
}
