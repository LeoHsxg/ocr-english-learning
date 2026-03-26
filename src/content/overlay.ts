type Region = { x: number; y: number; width: number; height: number };

let overlayEl: HTMLElement | null = null;

export function mountOverlay(onCapture: (region: Region) => void) {
  if (overlayEl) return;

  overlayEl = document.createElement("div");
  overlayEl.id = "__ocr-overlay__";

  const style = overlayEl.style;
  style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    cursor: crosshair;
    background: rgba(0, 0, 0, 0.35);
    user-select: none;
  `;

  // ESC hint
  const hint = document.createElement("div");
  hint.textContent = "ESC 取消";
  hint.style.cssText = `
    position: absolute;
    top: 12px;
    right: 16px;
    background: rgba(0,0,0,0.6);
    color: #e5e5e5;
    font-size: 12px;
    font-family: system-ui, sans-serif;
    padding: 4px 10px;
    border-radius: 4px;
    pointer-events: none;
  `;
  overlayEl.appendChild(hint);

  // Selection box
  const selBox = document.createElement("div");
  selBox.style.cssText = `
    position: absolute;
    border: 2px dashed #3b82f6;
    background: rgba(59, 130, 246, 0.08);
    border-radius: 2px;
    pointer-events: none;
    display: none;
  `;
  overlayEl.appendChild(selBox);

  let startX = 0;
  let startY = 0;
  let dragging = false;

  overlayEl.addEventListener("mousedown", e => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selBox.style.display = "block";
    selBox.style.left = startX + "px";
    selBox.style.top = startY + "px";
    selBox.style.width = "0";
    selBox.style.height = "0";
    e.preventDefault();
  });

  overlayEl.addEventListener("mousemove", e => {
    if (!dragging) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selBox.style.left = x + "px";
    selBox.style.top = y + "px";
    selBox.style.width = w + "px";
    selBox.style.height = h + "px";
  });

  overlayEl.addEventListener("mouseup", e => {
    if (!dragging) return;
    dragging = false;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    if (w < 5 || h < 5) {
      // Too small, cancel
      unmountOverlay();
      return;
    }

    onCapture({ x, y, width: w, height: h });
  });

  document.body.appendChild(overlayEl);
}

export function unmountOverlay() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

