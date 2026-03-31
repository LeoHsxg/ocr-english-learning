# CLAUDE.md — OCR English Learning Chrome Extension

## Project Overview

A Chrome Extension (Manifest v3) that lets users capture screen regions, extract English text via OCR, translate it to Chinese, and save vocabulary for later review. Built with Preact + TypeScript + Vite, styled with Tailwind CSS and DaisyUI.

**Core user flow:**
1. User presses **Alt+Q** (or right-clicks → context menu) on any webpage
2. A selection overlay appears — user drags to select a region containing English text
3. The extension captures and sends the region to Google Vision API for OCR
4. The extracted word is sent to Gemini API for translation, part of speech, and example sentences
5. A tooltip shows the result; user can save the word to their vocabulary list
6. Saved words are managed in a full-page word list (filter, search, mark learned, export CSV)

---

## Repository Structure

```
ocr-english-learning/
├── src/
│   ├── background/        # Service worker (Manifest v3 background)
│   │   └── index.ts       # OCR pipeline: screenshot → crop → Vision API → Gemini API
│   ├── content/           # Content scripts injected into every page
│   │   ├── index.ts       # Entry point: mounts overlay and tooltip
│   │   ├── overlay.ts     # Drag-to-select region UI
│   │   └── tooltip.ts     # Result tooltip rendered in Shadow DOM
│   ├── popup/             # Extension action popup (220px wide)
│   │   ├── index.html
│   │   └── App.tsx        # Shows recent word, word count, navigation
│   ├── options/           # Settings full page
│   │   ├── index.html
│   │   └── App.tsx        # API key + Gemini model selector + theme toggle
│   ├── wordlist/          # Vocabulary manager full page
│   │   ├── index.html
│   │   └── App.tsx        # Grid of word cards with filter/search/export
│   └── shared/
│       ├── types.ts        # TypeScript interfaces: Word, StorageData, MessageType, TooltipData
│       ├── storage.ts      # chrome.storage.local wrapper (CRUD for words + settings)
│       └── style.css       # Tailwind + DaisyUI entry point
├── public/
│   └── icons/             # Extension icons: 16px, 48px, 128px
├── manifest.json          # Chrome Extension Manifest v3
├── vite.config.ts         # CRXJS plugin + multi-entry points
├── tsconfig.json          # Root TypeScript config
├── tsconfig.app.json      # App config (strict, ES2020, preact JSX, webworker lib)
├── tsconfig.node.json     # Vite/Node config
└── package.json
```

---

## Technology Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Preact | 10.24.3 | UI framework (lightweight React alternative) |
| TypeScript | 5.6.2 | Type safety, strict mode enabled |
| Vite | 5.4.10 | Build tool + dev server |
| @crxjs/vite-plugin | 2.0.0-beta | Chrome Extension bundling with hot reload |
| Tailwind CSS | 4.2.2 | Utility-first CSS |
| DaisyUI | 5.5.19 | Component library (btn, card, input, select, badge…) |
| Chrome MV3 | — | Service worker, content scripts, messaging, storage |

**External APIs (user-provided key):**
- **Google Cloud Vision API** — OCR text detection from base64 PNG
- **Google Generative AI (Gemini)** — Translation + part of speech + example sentences
  - Default model: `gemini-2.5-flash`
  - Other options: `gemini-2.5-flash-lite`, `gemini-1.5-pro`, `gemini-1.5-flash`

---

## Development Workflow

### Setup

```bash
npm install
```

No `.env` files needed. API keys are stored in `chrome.storage.local` via the Options page.

### Dev mode

```bash
npm run dev
```

Starts Vite with CRXJS hot reload. Load the `dist/` folder in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

### Production build

```bash
npm run build
```

Runs TypeScript type-checking (`tsc -b`) then Vite build. Output goes to `dist/`.

### Preview

```bash
npm run preview
```

---

## Key Conventions

### TypeScript

- **Strict mode** is on — no implicit `any`, no unused variables.
- JSX is configured globally via `tsconfig.app.json` (`jsxImportSource: "preact"`) — no pragma needed in files.
- `React` is aliased to `preact/compat` for compatibility. Import from `preact` or `preact/hooks` directly.
- Use discriminated unions for state shapes (see `TooltipData` in `src/shared/types.ts`).
- Prefer `satisfies` over `as` for type narrowing in message passing.

### Preact / React patterns

- Functional components only, hooks for all state.
- No external state management (Context or Redux) — local component state + direct storage calls.
- For Shadow DOM content (tooltip), styles are inlined as a `<style>` tag; Tailwind/DaisyUI classes do **not** work inside Shadow DOM.

### Chrome Extension messaging

```
Content script  ──ACTIVATE_OCR──►  Content script (activates overlay)
Content script  ──CAPTURE_REGION──►  Background (with region coords)
Background      ──sendResponse──►  Content script (word data or error)
```

Always use `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`. The background script is a **Service Worker** — no persistent state between events.

### Storage (`src/shared/storage.ts`)

- All persistence goes through the helpers in `storage.ts` — do not call `chrome.storage.local` directly from UI components.
- `saveWord()` deduplicates by lowercased word value.
- Default theme is `"dim"` (DaisyUI dark theme); default Gemini model is `"gemini-2.5-flash"`.

### UI / Styling

- Themes: `"light"` and `"dim"` (dark). Applied via `data-theme` on `<html>`.
- Layout uses CSS Grid for the word list (responsive 1–3 columns).
- DaisyUI component classes (`btn`, `card`, `input`, `badge`, `divider`, etc.) — follow existing usage patterns.
- The tooltip (`src/content/tooltip.ts`) is entirely vanilla DOM + Shadow DOM — no Preact here. Keep it that way to avoid bundling issues.

### Error handling

- API errors return an error object `{ type: 'error', message: string }` — do not throw.
- Error messages shown to the user are in **Chinese**. Internal error type strings use English constants (`NO_API_KEY`, `NO_TEXT`, `PARSE_ERROR`).
- Gemini responses may wrap JSON in markdown fences (` ```json … ``` `); the parser in `background/index.ts` handles this fallback.

---

## Core Data Types

```typescript
// src/shared/types.ts

interface Word {
  id: string;
  word: string;
  translation: string;        // Chinese translation
  partOfSpeech: string;       // "noun" | "verb" | "adjective" | "adverb" | "other"
  exampleEn: string;          // English example sentence
  exampleZh: string;          // Chinese translation of example
  pinned: boolean;
  learned: boolean;
  createdAt: number;          // timestamp ms
  sourceUrl: string;          // page where word was captured
}

interface StorageData {
  words: Word[];
  apiKey: string;
  geminiModel: string;
  theme: 'light' | 'dim';
}

type MessageType = 'ACTIVATE_OCR' | 'CAPTURE_REGION';
```

---

## API Integration Details

### Google Vision API

```
POST https://vision.googleapis.com/v1/images:annotate?key={apiKey}
Body: { requests: [{ image: { content: base64PNG }, features: [{ type: "TEXT_DETECTION" }] }] }
Response: result.responses[0].fullTextAnnotation.text
```

### Gemini API

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
Prompt: "Extract the primary English word from: '{text}'. Return JSON: { word, translation (zh-TW), partOfSpeech, exampleEn, exampleZh }"
Response: parsed JSON (with markdown fence fallback)
```

---

## What to Avoid

- **Do not** add a server/backend — all data stays in the browser via `chrome.storage.local`.
- **Do not** use React-specific libraries — use Preact-compatible alternatives or vanilla DOM.
- **Do not** use Tailwind/DaisyUI classes inside the Shadow DOM tooltip — inline styles only there.
- **Do not** store API keys anywhere other than `chrome.storage.local`.
- **Do not** persist state in the background service worker — it can be terminated at any time.
- **Do not** introduce a state management library — current architecture handles complexity well with hooks + storage.

---

## No CI/CD

There is no automated CI/CD pipeline. Testing and building are done locally.
