/* Telas read-only: status e config. Registram-se em window.GK_SCREENS (definido por app.js). */
(function () {
  'use strict';
  var S = window.GK_SCREENS;
  if (!S) return;

  var T = {
    pt: { state: 'Estado', session: 'Sessão', inflight: 'Ferramentas em voo', subagents: 'Subagentes',
          indicative: 'indicativo', goal: 'Objetivo', phase: 'Fase', open: 'Fases abertas',
          waiting: 'Aguardando', activity: 'Última atividade', notes: 'Observações', failures: 'Falhas',
          essentials: 'Essenciais', readonly: '🔒 = trava pelo ambiente do processo, não editável aqui.',
          shadowed: 'valor vindo do ambiente do processo; gravar não teria efeito', none: 'nenhum',
          undo: 'Desfazer última', restartQ: 'Reiniciar o daemon agora?' },
    en: { state: 'State', session: 'Session', inflight: 'Tools in flight', subagents: 'Subagents',
          indicative: 'indicative', goal: 'Goal', phase: 'Phase', open: 'Open phases',
          waiting: 'Waiting', activity: 'Last activity', notes: 'Notes', failures: 'Failures',
          essentials: 'Essentials', readonly: '🔒 = locked by the process environment, not editable here.',
          shadowed: 'value comes from the process environment; writing would have no effect', none: 'none',
          undo: 'Undo last', restartQ: 'Restart the daemon now?' }
  };

  function row(h, k, v) {
    var r = h.el('div', 'row'); r.appendChild(h.el('span', 'k', k)); r.appendChild(h.el('span', 'v', v)); return r;
  }

  function pickLang(tg) {
    var code = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || 'en';
    return String(code).toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en';
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

  // Fase 6a: `S.config` ganha escrita. `h.api` rejeita sem corpo em erro (util pro GET), mas
  // `confirm_required` (409) so faz sentido com o corpo — por isso as chamadas de escrita usam
  // `apiRaw` aqui, sem tocar no `h.api` compartilhado com as outras telas ja gated.
  function apiRaw(ctx, method, path, body) {
    var tg = window.Telegram && window.Telegram.WebApp;
    var headers = { 'X-Telegram-Init-Data': (tg && tg.initData) || '' };
    var opts = { method: method, headers: headers, cache: 'no-store' };
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(ctx.api.replace(/\/$/, '') + '/v1/miniapp/' + path, opts).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (json) { return { status: r.status, json: json }; });
    });
  }

  function setConfig(ctx, key, value, confirm) {
    var body = { value: String(value) };
    if (confirm) body.confirm = true;
    return apiRaw(ctx, 'POST', 'config/' + encodeURIComponent(key), body);
  }

  function handleWriteResult(ctx, status, json, onDone) {
    var tg = window.Telegram && window.Telegram.WebApp;
    var t = T[pickLang(tg)];
    var msg = (json && json.detail) ? json.detail : ('HTTP ' + status);
    if (status === 200 && json && json.ok && json.needs_restart) {
      new Promise(function (res) { tg.showConfirm(msg + '\n' + t.restartQ, res); })
        .then(function (ok) { if (ok) apiRaw(ctx, 'POST', 'daemon/restart', {}); });
    } else if (tg) {
      tg.showAlert(msg);
    }
    if (onDone) onDone();
  }

  function attachEditor(ctx, row, item, onDone) {
    if (!item.editable) return;
    var tg = window.Telegram && window.Telegram.WebApp;
    if (item.kind === 'bool') {
      var btn = document.createElement('button');
      btn.textContent = item.value === 'true' ? '🟢 on' : '🔴 off';
      btn.onclick = function () {
        btn.disabled = true;
        setConfig(ctx, item.key, item.value === 'true' ? 'false' : 'true', false)
          .then(function (r) { handleWriteResult(ctx, r.status, r.json, onDone); });
      };
      row.appendChild(btn);
      return;
    }
    if (item.kind === 'enum' && Array.isArray(item.choices)) {
      item.choices.forEach(function (choice) {
        var b = document.createElement('button');
        b.textContent = choice === item.value ? '● ' + choice : choice;
        b.onclick = function () {
          setConfig(ctx, item.key, choice, false).then(function (r) {
            if (r.status === 409 && r.json && r.json.code === 'confirm_required') {
              new Promise(function (res) {
                tg.showConfirm('Chave crítica. Trocar ' + item.key + ' de ' + (r.json.current || '?') + ' para ' + choice + '?', res);
              }).then(function (ok) {
                if (!ok) return;
                setConfig(ctx, item.key, choice, true).then(function (r2) { handleWriteResult(ctx, r2.status, r2.json, onDone); });
              });
            } else {
              handleWriteResult(ctx, r.status, r.json, onDone);
            }
          });
        };
        row.appendChild(b);
      });
    }
  }

  S.config = function (ctx, root, h) {
    var onDone = function () { S.config(ctx, root, h); };
    h.api(ctx, 'GET', 'config').then(function (resp) {
      h.clear(root);
      var t = T[resp.lang === 'pt' ? 'pt' : 'en'];
      root.appendChild(h.el('p', 'muted', t.readonly));
      var porChave = {};
      (resp.settings || []).forEach(function (s) { porChave[s.key] = s; });
      // Essenciais primeiro (mesma curadoria do chat).
      var ess = (resp.essentials || []).map(function (k) { return porChave[k]; }).filter(Boolean);
      if (ess.length) { root.appendChild(h.el('h2', null, '⭐ ' + t.essentials)); root.appendChild(lista(ctx, ess, t, h, onDone)); }
      // Depois por categoria › grupo, na ordem do registry.
      (resp.categories || []).forEach(function (cat) {
        var itens = (resp.settings || []).filter(function (s) { return s.category === cat; });
        if (!itens.length) return;
        root.appendChild(h.el('h2', null, cat));
        var grupos = {};
        var ordem = [];
        itens.forEach(function (s) { var g = s.groupLabel || ''; if (!(g in grupos)) { grupos[g] = []; ordem.push(g); } grupos[g].push(s); });
        ordem.forEach(function (g) { if (g) root.appendChild(h.el('p', 'muted', g)); root.appendChild(lista(ctx, grupos[g], t, h, onDone)); });
      });
      var undo = document.createElement('button');
      undo.textContent = '↶ ' + t.undo;
      undo.onclick = function () {
        apiRaw(ctx, 'POST', 'config/undo', { index: 0 }).then(function (r) {
          handleWriteResult(ctx, r.status, r.json, onDone);
        });
      };
      root.appendChild(undo);
    }).catch(function () { h.fallback(); });
  };

  function lista(ctx, itens, t, h, onDone) {
    var card = h.el('div', 'card');
    itens.forEach(function (s) {
      var r = h.el('div', 'row');
      var k = h.el('span', 'k', s.key.replace(/^(GATEKEEPER|GOVERNOR)_/, ''));
      k.title = s.help || s.description || '';
      var v = h.el('span', 'v', String(s.value) + (s.editable ? '' : ' 🔒') + (s.shadowed ? ' ⚠' : ''));
      if (s.shadowed) v.title = t.shadowed;
      r.appendChild(k); r.appendChild(v);
      attachEditor(ctx, r, s, onDone);
      card.appendChild(r);
    });
    return card;
  }
})();
