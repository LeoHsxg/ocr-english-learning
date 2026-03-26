import { render, h } from 'preact'
import { useState, useEffect, useMemo } from 'preact/hooks'
import { getStorage, deleteWord, updateWord, setTheme } from '../shared/storage'
import type { Word } from '../shared/types'
import '../shared/style.css'

const POS_FILTERS = ['全部', '名詞', '動詞', '形容詞', '副詞', '其他', '未學習'] as const
type PosFilter = typeof POS_FILTERS[number]

const POS_MAP: Record<string, string> = {
  'n.': '名詞', 'v.': '動詞', 'adj.': '形容詞', 'adv.': '副詞',
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dim' : 'light')
}

function App() {
  const [words, setWords] = useState<Word[]>([])
  const [theme, setThemeState] = useState<'light' | 'dark'>('dark')
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<PosFilter>('全部')

  useEffect(() => {
    getStorage().then((d) => {
      setWords(d.words)
      setThemeState(d.theme)
      applyTheme(d.theme)
    })
  }, [])

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    await setTheme(next)
    setThemeState(next)
    applyTheme(next)
  }

  const handleDelete = async (id: string) => {
    await deleteWord(id)
    setWords(prev => prev.filter(w => w.id !== id))
  }

  const handleTogglePin = async (word: Word) => {
    await updateWord(word.id, { pinned: !word.pinned })
    setWords(prev => prev.map(w => w.id === word.id ? { ...w, pinned: !w.pinned } : w))
  }

  const handleToggleLearned = async (word: Word) => {
    await updateWord(word.id, { learned: !word.learned })
    setWords(prev => prev.map(w => w.id === word.id ? { ...w, learned: !w.learned } : w))
  }

  const exportCSV = () => {
    const header = '單字,翻譯,詞性,英文例句,例句翻譯,新增日期'
    const rows = words.map(w => [
      w.word, w.translation, w.partOfSpeech,
      `"${w.exampleEn.replace(/"/g, '""')}"`,
      `"${w.exampleZh.replace(/"/g, '""')}"`,
      new Date(w.createdAt).toLocaleDateString('zh-TW'),
    ].join(','))
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vocabulary.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = useMemo(() => {
    let list = [...words]
    // Sort: pinned first, then by createdAt desc
    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.createdAt - a.createdAt
    })
    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(w =>
        w.word.toLowerCase().includes(q) || w.translation.includes(q)
      )
    }
    // POS filter
    if (posFilter !== '全部') {
      if (posFilter === '未學習') {
        list = list.filter(w => !w.learned)
      } else {
        list = list.filter(w => POS_MAP[w.partOfSpeech] === posFilter || (posFilter === '其他' && !POS_MAP[w.partOfSpeech]))
      }
    }
    return list
  }, [words, search, posFilter])

  const learnedCount = words.filter(w => w.learned).length

  return (
    <div class="min-h-screen bg-base-100 p-6">
      {/* Header */}
      <div class="flex items-start justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold">我的單字</h1>
          <p class="text-sm text-base-content/50 mt-0.5">
            共 {words.length} 個單字 · {learnedCount} 個已學習
          </p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-ghost border border-base-300" onClick={toggleTheme}>
            {theme === 'dark' ? '亮色模式' : '暗色模式'}
          </button>
          <button class="btn btn-sm btn-ghost border border-base-300" onClick={exportCSV}>
            匯出 CSV
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div class="flex flex-wrap gap-2 mb-5">
        <div class="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="搜尋單字..."
            class="input input-sm input-bordered w-full"
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          />
        </div>
        <div class="flex flex-wrap gap-1.5">
          {POS_FILTERS.map(f => (
            <button
              key={f}
              class={`btn btn-xs ${posFilter === f ? 'btn-neutral' : 'btn-ghost border border-base-300'}`}
              onClick={() => setPosFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div class="text-center text-base-content/40 py-20">
          {words.length === 0 ? '尚未收藏任何單字' : '沒有符合的結果'}
        </div>
      ) : (
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(word => (
            <WordCard
              key={word.id}
              word={word}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              onToggleLearned={handleToggleLearned}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function WordCard({
  word,
  onDelete,
  onTogglePin,
  onToggleLearned,
}: {
  word: Word
  onDelete: (id: string) => void
  onTogglePin: (word: Word) => void
  onToggleLearned: (word: Word) => void
}) {
  return (
    <div class={`card bg-base-200 border ${word.pinned ? 'border-warning/30' : 'border-base-300'} ${word.learned ? 'opacity-50' : ''}`}>
      <div class="card-body p-4 gap-0">
        {/* Word + POS */}
        <div class="flex items-start justify-between mb-0.5">
          <div class="flex items-baseline gap-2">
            <span class={`text-base font-bold ${word.learned ? 'line-through decoration-base-content/30' : ''}`}>
              {word.word}
            </span>
            <span class="text-xs text-base-content/40">{word.partOfSpeech}</span>
          </div>
          {word.pinned && (
            <span class="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 flex-shrink-0"></span>
          )}
        </div>

        {/* Translation */}
        <div class="text-sm text-base-content/60 mb-3">{word.translation}</div>

        <div class="divider my-0 mb-3"></div>

        {/* Example */}
        <div class="text-xs text-base-content/60 leading-relaxed mb-1">{word.exampleEn}</div>
        <div class="text-xs text-base-content/40 leading-relaxed mb-4">{word.exampleZh}</div>

        {/* Actions */}
        <div class="flex gap-1.5 flex-wrap">
          <button
            class="btn btn-xs btn-ghost border border-base-300"
            onClick={() => onTogglePin(word)}
          >
            {word.pinned ? '取消置頂' : '置頂'}
          </button>
          <button
            class="btn btn-xs btn-ghost border border-base-300 text-error"
            onClick={() => onDelete(word.id)}
          >
            刪除
          </button>
          <button
            class={`btn btn-xs ml-auto ${word.learned ? 'btn-ghost border border-base-300' : 'btn-success btn-outline'}`}
            onClick={() => onToggleLearned(word)}
          >
            {word.learned ? '未學習' : '已學習'}
          </button>
        </div>
      </div>
    </div>
  )
}

render(h(App, {}), document.getElementById('app')!)
