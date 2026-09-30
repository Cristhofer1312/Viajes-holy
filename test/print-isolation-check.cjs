// Harness: simula el flujo imprimir() de pdfManager.js con DOM falso.
const fs = require('fs');
const vm = require('vm');
const path = 'C:\\Users\\Cristhofer Leon\\OneDrive\\Escritorio\\Viajes-holy\\src\\js\\pdfManager.js';

function makeStyle() {
  const s = {
    _p: {},
    setProperty(k, v, pr) { this._p[k] = v + (pr ? '!' + pr : ''); },
  };
  // Proxy: asignar '' elimina la propiedad (como el CSSStyleDeclaration real)
  return new Proxy(s, {
    get(t, prop) {
      if (prop === '_p' || prop === 'setProperty') return t[prop];
      return t._p[prop] || '';
    },
    set(t, prop, v) {
      if (v === '' || v == null) delete t._p[prop];
      else t._p[prop] = v;
      return true;
    },
  });
}

const registry = [];
function makeEl(tag, id, cls) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), id: id || '',
    children: [], parentNode: null,
    style: makeStyle(),
    _cls: new Set((cls || '').split(' ').filter(Boolean)),
    textContent: '',
  };
  el.classList = {
    contains: (c) => el._cls.has(c),
    add: (c) => el._cls.add(c),
    remove: (c) => el._cls.delete(c),
  };
  Object.defineProperty(el, 'nextSibling', {
    get() {
      if (!el.parentNode) return null;
      const sibs = el.parentNode.children;
      const i = sibs.indexOf(el);
      return sibs[i + 1] || null;
    },
  });
  el.appendChild = (ch) => {
    if (ch.parentNode) ch.parentNode.removeChild(ch);
    ch.parentNode = el;
    el.children.push(ch);
    return ch;
  };
  el.insertBefore = (ch, ref) => {
    if (ch.parentNode) ch.parentNode.removeChild(ch);
    ch.parentNode = el;
    const i = el.children.indexOf(ref);
    if (i === -1) el.children.push(ch); else el.children.splice(i, 0, ch);
    return ch;
  };
  el.removeChild = (ch) => {
    const i = el.children.indexOf(ch);
    if (i !== -1) el.children.splice(i, 1);
    ch.parentNode = null;
    return ch;
  };
  el.matches = (sel) => {
    if (sel.startsWith('#')) return el.id === sel.slice(1);
    if (sel.startsWith('.')) return el._cls.has(sel.slice(1));
    if (sel === 'body') return el.tagName === 'BODY';
    if (sel === 'main') return el.tagName === 'MAIN';
    if (sel === 'aside') return el.tagName === 'ASIDE';
    if (sel === 'section.view') return el.tagName === 'SECTION' && el._cls.has('view');
    return false;
  };
  el.querySelectorAll = (sel) => {
    const out = [];
    const walk = (n) => {
      n.children.forEach((c) => {
        if (c.matches(sel)) out.push(c);
        walk(c);
      });
    };
    if (sel === '#app-shell > div') {
      const shell = registry.find((e) => e.id === 'app-shell');
      if (shell) shell.children.forEach((c) => { if (c.tagName === 'DIV') out.push(c); });
      return out;
    }
    walk(el);
    return out;
  };
  el.querySelector = (sel) => el.querySelectorAll(sel)[0] || null;
  registry.push(el);
  return el;
}

// Arma: body > [login-overlay, app-shell > [wrapper-div > [aside, main > [section hidden, section visible > stage > item > scale > sheet1, sheet2]]], toast]
const head = makeEl('head');
const body = makeEl('body');
const loginOverlay = makeEl('div', 'login-overlay', 'fixed flex');
const appShell = makeEl('div', 'app-shell', 'flex');
const wrapper = makeEl('div', '', 'flex');
const aside = makeEl('aside', 'sidebar', 'no-print');
const main = makeEl('main');
const secHidden = makeEl('section', 'view-plantillas', 'view hidden');
const secVisible = makeEl('section', 'view-cotizacion', 'view');
const stage = makeEl('div', 'stage-cotizacion', 'preview-stage');
const item1 = makeEl('div', 'stage-cotizacion-p1', 'preview-item');
const scale1 = makeEl('div', '', 'scale-box');
const sheet1 = makeEl('div', 'page1', 'page-sheet');
const item2 = makeEl('div', 'stage-cotizacion-p2', 'preview-item');
const scale2 = makeEl('div', '', 'scale-box');
const sheet2 = makeEl('div', 'page2', 'page-sheet');
const toast = makeEl('div', 'toast', 'toast');

body.appendChild(loginOverlay);
body.appendChild(appShell);
appShell.appendChild(wrapper);
wrapper.appendChild(aside);
wrapper.appendChild(main);
main.appendChild(secHidden);
main.appendChild(secVisible);
secVisible.appendChild(stage);
stage.appendChild(item1);
item1.appendChild(scale1);
scale1.appendChild(sheet1);
stage.appendChild(item2);
item2.appendChild(scale2);
scale2.appendChild(sheet2);
body.appendChild(toast);

const listeners = {};
const sandbox = {
  console,
  window: {
    addEventListener: (ev, fn) => { listeners[ev] = fn; },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    print: () => {
      // Estado DURANTE print: verifica aislamiento
      const root = document.getElementById('holy-print-root');
      const hojasEnRoot = root ? root.children.filter((c) => c._cls.has('page-sheet')) : [];
      const visibles = body.children.filter((c) => c.tagName !== 'SCRIPT' && c.style._p.display !== 'none!important');
      console.log('DURANTE-PRINT root existe:', !!root,
        '| hojas en root:', hojasEnRoot.length,
        '| hijos body visibles (debe ser 1):', visibles.map((c) => c.id || c.tagName));
      // Simula afterprint del navegador
      setTimeout(() => listeners.afterprint && listeners.afterprint(), 10);
    },
  },
};
const document = {
  head, body,
  createElement: (t) => makeEl(t),
  getElementById: (id) => registry.find((e) => e.id === id) || null,
  querySelectorAll: (sel) => body.querySelectorAll(sel),
  querySelector: (sel) => {
    if (sel === 'body') return body;
    return body.querySelectorAll(sel)[0] || head.querySelectorAll(sel)[0] || null;
  },
};
sandbox.self = {};
sandbox.document = document;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path, 'utf8'), sandbox);

(async () => {
  await sandbox.self.PdfManager.imprimir();
  // Estado DESPUÉS de restaurar (nota: getElementById busca en registro,
  // así que para "eliminado" se verifica que ya no cuelgue del body)
  const rootReg = document.getElementById('holy-print-root');
  const root = rootReg && rootReg.parentNode === body ? rootReg : null;
  console.log('STYLES post:', JSON.stringify({
    app: appShell.style._p, overlay: loginOverlay.style._p,
    toast: toast.style._p, main: main.style._p, body: body.style._p,
  }));
  const s1ok = sheet1.parentNode === scale1;
  const s2ok = sheet2.parentNode === scale2;
  const appVisible = !appShell.style._p.display;
  const overlayVisible = !loginOverlay.style._p.display;
  console.log('DESPUES root eliminado:', !root,
    '| hoja1 en su escala:', s1ok,
    '| hoja2 en su escala:', s2ok,
    '| app-shell restaurado:', appVisible,
    '| overlay restaurado:', overlayVisible);
  if (!root && s1ok && s2ok && appVisible && overlayVisible) console.log('TEST-AISLAMIENTO: PASS');
  else { console.log('TEST-AISLAMIENTO: FAIL'); process.exit(1); }
})();
