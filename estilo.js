/* Plataforma · Benfica Independente — acabamento visual igual em todos os ecrãs.
   1) Um só estilo de ícones: troca os emojis que abrem botões, títulos e etiquetas pelos ícones de linha da plataforma.
   2) Regras de acabamento (alturas, espaços e tipografia) iguais em tudo.
   Carregado depois de app.js; não mexe em conteúdo escrito pelas pessoas nem na pré-visualização da app. */
'use strict';
(function () {
  const T = (d) => d;
  // Ícones de linha (24×24), no mesmo traço dos do menu lateral.
  const P = {
    heart: T('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
    eye: T('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
    repeat: T('<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
    trash: T('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
    check: T('<polyline points="20 6 9 17 4 12"/>'),
    x: T('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    stop: T('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
    pause: T('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
    record: T('<circle cx="12" cy="12" r="6"/>'),
    save: T('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
    target: T('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
    camera: T('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
    gift: T('<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>'),
    mega: T('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>'),
    award: T('<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>'),
    dollar: T('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    cart: T('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'),
    ticket: T('<path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><line x1="13" y1="5" x2="13" y2="19" stroke-dasharray="2 3"/>'),
    home: T('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
    clip: T('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>'),
    clock: T('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    arrow: T('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'),
    arrowup: T('<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>'),
    slash: T('<line x1="5" y1="19" x2="19" y2="5"/>'),
    flame: T('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    car: T('<path d="M5 17h14v-5l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/>'),
    beer: T('<path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M5 8h12v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M8 2v3M12 2v3"/>'),
    food: T('<path d="M5 3v8a2 2 0 0 0 2 2v8M9 3v8M7 3v8"/><path d="M17 3c-2 2-3 5-3 8h3v10"/>'),
    hand: T('<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3.4 16a2 2 0 0 1 3-2.6L8 15"/>'),
    palette: T('<circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.9-4.5-9-10-9z"/>'),
    film: T('<rect x="2" y="2" width="20" height="20" rx="2.2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>'),
    shuffle: T('<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>')
  };
  // emoji → nome do ícone (os que existem em ICONES, no app.js, também servem)
  const MAPA = {
    '🔔': 'bell', '📰': 'news', '⭐': 'star', '★': 'star', '☆': 'star', '💪': 'star', '❤': 'heart', '❤️': 'heart', '👁': 'eye', '👁️': 'eye',
    '⬇': 'download', '⬇️': 'download', '🔁': 'repeat', '🔄': 'repeat', '🗑': 'trash', '🗑️': 'trash', '✕': 'x', '✖': 'x', '❌': 'x', '✓': 'check', '✔': 'check', '✅': 'check',
    '▶': 'play', '▶️': 'play', '⏹': 'stop', '⏹️': 'stop', '⏺': 'record', '⏺️': 'record', '⏸': 'pause', '⏸️': 'pause', '💾': 'save', '🎯': 'target',
    '📸': 'camera', '📷': 'camera', '🖼': 'image', '🖼️': 'image', '🎁': 'gift', '🎂': 'gift', '📢': 'mega', '📣': 'mega', '🏆': 'award', '💰': 'dollar', '🛒': 'cart',
    '🎟': 'ticket', '🎟️': 'ticket', '🏠': 'home', '📋': 'clip', '⏱': 'clock', '⏱️': 'clock', '➡': 'arrow', '➡️': 'arrow', '👉': 'arrow', '➚': 'arrowup', '／': 'slash',
    '🔥': 'flame', '🚗': 'car', '🍺': 'beer', '🍽': 'food', '🍽️': 'food', '📞': 'phone', '📱': 'phone', '✋': 'hand', '🎨': 'palette', '🎬': 'film',
    '📡': 'live', '✉': 'mail', '✉️': 'mail', '📊': 'chart', '💬': 'chat', '🗳': 'poll', '🗳️': 'poll', '⚙': 'gear', '⚙️': 'gear', '＋': 'plus', '➕': 'plus', '🔀': 'shuffle'
  };
  // Estes ficam como estão: significam equipas, resultados ou posições.
  const FORA = /[🔴⚪🟥🟨⚽🥇🥈🥉]/u;
  const INICIO = /^(\s*)((?:[\u{1F300}-\u{1FAFF}☀-➿⭐⏱-⏺⬆⬇➕➡↔-↪ℹ⚠✔✖⬅／＋]|[★☆▶⬇⬆✓✕✖])️?)\s*/u;
  const CONTEUDO = 'button, a, h1, h2, h3, h4, .selo, .qb-ic, header, summary';
  const NAO = '.tm-cartao, .tm-p, svg, option, textarea, input, script, style, [data-sem-icone], .q-campo';

  function svg(nome) {
    const d = P[nome] || (typeof ICONES !== 'undefined' && ICONES[nome]);
    if (!d) return null;
    return `<svg class="ico ico-p" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  }
  function trocar(no) {
    const pai = no.parentElement;
    if (!pai || !pai.closest(CONTEUDO) || pai.closest(NAO)) return;
    const m = INICIO.exec(no.nodeValue);
    if (!m) return;
    const emoji = m[2];
    if (FORA.test(emoji)) return;
    const nome = MAPA[emoji] || MAPA[emoji.replace(/️$/, '')];
    const html = nome && svg(nome);
    if (!html) return;
    const caixa = document.createElement('span');
    caixa.innerHTML = html;
    pai.insertBefore(caixa.firstChild, no);
    no.nodeValue = no.nodeValue.slice(m[0].length);
  }
  function tratar(raiz) {
    if (!raiz) return;
    const it = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    const lista = [];
    for (let n = it.nextNode(); n; n = it.nextNode()) if (INICIO.test(n.nodeValue)) lista.push(n);
    lista.forEach(trocar);
  }
  let obs = null;
  function observar() { obs.observe(document.body, { childList: true, subtree: true }); }
  obs = new MutationObserver(muts => {
    obs.disconnect();
    try {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1) tratar(n);
        else if (n.nodeType === 3 && n.parentElement) tratar(n.parentElement);
      }));
    } finally { observar(); }
  });

  // ------------------------------------------------ acabamento igual em todos os ecrãs
  const css = `
.ico-p{width:1.15em;height:1.15em;flex:0 0 auto;vertical-align:-.2em;margin-right:.45em}
.botao .ico-p,.qb-abre .ico-p,.qb-ferr .ico-p,.qb-aba .ico-p,.qb-ic .ico-p,.qb-mom-btn .ico-p,.qb-jog-btn .ico-p{margin-right:0}
.botao.pequeno .ico-p{width:1.05em;height:1.05em}
.qb-ic .ico-p{width:24px;height:24px}
.qb-aba .qb-ic .ico-p{width:20px;height:20px}
.qb-abre .qb-ic .ico-p{width:20px;height:20px}
.qb-trilho .qb-ic .ico-p{width:28px;height:28px}
.qb-ferr.ativa .ico-p,.qb-aba.ativa .ico-p{stroke-width:2.1}
.cartao>header h2 .ico-p,.cartao>header h3 .ico-p{opacity:.85}
/* botões: mesma altura, mesmo toque */
.botao{min-height:40px}
.botao.pequeno{min-height:34px}
.linha-acoes,.acoes{gap:8px}
/* títulos e textos */
h1,h2,h3{letter-spacing:-.01em}
.suave,.mini{line-height:1.45}
`;
  const st = document.createElement('style');
  st.id = 'bi-estilo-padrao';
  st.textContent = css;
  document.head.appendChild(st);

  tratar(document.body);
  observar();
})();
