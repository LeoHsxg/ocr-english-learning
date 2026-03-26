import type { StorageData, Word } from "./types";

const DEFAULTS: StorageData = {
  words: [],
  apiKey: "",
  geminiModel: "gemini-2.5-flash",
  theme: "dark",
};

export async function getStorage(): Promise<StorageData> {
  const data = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...data } as StorageData;
}

export async function saveWord(word: Word): Promise<void> {
  const data = await getStorage();
  const existing = data.words.findIndex(w => w.word.toLowerCase() === word.word.toLowerCase());
  if (existing >= 0) return;
  data.words.unshift(word);
  await chrome.storage.local.set({ words: data.words });
}

export async function deleteWord(id: string): Promise<void> {
  const data = await getStorage();
  data.words = data.words.filter(w => w.id !== id);
  await chrome.storage.local.set({ words: data.words });
}

export async function updateWord(id: string, updates: Partial<Word>): Promise<void> {
  const data = await getStorage();
  const idx = data.words.findIndex(w => w.id === id);
  if (idx < 0) return;
  data.words[idx] = { ...data.words[idx], ...updates };
  await chrome.storage.local.set({ words: data.words });
}

export async function setTheme(theme: "light" | "dark"): Promise<void> {
  await chrome.storage.local.set({ theme });
}

export async function saveSettings(apiKey: string, geminiModel: string): Promise<void> {
  await chrome.storage.local.set({ apiKey, geminiModel });
}

