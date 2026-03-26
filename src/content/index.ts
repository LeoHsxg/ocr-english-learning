import type { MessageType } from '../shared/types'
import { mountOverlay, unmountOverlay } from './overlay'
import { mountTooltip, unmountTooltip } from './tooltip'

let ocrActive = false

// Listen for ACTIVATE_OCR from background (shortcut / context menu)
chrome.runtime.onMessage.addListener((message: MessageType) => {
  if (message.type === 'ACTIVATE_OCR') {
    toggleOcr()
  }
})

function toggleOcr() {
  if (ocrActive) {
    unmountOverlay()
    ocrActive = false
    return
  }
  unmountTooltip()
  ocrActive = true
  mountOverlay(async (region) => {
    unmountOverlay()
    ocrActive = false

    // Show loading tooltip
    mountTooltip({ loading: true })

    const response = await chrome.runtime.sendMessage({
      type: 'CAPTURE_REGION',
      payload: { ...region, dpr: window.devicePixelRatio },
    } satisfies MessageType)

    if (response?.error) {
      mountTooltip({ error: response.error })
    } else if (response?.word) {
      mountTooltip(response)
    } else {
      mountTooltip({ error: 'UNKNOWN' })
    }
  })
}

// ESC to cancel
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ocrActive) {
    unmountOverlay()
    ocrActive = false
  }
})
