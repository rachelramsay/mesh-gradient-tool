// Tiny DOM helpers + a slider factory used by the editor panel.

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') node.className = attrs[k];
    else if (k === 'text') node.textContent = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
    } else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

// A labelled range slider with a live numeric readout.
// get() -> current value, set(v) -> apply. onInput(value) fires while dragging.
export function slider({ label, min, max, step, value, onInput, format }) {
  const fmt = format || ((v) => (+v).toFixed(2));
  const out = el('span', { class: 'ctl__val', text: fmt(value) });
  const input = el('input', {
    type: 'range', min, max, step, value,
    oninput: (e) => {
      const v = parseFloat(e.target.value);
      out.textContent = fmt(v);
      onInput(v);
    },
  });
  const row = el('label', { class: 'ctl' }, [
    el('span', { class: 'ctl__label' }, [label, out]),
    input,
  ]);
  return {
    row,
    set(v) { input.value = v; out.textContent = fmt(v); },
  };
}
