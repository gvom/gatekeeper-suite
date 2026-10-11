/* Tela de plano com anotação por toque (Rodada 10).
 *
 * Interação, rótulos rápidos e formato do feedback adaptados do plannotator
 * (https://github.com/backnotprop/plannotator), Copyright 2025-2026 backnotprop, licença MIT.
 * Reescrito em JS ES5 sem dependências; todo texto via textContent, nunca HTML por string. */
(function () {
  'use strict';
  var S = window.GK_SCREENS;
  if (!S) return;
  var tg = window.Telegram && window.Telegram.WebApp;

  var T = {
    pt: { meta: 'Rodada {r} · {n} caracteres', tapHint: 'Toque num trecho para anotar.',
          comment: 'Comentar', remove: 'Remover do plano', good: 'Está bom', labels: 'Rótulos rápidos',
          note: 'Comentário', save: 'Salvar', cancel: 'Cancelar', del: 'Apagar',
          annotations: 'Anotações', none: 'Nenhuma anotação ainda.', general: 'Comentário geral',
          generalHint: 'Opcional: o que vale para o plano inteiro',
          execute: 'Executar', modify: 'Pedir mudanças', modifyNote: 'Pedir mudanças com nota…',
          autoReview: 'Auto revisar', discardQ: 'Executar descarta {n} anotação(ões). Continuar?',
          needFeedback: 'Anote um trecho ou escreva o que deve mudar.',
          confirm: 'Confirmar: ', alreadyChat: 'Já decidido pelo chat.', fail: 'Não foi possível enviar (HTTP ',
          changed: 'O plano mudou desde que o pedido foi feito. Decida pelo chat.',
          removeNote: 'Não quero isto no plano.', fbTitle: 'Feedback sobre o plano',
          fbRemove: 'Remover isto', fbOn: 'Feedback sobre', fbGeneral: 'Comentário geral' },
    en: { meta: 'Round {r} · {n} characters', tapHint: 'Tap a passage to annotate it.',
          comment: 'Comment', remove: 'Remove from the plan', good: 'Looks good', labels: 'Quick labels',
          note: 'Comment', save: 'Save', cancel: 'Cancel', del: 'Delete',
          annotations: 'Annotations', none: 'No annotations yet.', general: 'General comment',
          generalHint: 'Optional: anything that applies to the whole plan',
          execute: 'Execute', modify: 'Request changes', modifyNote: 'Request changes with a note…',
          autoReview: 'Auto review', discardQ: 'Executing discards {n} annotation(s). Continue?',
          needFeedback: 'Annotate a passage or write what should change.',
          confirm: 'Confirm: ', alreadyChat: 'Already decided in chat.', fail: 'Could not send (HTTP ',
          changed: 'The plan changed since the request. Decide in chat.',
          removeNote: "I don't want this in the plan.", fbTitle: 'Plan feedback',
          fbRemove: 'Remove this', fbOn: 'Feedback on', fbGeneral: 'General feedback' }
  };
  var code = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || 'en';
  var PT = String(code).toLowerCase().indexOf('pt') === 0;
  var L = PT ? T.pt : T.en;

  // Os 10 rótulos rápidos do plannotator. `tip` vai junto no feedback para orientar o agente.
  var QUICK_LABELS = PT ? [
    { emoji: '❓', label: 'Esclarecer isto', tip: 'Explique melhor este trecho.' },
    { emoji: '🗺', label: 'Falta visão geral', tip: 'Dê o contexto antes do detalhe.' },
    { emoji: '🔍', label: 'Verificar isto', tip: 'Confirme no código antes de seguir.' },
    { emoji: '💡', label: 'Dê um exemplo', tip: 'Mostre um exemplo concreto.' },
    { emoji: '🧩', label: 'Siga o padrão existente', tip: 'Use os padrões que o projeto já tem.' },
    { emoji: '🔀', label: 'Considere alternativas', tip: 'Compare com outra abordagem.' },
    { emoji: '🛡', label: 'Sem regressão', tip: 'Garanta que nada existente quebre.' },
    { emoji: '✂', label: 'Fora do escopo', tip: 'Isto não foi pedido; tire.' },
    { emoji: '🧪', label: 'Precisa de testes', tip: 'Cubra com testes.' },
    { emoji: '👏', label: 'Boa abordagem', tip: '' }
  ] : [
    { emoji: '❓', label: 'Clarify this', tip: 'Explain this passage better.' },
    { emoji: '🗺', label: 'Missing overview', tip: 'Give context before details.' },
    { emoji: '🔍', label: 'Verify this', tip: 'Check the code before moving on.' },
    { emoji: '💡', label: 'Give me an example', tip: 'Show a concrete example.' },
    { emoji: '🧩', label: 'Match existing patterns', tip: 'Use the patterns the project already has.' },
    { emoji: '🔀', label: 'Consider alternatives', tip: 'Compare with another approach.' },
    { emoji: '🛡', label: 'Ensure no regression', tip: 'Make sure nothing existing breaks.' },
    { emoji: '✂', label: 'Out of scope', tip: 'This was not asked for; drop it.' },
    { emoji: '🧪', label: 'Needs tests', tip: 'Cover it with tests.' },
    { emoji: '👏', label: 'Nice approach', tip: '' }
  ];

  function fmt(texto, valores) {
    return String(texto).replace(/\{(\w+)\}/g, function (_m, k) { return valores[k] != null ? valores[k] : ''; });
  }

  // Uma linha de markdown vira um bloco (ou null). Código cercado é tratado em parseBlocks.
  function lineBlock(linha) {
    var m = /^(#{1,6})\s+(.*)$/.exec(linha);
    if (m) return { type: 'heading', level: m[1].length, text: m[2] };
    m = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/.exec(linha);
    if (m) return { type: 'item', depth: Math.floor(m[1].length / 2), text: m[2] };
    m = /^>\s?(.*)$/.exec(linha);
    if (m) return { type: 'quote', text: m[1] };
    if (/^\s*\|[\s:|-]+\|\s*$/.test(linha)) return null;
    if (/^\s*\|/.test(linha)) {
      var celulas = linha.replace(/^\s*\||\|\s*$/g, '').split('|');
      return { type: 'row', text: celulas.map(function (c) { return c.trim(); }).join('  ·  ') };
    }
    return { type: 'para', text: linha.trim() };
  }

  // Markdown em blocos com id; cada bloco é uma âncora de anotação. O texto vai cru, sem HTML.
  function parseBlocks(texto) {
    var blocos = [];
    var codigo = null;
    String(texto || '').split(/\r?\n/).forEach(function (linha) {
      if (/^\s*```/.test(linha)) {
        if (codigo) { blocos.push(codigo); codigo = null; } else codigo = { type: 'code', text: '' };
        return;
      }
      if (codigo) { codigo.text += (codigo.text ? '\n' : '') + linha; return; }
      if (!linha.trim()) return;
      var bloco = lineBlock(linha);
      if (bloco) blocos.push(bloco);
    });
    if (codigo) blocos.push(codigo);
    return blocos.map(function (b, i) { b.id = 'b' + i; return b; });
  }

  // Rascunho por hash do plano: sobrevive a fechar a Mini App, some ao enviar a decisão.
  function draftKey(hash) { return 'gk-plan-draft:' + String(hash || '').slice(0, 32); }
  function loadDraft(hash) {
    try {
      var d = JSON.parse(window.localStorage.getItem(draftKey(hash)) || 'null');
      if (d && Array.isArray(d.anns)) return { anns: d.anns, general: String(d.general || '') };
    } catch (e) { /* sem storage */ }
    return { anns: [], general: '' };
  }
  function saveDraft(hash, estado) {
    try { window.localStorage.setItem(draftKey(hash), JSON.stringify(estado)); } catch (e) { /* opcional */ }
  }
  function clearDraft(hash) {
    try { window.localStorage.removeItem(draftKey(hash)); } catch (e) { /* opcional */ }
  }

  function snippet(texto, max) {
    var t = String(texto || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  // O feedback é texto para o agente, nunca HTML. O que pode quebrar a formatação: uma cerca de
  // código dentro do trecho (cerca mais longa que a maior sequência de crases) e aspas/linhas
  // dentro de uma citação curta (achatadas por `snippet`, aspas trocadas).
  function fence(texto) {
    var maior = 2;
    (String(texto).match(/`+/g) || []).forEach(function (s) { if (s.length > maior) maior = s.length; });
    var cerca = new Array(maior + 2).join('`');
    return [cerca, String(texto), cerca];
  }
  function quoted(texto) {
    return '"' + snippet(texto, 160).replace(/"/g, "'") + '"';
  }
  function blockquote(texto) {
    return '> ' + String(texto || '').replace(/\r?\n/g, '\n> ');
  }

  // Uma anotação no formato do plannotator (exportAnnotations).
  function exportOne(a, numero) {
    var n = numero + '. ';
    if (a.kind === 'delete') {
      return [n + L.fbRemove].concat(fence(a.text), [blockquote(L.removeNote)]);
    }
    if (a.kind === 'label' || a.kind === 'good') {
      var saida = [n + '[' + a.label + '] ' + L.fbOn + ': ' + quoted(a.text)];
      return a.tip ? saida.concat([blockquote(a.tip)]) : saida;
    }
    return [n + L.fbOn + ': ' + quoted(a.text), blockquote(a.note)];
  }

  function exportFeedback(estado) {
    var linhas = ['# ' + L.fbTitle, ''];
    estado.anns.forEach(function (a, i) { linhas = linhas.concat(exportOne(a, i + 1), ['']); });
    if (estado.general.trim()) linhas.push('## ' + L.fbGeneral, '', estado.general.trim(), '');
    return linhas.join('\n').trim();
  }

  var BLOCK_TAG = { heading: 'h3', item: 'div', quote: 'blockquote', code: 'pre', row: 'div', para: 'p' };

  function blockNode(h, bloco) {
    var no = h.el(BLOCK_TAG[bloco.type] || 'p', 'plan-block plan-' + bloco.type, bloco.text);
    if (bloco.type === 'heading') no.classList.add('plan-h' + Math.min(4, bloco.level));
    if (bloco.type === 'item') no.style.paddingLeft = (12 + 16 * (bloco.depth || 0)) + 'px';
    no.setAttribute('data-block', bloco.id);
    no.setAttribute('role', 'button');
    no.tabIndex = 0;
    return no;
  }

  function clearMark(no) {
    no.classList.remove('annotated', 'deleted');
    var antigo = no.querySelector('.ann-badge');
    if (antigo) no.removeChild(antigo);
  }

  // Marca os blocos anotados: número(s) da anotação; risco quando for remoção.
  function paintMarks(h, nos, estado) {
    Object.keys(nos).forEach(function (id) { clearMark(nos[id]); });
    estado.anns.forEach(function (a, i) {
      var no = nos[a.block];
      if (!no) return;
      no.classList.add(a.kind === 'delete' ? 'deleted' : 'annotated');
      var badge = no.querySelector('.ann-badge') || no.appendChild(h.el('span', 'ann-badge', ''));
      badge.textContent = badge.textContent ? badge.textContent + ',' + (i + 1) : String(i + 1);
    });
  }

  function sheetButton(h, texto, classe, aoTocar) {
    var b = h.el('button', classe, texto);
    b.type = 'button';
    b.onclick = aoTocar;
    return b;
  }

  // Compositor do comentário dentro do próprio sheet (mesmo gesto do plannotator).
  function commentComposer(h, corpo, bloco, adicionar, fechar) {
    h.clear(corpo);
    corpo.appendChild(h.el('blockquote', 'sheet-quote', snippet(bloco.text, 240)));
    var nota = document.createElement('textarea');
    nota.rows = 3;
    nota.maxLength = 2000;
    nota.placeholder = L.note;
    corpo.appendChild(nota);
    var barra = h.el('div', 'sheet-actions');
    barra.appendChild(sheetButton(h, L.cancel, 'btn-secondary', fechar));
    barra.appendChild(sheetButton(h, L.save, 'btn-primary', function () {
      if (!nota.value.trim()) { nota.focus(); return; }
      adicionar({ kind: 'comment', note: nota.value.trim() });
    }));
    corpo.appendChild(barra);
    nota.focus();
  }

  function labelChips(h, adicionar) {
    var grupo = h.el('div', 'chip-group label-chips');
    QUICK_LABELS.forEach(function (q) {
      grupo.appendChild(sheetButton(h, q.emoji + ' ' + q.label, 'tier-chip', function () {
        adicionar({ kind: 'label', label: q.label, tip: q.tip });
      }));
    });
    return grupo;
  }

  function blockActions(h, corpo, bloco, add, fechar) {
    var acoes = h.el('div', 'block-actions');
    acoes.appendChild(sheetButton(h, '💬 ' + L.comment, 'btn-secondary',
      function () { commentComposer(h, corpo, bloco, add, fechar); }));
    acoes.appendChild(sheetButton(h, '✂ ' + L.remove, 'btn-secondary tone-text-danger',
      function () { add({ kind: 'delete' }); }));
    acoes.appendChild(sheetButton(h, '👍 ' + L.good, 'btn-secondary',
      function () { add({ kind: 'good', label: L.good, tip: '' }); }));
    return acoes;
  }

  function openBlockSheet(h, bloco, adicionar) {
    window.GK_SHEET(h, snippet(bloco.text, 60), function (corpo, fechar) {
      var add = function (a) { a.block = bloco.id; a.text = bloco.text; adicionar(a); fechar(); };
      corpo.appendChild(h.el('blockquote', 'sheet-quote', snippet(bloco.text, 240)));
      corpo.appendChild(blockActions(h, corpo, bloco, add, fechar));
      corpo.appendChild(h.el('p', 'field-label', L.labels));
      corpo.appendChild(labelChips(h, add));
    });
  }

  var KIND_ICON = { comment: '💬', delete: '✂', label: '🏷', good: '👍' };

  function annotationItem(h, a, i, nos, remover) {
    var item = h.el('li', 'ann-item ann-' + a.kind);
    var topo = h.el('div', 'ann-head');
    topo.appendChild(h.el('span', 'ann-num', String(i + 1)));
    var rotulo = a.kind === 'delete' ? L.remove : (a.label || L.note);
    topo.appendChild(h.el('span', 'ann-kind', (KIND_ICON[a.kind] || '') + ' ' + rotulo));
    topo.appendChild(sheetButton(h, L.del, 'btn-text', function (ev) { ev.stopPropagation(); remover(i); }));
    item.appendChild(topo);
    item.appendChild(h.el('p', 'ann-snippet', snippet(a.text, 120)));
    if (a.note) item.appendChild(h.el('p', 'ann-note', a.note));
    item.onclick = function () {
      var no = nos[a.block];
      if (no) no.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    return item;
  }

  function renderPanel(h, painel, estado, nos, remover) {
    h.clear(painel);
    painel.appendChild(h.el('h3', 'group-title', L.annotations + ' (' + estado.anns.length + ')'));
    if (!estado.anns.length) { painel.appendChild(h.el('p', 'muted small', L.none)); return; }
    var lista = h.el('ol', 'ann-list');
    estado.anns.forEach(function (a, i) { lista.appendChild(annotationItem(h, a, i, nos, remover)); });
    painel.appendChild(lista);
  }

  function postDecision(ctx, cardId, hash, valor, feedback) {
    var ui = window.GK_UI;
    return ui.api(ctx, 'POST', 'cards-answer/' + encodeURIComponent(cardId), { value: valor, feedback: feedback })
      .then(function () {
        clearDraft(hash);
        try { tg.HapticFeedback.notificationOccurred('success'); } catch (e) { /* opcional */ }
        tg.close();
      })
      .catch(function (erro) {
        var st = String((erro && erro.message) || '').replace('http_', '');
        ui.showToast(st === '409' ? L.alreadyChat : L.fail + st + ').', 'danger');
      });
  }

  function confirmThen(texto, acao) {
    tg.showConfirm(texto, function (ok) { if (ok) acao(); });
  }

  // Executar com anotações pendentes avisa que elas não vão junto (ConfirmDialog do plannotator).
  // Pedir mudanças leva o feedback exportado; sem anotação nem comentário geral, pede a nota.
  function planDecision(ctx, h, cardId, hash, opcoes, estado) {
    var enviar = function (valor, nota) {
      if (valor === 'execute') {
        var aviso = estado.anns.length ? fmt(L.discardQ, { n: estado.anns.length }) : L.confirm + L.execute + '?';
        confirmThen(aviso, function () { postDecision(ctx, cardId, hash, 'execute', ''); });
        return;
      }
      if (valor === 'modify') {
        var geral = [estado.general, nota].filter(function (t) { return t && t.trim(); }).join('\n\n');
        var fb = exportFeedback({ anns: estado.anns, general: geral });
        if (!estado.anns.length && !geral.trim()) { window.GK_UI.showToast(L.needFeedback, 'warning'); return; }
        postDecision(ctx, cardId, hash, 'modify', fb);
        return;
      }
      confirmThen(L.confirm + L.autoReview + '?', function () { postDecision(ctx, cardId, hash, valor, ''); });
    };
    var itens = [];
    if (opcoes.indexOf('modify') >= 0) {
      itens.push({ code: 'modify', label: L.modify, tone: 'neutral' });
      itens.push({ code: 'modify', label: L.modifyNote, note: true, tone: 'neutral' });
    }
    if (opcoes.indexOf('auto_review') >= 0) itens.push({ code: 'auto_review', label: L.autoReview, tone: 'neutral' });
    return window.GK_UI.decisionControl(h, { code: 'execute', label: L.execute, tone: 'success' }, itens, enviar);
  }

  // Card primeiro: ele diz de qual sessão é o plano (Rodada 10: não mais o mais recente global).
  function loadPlan(ctx, h) {
    if (!ctx.card) return h.api(ctx, 'GET', 'plan/current').then(function (p) { return { plan: p, card: null }; });
    return h.api(ctx, 'GET', 'cards/' + encodeURIComponent(ctx.card)).then(function (card) {
      var rota = card.sessionId ? 'plan/session/' + encodeURIComponent(card.sessionId) : 'plan/current';
      return h.api(ctx, 'GET', rota).then(function (p) { return { plan: p, card: card }; });
    });
  }

  function generalBox(h, estado, salvar) {
    var caixa = h.el('div', 'general-box');
    caixa.appendChild(h.el('label', 'field-label', L.general));
    var campo = document.createElement('textarea');
    campo.rows = 2;
    campo.maxLength = 4000;
    campo.placeholder = L.generalHint;
    campo.value = estado.general;
    campo.oninput = function () { estado.general = campo.value; salvar(); };
    caixa.appendChild(campo);
    return caixa;
  }

  // Documento com blocos tocáveis. Devolve o mapa id -> nó, para marcar e rolar.
  function renderDocument(h, root, blocos, aoTocar) {
    var artigo = h.el('article', 'plan-doc');
    var nos = {};
    blocos.forEach(function (b) {
      var no = blockNode(h, b);
      if (aoTocar) no.onclick = function () { aoTocar(b); };
      nos[b.id] = no;
      artigo.appendChild(no);
    });
    root.appendChild(artigo);
    return nos;
  }

  function planMeta(h, plano) {
    return h.el('p', 'meta', fmt(L.meta, { r: plano.round, n: String(plano.plan || '').length }));
  }

  // Card aberto do tipo plano: anotação por toque, comentário geral, painel e decisão.
  function interactivePlan(ctx, h, root, plano, card) {
    var estado = loadDraft(plano.hash);
    var salvar = function () { saveDraft(plano.hash, estado); };
    var painel = h.el('section', 'ann-panel');
    var nos = {};
    var redesenhar = function () { salvar(); paintMarks(h, nos, estado); renderPanel(h, painel, estado, nos, remover); };
    function remover(i) { estado.anns.splice(i, 1); redesenhar(); }
    root.appendChild(h.el('p', 'muted small tap-hint', L.tapHint));
    nos = renderDocument(h, root, parseBlocks(plano.plan), function (bloco) {
      openBlockSheet(h, bloco, function (a) { estado.anns.push(a); redesenhar(); });
    });
    root.appendChild(generalBox(h, estado, salvar));
    root.appendChild(painel);
    root.appendChild(planDecision(ctx, h, card.id, plano.hash, card.options || [], estado));
    redesenhar();
  }

  S.plan = function (ctx, root, h) {
    root.appendChild(h.backLink());
    var limpar = h.skeleton(root);
    loadPlan(ctx, h).then(function (r) {
      limpar();
      root.appendChild(planMeta(h, r.plan));
      var aberto = r.card && r.card.state === 'open' && r.card.kind === 'plan';
      if (aberto && r.card.payload && r.card.payload.hash && r.card.payload.hash !== r.plan.hash) {
        root.appendChild(h.el('p', 'warn', L.changed));
        aberto = false;
      }
      if (aberto) { interactivePlan(ctx, h, root, r.plan, r.card); return; }
      renderDocument(h, root, parseBlocks(r.plan.plan), null);
    }).catch(function () { limpar(); h.fallback(undefined, function () { h.go('plan', { card: ctx.card }); }); });
  };
})();
