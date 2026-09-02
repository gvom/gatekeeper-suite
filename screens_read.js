/* Telas read-only: status e config. Registram-se em window.GK_SCREENS (definido por app.js). */
(function () {
  'use strict';
  var S = window.GK_SCREENS;
  if (!S) return;

  var T = {
    pt: { state: 'Estado', session: 'Sessão', inflight: 'Ferramentas em voo', subagents: 'Subagentes',
          indicative: 'indicativo', goal: 'Objetivo', phase: 'Fase', open: 'Fases abertas',
          waiting: 'Aguardando', activity: 'Última atividade', notes: 'Observações', failures: 'Falhas',
          essentials: 'Essenciais', readonly: 'Somente leitura nesta versão — altere pelo /config do chat.',
          shadowed: 'valor vindo do ambiente do processo; gravar não teria efeito', none: 'nenhum' },
    en: { state: 'State', session: 'Session', inflight: 'Tools in flight', subagents: 'Subagents',
          indicative: 'indicative', goal: 'Goal', phase: 'Phase', open: 'Open phases',
          waiting: 'Waiting', activity: 'Last activity', notes: 'Notes', failures: 'Failures',
          essentials: 'Essentials', readonly: 'Read-only in this version — change it via /config in chat.',
          shadowed: 'value comes from the process environment; writing would have no effect', none: 'none' }
  };

  function row(h, k, v) {
    var r = h.el('div', 'row'); r.appendChild(h.el('span', 'k', k)); r.appendChild(h.el('span', 'v', v)); return r;
  }

  S.status = function (ctx, root, h) {
    h.api(ctx, 'GET', 'status').then(function (resp) {
      var t = T[resp.lang === 'pt' ? 'pt' : 'en'];
      var s = resp.status || {};
      var card = h.el('div', 'card');
      card.appendChild(row(h, t.state, s.state || '?'));
      if (s.sessionId) card.appendChild(row(h, t.session, s.sessionId));
      card.appendChild(row(h, t.inflight, String(s.inflightTools || 0)));
      card.appendChild(row(h, t.subagents, s.subagents ? String(s.subagents) + (s.subagentsReliable ? '' : ' (' + t.indicative + ')') : t.none));
      if (s.goal) card.appendChild(row(h, t.goal, s.goal));
      if (s.currentPhase) card.appendChild(row(h, t.phase, s.currentPhase));
      if (s.openPhases && s.openPhases.length) card.appendChild(row(h, t.open, s.openPhases.join(', ')));
      if (s.pendingInteraction) card.appendChild(row(h, t.waiting, s.pendingInteraction));
      if (s.governorPaused && s.governorReason) card.appendChild(row(h, '⏳', s.governorReason));
      root.appendChild(card);
      if (s.lastActivity) { root.appendChild(h.el('h2', null, t.activity)); root.appendChild(h.el('pre', null, s.lastActivity)); }
      if (s.notes && s.notes.length) { root.appendChild(h.el('h2', null, t.notes)); s.notes.forEach(function (n) { root.appendChild(h.el('p', 'muted', '⚠️ ' + n)); }); }
      if (s.failures && s.failures.length) { root.appendChild(h.el('h2', null, t.failures)); root.appendChild(h.el('p', 'err', s.failures.join('; '))); }
    }).catch(function () { h.fallback(); });
  };

  S.config = function (ctx, root, h) {
    h.api(ctx, 'GET', 'config').then(function (resp) {
      var t = T[resp.lang === 'pt' ? 'pt' : 'en'];
      root.appendChild(h.el('p', 'muted', t.readonly));
      var porChave = {};
      (resp.settings || []).forEach(function (s) { porChave[s.key] = s; });
      // Essenciais primeiro (mesma curadoria do chat).
      var ess = (resp.essentials || []).map(function (k) { return porChave[k]; }).filter(Boolean);
      if (ess.length) { root.appendChild(h.el('h2', null, '⭐ ' + t.essentials)); root.appendChild(lista(ess, t, h)); }
      // Depois por categoria › grupo, na ordem do registry.
      (resp.categories || []).forEach(function (cat) {
        var itens = (resp.settings || []).filter(function (s) { return s.category === cat; });
        if (!itens.length) return;
        root.appendChild(h.el('h2', null, cat));
        var grupos = {};
        var ordem = [];
        itens.forEach(function (s) { var g = s.groupLabel || ''; if (!(g in grupos)) { grupos[g] = []; ordem.push(g); } grupos[g].push(s); });
        ordem.forEach(function (g) { if (g) root.appendChild(h.el('p', 'muted', g)); root.appendChild(lista(grupos[g], t, h)); });
      });
    }).catch(function () { h.fallback(); });
  };

  function lista(itens, t, h) {
    var card = h.el('div', 'card');
    itens.forEach(function (s) {
      var r = h.el('div', 'row');
      var k = h.el('span', 'k', s.key.replace(/^(GATEKEEPER|GOVERNOR)_/, ''));
      k.title = s.help || s.description || '';
      var v = h.el('span', 'v', String(s.value) + (s.editable ? '' : ' 🔒') + (s.shadowed ? ' ⚠' : ''));
      if (s.shadowed) v.title = t.shadowed;
      r.appendChild(k); r.appendChild(v); card.appendChild(r);
    });
    return card;
  }
})();
