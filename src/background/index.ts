import type { MessageType } from "../shared/types";
import { getStorage } from "../shared/storage";

function isIgnorableUrl(url?: string): boolean {
  if (!url) return true;
  return url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("about:") || url.startsWith("chrome-extension://");
}

function sendActivateOcr(tabId: number) {
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError || !tab || isIgnorableUrl(tab.url)) {
      return;
    }

    chrome.tabs.sendMessage(tabId, { type: "ACTIVATE_OCR" } satisfies MessageType).catch(async err => {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("Receiving end does not exist")) {
        console.warn("ACTIVATE_OCR message failed:", message);
        return;
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["src/content/index.ts"],
        });
        await chrome.tabs.sendMessage(tabId, { type: "ACTIVATE_OCR" } satisfies MessageType);
      } catch (retryErr) {
        console.warn("ACTIVATE_OCR retry failed:", retryErr);
      }
    });
  });
}

// Listen for keyboard shortcut command
chrome.commands.onCommand.addListener(command => {
  if (command === "activate-ocr") {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tab = tabs[0];
      if (tab?.id) {
        sendActivateOcr(tab.id);
      }
    });
  }
});

// Listen for right-click context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "activate-ocr",
    title: "啟用 OCR 擷取",
    contexts: ["page", "image"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "activate-ocr" && tab?.id) {
    sendActivateOcr(tab.id);
  }
});

// Listen for capture request from content script
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  if (message.type === "CAPTURE_REGION") {
    handleCapture(message.payload, sender.tab?.id)
      .then(sendResponse)
      .catch(err => {
        sendResponse({ error: err instanceof Error ? err.message : "未知錯誤" });
      });
    return true; // keep channel open for async response
  }
});

async function handleCapture(
  region: { x: number; y: number; width: number; height: number; dpr: number },
  _tabId?: number,
): Promise<{ word?: string; translation?: string; partOfSpeech?: string; exampleEn?: string; exampleZh?: string; error?: string }> {
  const { apiKey } = await getStorage();
  if (!apiKey) {
    return { error: "NO_API_KEY" };
  }

  // 1. Capture the visible tab
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });

  // 2. Crop to selected region using OffscreenCanvas
  const croppedBase64 = await cropImage(dataUrl, region);

  // 3. Call Google Vision API
  let visionText: string | null;
  try {
    visionText = await callVisionApi(croppedBase64, apiKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `VISION_ERROR:${msg}` };
  }
  if (!visionText) {
    return { error: "NO_TEXT" };
  }

  // Extract the primary word
  const primaryWord = visionText
    .trim()
    .split(/\s+/)[0]
    .replace(/[^a-zA-Z'-]/g, "");
  if (!primaryWord) {
    return { error: "NO_TEXT" };
  }

  // 4. Call Gemini API
  const { geminiModel } = await getStorage();
  let result: { word?: string; translation?: string; partOfSpeech?: string; exampleEn?: string; exampleZh?: string; error?: string };
  try {
    result = await callGeminiApi(primaryWord, apiKey, geminiModel);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `GEMINI_ERROR:${msg}` };
  }
  return result;
}

async function cropImage(dataUrl: string, region: { x: number; y: number; width: number; height: number; dpr: number }): Promise<string> {
  const blob = await fetch(dataUrl).then(r => r.blob());
  const bitmap = await createImageBitmap(blob);

  const { x, y, width, height, dpr } = region;
  const canvas = new OffscreenCanvas(width * dpr, height * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, x * dpr, y * dpr, width * dpr, height * dpr, 0, 0, width * dpr, height * dpr);

  const outBlob = await canvas.convertToBlob({ type: "image/png" });
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(outBlob);
  });
}

async function callVisionApi(base64Image: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: "TEXT_DETECTION" }],
        },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Vision API 錯誤");
  }

  return data.responses?.[0]?.fullTextAnnotation?.text ?? null;
}

async function callGeminiApi(
  word: string,
  apiKey: string,
  model: string,
): Promise<{ word?: string; translation?: string; partOfSpeech?: string; exampleEn?: string; exampleZh?: string; error?: string }> {
  const prompt = `你是一個英文單字學習助理。根據給定的英文單字，回傳以下 JSON 格式（只回傳 JSON，不加任何說明）：
{
  "word": "原始單字（小寫）",
  "translation": "中文翻譯（簡潔，5字以內）",
  "partOfSpeech": "詞性縮寫，如 n. / v. / adj. / adv.",
  "exampleEn": "一個自然的英文例句",
  "exampleZh": "例句的中文翻譯"
}

單字：${word}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Gemini API 錯誤");
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    // Retry: strip markdown code fences if present
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    return { error: "PARSE_ERROR" };
  }
}

