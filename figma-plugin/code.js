// Mesh Gradient Bridge — main thread. The UI iframe (ui.html) does all network
// I/O with the local tool server; this side does the Figma document work.

figma.showUI(__html__, { width: 300, height: 230, themeColors: true });

figma.ui.onmessage = (msg) => {
  if (msg.type === 'apply-paint') {
    const targets = figma.currentPage.selection.filter((n) => 'fills' in n);
    if (!targets.length) {
      figma.ui.postMessage({ type: 'status', error: 'Select a frame or shape first.' });
      return;
    }
    try {
      targets.forEach((n) => { n.fills = [msg.paint]; });
      figma.notify('Mesh gradient applied to ' + targets.length + ' layer(s)');
      figma.ui.postMessage({ type: 'status', ok: 'Applied to ' + targets.length + ' layer(s).' });
    } catch (e) {
      figma.ui.postMessage({ type: 'status', error: 'Apply failed: ' + e.message });
    }
    return;
  }

  if (msg.type === 'read-selection') {
    const node = figma.currentPage.selection.find(
      (n) => 'fills' in n && Array.isArray(n.fills) && n.fills.some((f) => f.type === 'SHADER')
    );
    if (!node) {
      figma.ui.postMessage({ type: 'status', error: 'Select a layer with a mesh gradient fill.' });
      return;
    }
    const shader = node.fills.find((f) => f.type === 'SHADER');
    figma.ui.postMessage({
      type: 'selection-data',
      payload: { width: node.width, height: node.height, properties: shader.properties },
    });
  }
};
