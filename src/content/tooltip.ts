import { render, h } from "preact";
import { useState } from "preact/hooks";
import { saveWord } from "../shared/storage";
import type { Word, TooltipData } from "../shared/types";

let shadowHost: HTMLElement | null = null;

export function mountTooltip(data: TooltipData) {
  // Reuse existing host if already mounted (e.g. switching from loading to result)
  if (!shadowHost) {
    shadowHost = document.createElement("div");
    shadowHost.id = "__ocr-tooltip__";
    shadowHost.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      bottom: 24px;
      right: 24px;
      pointer-events: auto;
    `;
    const shadow = shadowHost.attachShadow({ mode: "open" });
    const styleEl = document.createElement("style");
    styleEl.textContent = getTooltipCSS();
    shadow.appendChild(styleEl);
    const mountPoint = document.createElement("div");
    shadow.appendChild(mountPoint);
    document.body.appendChild(shadowHost);
    setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick);
    }, 100);
  }

  const mountPoint = shadowHost.shadowRoot!.querySelector("div")!;
  render(h(Tooltip, { data, onClose: unmountTooltip }), mountPoint);
}

function handleOutsideClick(e: MouseEvent) {
  if (shadowHost && !shadowHost.contains(e.target as Node)) {
    unmountTooltip();
  }
}

export function unmountTooltip() {
  document.removeEventListener("mousedown", handleOutsideClick);
  if (shadowHost) {
    const mp = shadowHost.shadowRoot?.querySelector("div");
    if (mp) render(null, mp);
    shadowHost.remove();
    shadowHost = null;
  }
}

function Tooltip({ data, onClose }: { data: TooltipData; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (data.loading) {
    return h("div", { class: "tooltip" }, h("div", { class: "loading" }, h("span", { class: "spinner" }), h("span", null, "識別中...")));
  }

  if (data.error) {
    const msg =
      data.error === "NO_API_KEY"
        ? "請先在設定頁輸入 API Key"
        : data.error === "NO_TEXT"
          ? "無法識別文字，請重新選取"
          : data.error === "PARSE_ERROR"
            ? "AI 回傳格式錯誤，請重試"
            : data.error.startsWith("VISION_ERROR:")
              ? `Vision API 失敗：${data.error.replace("VISION_ERROR:", "")}`
              : data.error.startsWith("GEMINI_ERROR:")
                ? `Gemini API 失敗：${data.error.replace("GEMINI_ERROR:", "")}`
                : "發生錯誤，請稍後再試";

    return h("div", { class: "tooltip" }, h("div", { class: "error-row" }, h("span", { class: "error-msg" }, msg), h("button", { class: "btn-icon", onClick: onClose }, "✕")));
  }

  // At this point data is the word result variant (loading and error handled above)
  const wordData = data as { word: string; translation: string; partOfSpeech: string; exampleEn: string; exampleZh: string };

  const handleSave = async () => {
    if (saved || saving) return;
    setSaving(true);
    const word: Word = {
      id: crypto.randomUUID(),
      word: wordData.word,
      translation: wordData.translation,
      partOfSpeech: wordData.partOfSpeech,
      exampleEn: wordData.exampleEn,
      exampleZh: wordData.exampleZh,
      pinned: false,
      learned: false,
      createdAt: Date.now(),
      sourceUrl: window.location.href,
    };
    await saveWord(word);
    setSaving(false);
    setSaved(true);
  };

  return h(
    "div",
    { class: "tooltip" },
    h("div", { class: "header" }, h("span", { class: "word" }, wordData.word), h("span", { class: "pos" }, wordData.partOfSpeech)),
    h("div", { class: "translation" }, wordData.translation),
    expanded
      ? h(
          "div",
          { class: "example-section" },
          h("div", { class: "example-label" }, "例句"),
          h("div", { class: "example-en" }, wordData.exampleEn),
          h("div", { class: "example-zh" }, wordData.exampleZh),
        )
      : null,
    h(
      "div",
      { class: "actions" },
      h(
        "button",
        {
          class: `btn-save${saved ? " saved" : ""}`,
          onClick: handleSave,
          disabled: saved || saving,
        },
        saving ? "儲存中..." : saved ? "已儲存" : "儲存",
      ),
      expanded ? h("button", { class: "btn-secondary", onClick: onClose }, "✕") : h("button", { class: "btn-secondary", onClick: () => setExpanded(true) }, "展開"),
    ),
  );
}

function getTooltipCSS(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .tooltip {
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 10px;
      padding: 14px 16px;
      width: 260px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      font-family: system-ui, -apple-system, sans-serif;
      color: #e5e5e5;
    }
    .loading {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #71717a;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #27272a;
      border-top-color: #a1a1aa;
      border-radius: 50%;
      display: inline-block;
      animation: spin 0.7s linear infinite;
    }
    .error-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .error-msg {
      font-size: 13px;
      color: #f87171;
    }
    .btn-icon {
      background: none;
      border: none;
      color: #52525b;
      cursor: pointer;
      font-size: 14px;
      padding: 2px;
      flex-shrink: 0;
    }
    .header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 4px;
    }
    .word {
      font-size: 17px;
      font-weight: 700;
      color: #fafafa;
    }
    .pos {
      font-size: 12px;
      color: #52525b;
    }
    .translation {
      font-size: 13px;
      color: #a1a1aa;
      margin-bottom: 12px;
    }
    .example-section {
      border-top: 1px solid #27272a;
      padding-top: 10px;
      margin-bottom: 12px;
    }
    .example-label {
      font-size: 10px;
      color: #52525b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 5px;
    }
    .example-en {
      font-size: 13px;
      color: #d4d4d4;
      line-height: 1.5;
      margin-bottom: 4px;
    }
    .example-zh {
      font-size: 12px;
      color: #71717a;
      line-height: 1.5;
      margin-bottom: 10px;
    }
    .actions {
      display: flex;
      gap: 8px;
    }
    .btn-save {
      flex: 1;
      padding: 6px;
      background: #fafafa;
      color: #09090b;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-save.saved, .btn-save:disabled {
      background: #27272a;
      color: #71717a;
      cursor: default;
    }
    .btn-save:hover:not(.saved):not(:disabled) { opacity: 0.85; }
    .btn-secondary {
      padding: 6px 10px;
      background: transparent;
      color: #71717a;
      border: 1px solid #27272a;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-secondary:hover { border-color: #52525b; }
  `;
}

