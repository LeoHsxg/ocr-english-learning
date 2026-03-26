import { render, h } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { getStorage, setTheme } from '../shared/storage'
import type { StorageData } from '../shared/types'
import '../shared/style.css'

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dim' : 'light')
}

function App() {
  const [data, setData] = useState<StorageData | null>(null)

  useEffect(() => {
    getStorage().then((d) => {
      setData(d)
      applyTheme(d.theme)
    })
  }, [])

  const toggleTheme = async () => {
    if (!data) return
    const next = data.theme === 'dark' ? 'light' : 'dark'
    await setTheme(next)
    setData({ ...data, theme: next })
    applyTheme(next)
  }

  const openWordlist = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/wordlist/index.html') })
  }

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  if (!data) return null

  const recentWord = data.words[0]
  const learnedCount = data.words.filter(w => w.learned).length

  return (
    <div class="w-[220px] p-[18px] font-sans">
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm font-semibold">英文學習</span>
        <button
          class="btn btn-xs btn-ghost border border-base-300"
          onClick={toggleTheme}
        >
          {data.theme === 'dark' ? '亮色' : '暗色'}
        </button>
      </div>

      {recentWord ? (
        <div class="bg-base-200 border border-base-300 rounded-lg p-3 mb-3">
          <div class="text-[10px] text-base-content/40 uppercase tracking-wider mb-1.5">最近新增</div>
          <div class="text-[15px] font-bold">{recentWord.word}</div>
          <div class="text-xs text-base-content/60 mt-0.5">
            {recentWord.partOfSpeech}&nbsp;&nbsp;{recentWord.translation}
          </div>
        </div>
      ) : (
        <div class="bg-base-200 border border-base-300 rounded-lg p-3 mb-3 text-xs text-base-content/40">
          尚未收藏任何單字
        </div>
      )}

      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="bg-base-200 border border-base-300 rounded-lg p-2 text-center">
          <div class="text-lg font-bold">{data.words.length}</div>
          <div class="text-[10px] text-base-content/40 mt-0.5">已收藏</div>
        </div>
        <div class="bg-base-200 border border-base-300 rounded-lg p-2 text-center">
          <div class="text-lg font-bold">{learnedCount}</div>
          <div class="text-[10px] text-base-content/40 mt-0.5">已學習</div>
        </div>
      </div>

      <div class="divider my-2"></div>

      <button class="btn btn-sm btn-neutral w-full mb-2" onClick={openWordlist}>
        單字列表
      </button>
      <button class="btn btn-sm btn-ghost border border-base-300 w-full" onClick={openOptions}>
        設定
      </button>
    </div>
  )
}

render(h(App, {}), document.getElementById('app')!)
