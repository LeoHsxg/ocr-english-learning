import { render, h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { getStorage, saveSettings, setTheme } from "../shared/storage";
import "../shared/style.css";

const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"];

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dim" : "light");
}

function App() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [theme, setThemeState] = useState<"light" | "dark">("dark");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStorage().then(d => {
      setApiKey(d.apiKey);
      setModel(d.geminiModel);
      setThemeState(d.theme);
      applyTheme(d.theme);
    });
  }, []);

  const toggleTheme = async () => {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setThemeState(next);
    await setTheme(next);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(apiKey.trim(), model);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div class="min-h-screen bg-base-100 flex items-start justify-center p-8">
      <div class="w-full max-w-md">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-xl font-bold">設定</h1>
            <p class="text-sm text-base-content/50 mt-0.5">OCR 英文學習</p>
          </div>
          <button class="btn btn-sm btn-ghost border border-base-300" onClick={toggleTheme}>
            {theme === "dark" ? "亮色模式" : "暗色模式"}
          </button>
        </div>

        <div class="card bg-base-200 border border-base-300">
          <div class="card-body gap-5">
            {/* API Key */}
            <div>
              <label class="label pb-1.5">
                <span class="label-text font-medium">Google API Key</span>
              </label>
              <div class="relative">
                <input
                  type={showKey ? "text" : "password"}
                  class="input input-bordered w-full pr-20 font-mono text-sm"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onInput={e => {
                    setApiKey((e.target as HTMLInputElement).value);
                    setSaved(false);
                  }}
                />
                <button class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-base-content/50 hover:text-base-content" onClick={() => setShowKey(!showKey)}>
                  {showKey ? "隱藏" : "顯示"}
                </button>
              </div>
              <p class="text-xs text-base-content/40 mt-1.5">同時用於 Cloud Vision API（OCR）和 Gemini API（翻譯 / 例句）</p>
            </div>

            <div class="divider my-0"></div>

            {/* Gemini Model */}
            <div>
              <label class="label pb-1.5">
                <span class="label-text font-medium">Gemini 模型</span>
              </label>
              <select class="select select-bordered w-full text-sm" value={model} onChange={e => setModel((e.target as HTMLSelectElement).value)}>
                {MODELS.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <p class="text-xs text-base-content/40 mt-1.5">建議使用 gemini-2.5-flash，穩定且可用性較高</p>
            </div>

            {/* Save Button */}
            <button class={`btn w-full ${saved ? "btn-success" : "btn-neutral"}`} onClick={handleSave} disabled={saving || !apiKey.trim()}>
              {saving ? "儲存中..." : saved ? "已儲存" : "儲存"}
            </button>
          </div>
        </div>

        <p class="text-xs text-base-content/30 text-center mt-4">API Key 僅儲存在您的瀏覽器本機，不會上傳至任何伺服器</p>
      </div>
    </div>
  );
}

render(h(App, {}), document.getElementById("app")!);

