export interface Word {
  id: string
  word: string
  translation: string
  partOfSpeech: string
  exampleEn: string
  exampleZh: string
  pinned: boolean
  learned: boolean
  createdAt: number
  sourceUrl: string
}

export interface StorageData {
  words: Word[]
  apiKey: string
  geminiModel: string
  theme: 'light' | 'dark'
}

export type MessageType =
  | { type: 'ACTIVATE_OCR' }
  | { type: 'CAPTURE_REGION'; payload: { x: number; y: number; width: number; height: number; dpr: number } }

export type TooltipData =
  | { loading: true; error?: undefined; word?: undefined }
  | { error: string; loading?: undefined; word?: undefined }
  | { word: string; translation: string; partOfSpeech: string; exampleEn: string; exampleZh: string; loading?: undefined; error?: undefined }
