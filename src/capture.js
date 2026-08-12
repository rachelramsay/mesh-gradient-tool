// Capture the current (paused) frame as a PNG at the exact frame resolution,
// and trigger a download. Also used for the Figma snapshot path.

// width/height default to the engine's config frame size when omitted.
export function captureBlob(gradient, width, height) {
  return gradient.capture(width, height).then((blob) => {
    if (!blob) throw new Error('Canvas capture failed.');
    return blob;
  });
}

export function captureDataURL(gradient, width, height) {
  return gradient.captureDataURL(width, height);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPNG(gradient, filename = 'mesh-gradient.png', width, height) {
  const blob = await captureBlob(gradient, width, height);
  downloadBlob(blob, filename);
}
