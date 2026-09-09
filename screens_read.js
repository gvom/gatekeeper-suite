/* Telas read-only: status e config. Registram-se em window.GK_SCREENS (definido por app.js). */
(function () {
  'use strict';
  var S = window.GK_SCREENS;
  if (!S) return;

  var T = {
    pt: { state: 'Estado', session: 'Sessão', inflight: 'Ferramentas em voo', subagents: 'Subagentes',
          indicative: 'indicativo', goal: 'Objetivo', phase: 'Fase', open: 'Fases abertas',
          waiting: 'Aguardando', activity: 'Última atividade', notes: 'Observações', failures: 'Falhas',
          essentials: 'Essenciais', readonly: '= trava pelo ambiente do processo, não editável aqui.',
          shadowed: 'valor vindo do ambiente do processo; gravar não teria efeito', none: 'nenhum',
          undo: 'Desfazer última', restartQ: 'Reiniciar o daemon agora?',
          save: 'Salvar', cancel: 'Cancelar', emptyValue: '(vazio)' },
    en: { state: 'State', session: 'Session', inflight: 'Tools in flight', subagents: 'Subagents',
          indicative: 'indicative', goal: 'Goal', phase: 'Phase', open: 'Open phases',
          waiting: 'Waiting', activity: 'Last activity', notes: 'Notes', failures: 'Failures',
          essentials: 'Essentials', readonly: '= locked by the process environment, not editable here.',
          shadowed: 'value comes from the process environment; writing would have no effect', none: 'none',
          undo: 'Undo last', restartQ: 'Restart the daemon now?',
          save: 'Save', cancel: 'Cancel', emptyValue: '(empty)' }
  };

  function row(h, k, v) {
    var r = h.el('div', 'row'); r.appendChild(h.el('span', 'k', k)); r.appendChild(h.el('span', 'v', v)); return r;
  }

  function pickLang(tg) {
    var code = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || 'en';
    return String(code).toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en';
  }

  S.status = function (ctx, root, h) {
    var limpar = h.skeleton(root);
    h.api(ctx, 'GET', 'status').then(function (resp) {
      limpar();
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
      if (s.notes && s.notes.length) {
        root.appendChild(h.el('h2', null, t.notes));
        s.notes.forEach(function (n) {
          var p = h.iconLabel('p', 'alert-triangle', n);
          p.className = 'muted';
          root.appendChild(p);
        });
      }
      if (s.failures && s.failures.length) { root.appendChild(h.el('h2', null, t.failures)); root.appendChild(h.el('p', 'err', s.failures.join('; '))); }
    }).catch(function () { limpar(); h.fallback(undefined, function () { S.status(ctx, root, h); }); });
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

  // Fase 9 do redesign (Rodada 2): fluxo de escrita unico, reaproveitado por todo kind de
  // controle. Antes so o branch enum tratava confirm_required (409) — bool gravava direto e uma
  // chave critica do tipo bool falharia silenciosamente em vez de pedir confirmacao.
  function writeSetting(ctx, item, value, onDone) {
    var tg = window.Telegram && window.Telegram.WebApp;
    setConfig(ctx, item.key, value, false).then(function (r) {
      if (r.status === 409 && r.json && r.json.code === 'confirm_required') {
        new Promise(function (res) {
          tg.showConfirm('Chave crítica. Trocar ' + item.key + ' de ' + (r.json.current || '?') + ' para ' + value + '?', res);
        }).then(function (ok) {
          if (!ok) { if (onDone) onDone(); return; }
          setConfig(ctx, item.key, value, true).then(function (r2) { handleWriteResult(ctx, r2.status, r2.json, onDone); });
        });
      } else {
        handleWriteResult(ctx, r.status, r.json, onDone);
      }
    });
  }

  function attachEditor(ctx, row, item, onDone, t) {
    if (!item.editable) return;
    if (item.kind === 'bool') {
      // Fase 9 do redesign (Rodada 2): switch nativo no lugar do botao on/off -- o proprio
      // controle ja demonstra o estado (marcado/desmarcado), sem precisar de texto ao lado.
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'switch';
      chk.checked = item.value === 'true';
      chk.onchange = function () {
        chk.disabled = true;
        writeSetting(ctx, item, chk.checked ? 'true' : 'false', onDone);
      };
      row.appendChild(chk);
      return;
    }
    if (item.kind === 'enum' && Array.isArray(item.choices)) {
      // Fase 9 do redesign (Rodada 2): <select> nativo no lugar de N botoes empilhados -- o
      // proprio elemento ja mostra a opcao atual, sem precisar de marcador ('●') ao lado.
      var sel = document.createElement('select');
      sel.className = 'row-control';
      item.choices.forEach(function (choice) {
        var opt = document.createElement('option');
        opt.value = choice; opt.textContent = choice;
        if (choice === item.value) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = function () {
        var escolha = sel.value;
        sel.disabled = true;
        writeSetting(ctx, item, escolha, function () {
          sel.disabled = false;
          if (onDone) onDone();
        });
      };
      row.appendChild(sel);
      return;
    }
    var NUMERIC_KINDS = ['int', 'float', 'duration_s', 'duration_ms'];
    if (NUMERIC_KINDS.indexOf(item.kind) !== -1) {
      var temIntervalo = item.minimum !== null && item.minimum !== undefined &&
        item.maximum !== null && item.maximum !== undefined;
      var passo = item.kind === 'float' ? '0.01' : '1';
      if (temIntervalo) {
        // Fase 9 do redesign (Rodada 2): range com rotulo ao vivo -- unico jeito de ver o
        // numero exato durante o arraste, entao nao e redundante com o proprio slider.
        var range = document.createElement('input');
        range.type = 'range';
        range.className = 'row-control';
        range.min = String(item.minimum);
        range.max = String(item.maximum);
        range.step = passo;
        range.value = item.value;
        var val = document.createElement('span');
        val.className = 'range-val';
        val.textContent = item.value;
        range.oninput = function () { val.textContent = range.value; };
        range.onchange = function () {
          range.disabled = true;
          writeSetting(ctx, item, range.value, onDone);
        };
        row.appendChild(range);
        row.appendChild(val);
      } else {
        var num = document.createElement('input');
        num.type = 'number';
        num.className = 'row-control';
        num.step = passo;
        num.value = item.value;
        num.onchange = function () {
          num.disabled = true;
          writeSetting(ctx, item, num.value, onDone);
        };
        row.appendChild(num);
      }
      return;
    }
    if (item.kind === 'text' || item.kind === 'path') {
      // Fase 9 do redesign (Rodada 2): chip que abre um <dialog> nativo pra editar -- resolve o
      // overflow de tentar caber um input de texto na linha apertada do row, e o proprio chip ja
      // mostra o valor atual (sem duplicar em `.v`).
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'row-control chip';
      chip.textContent = item.value || t.emptyValue;
      chip.onclick = function () {
        var dlg = document.createElement('dialog');
        dlg.className = 'gk-dialog';
        var lbl = document.createElement('label');
        lbl.textContent = item.key;
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.value = item.value;
        var acoes = document.createElement('div');
        acoes.className = 'gk-dialog-actions';
        var cancelar = document.createElement('button');
        cancelar.type = 'button';
        cancelar.className = 'cancel';
        cancelar.textContent = t.cancel;
        cancelar.onclick = function () { dlg.close(); };
        var salvar = document.createElement('button');
        salvar.type = 'button';
        salvar.textContent = t.save;
        salvar.onclick = function () {
          dlg.close();
          writeSetting(ctx, item, inp.value, onDone);
        };
        acoes.appendChild(cancelar);
        acoes.appendChild(salvar);
        dlg.appendChild(lbl);
        dlg.appendChild(inp);
        dlg.appendChild(acoes);
        dlg.addEventListener('close', function () { dlg.remove(); });
        row.appendChild(dlg);
        dlg.showModal();
      };
      row.appendChild(chip);
    }
  }

  S.config = function (ctx, root, h) {
    var onDone = function () { S.config(ctx, root, h); };
    var limpar = h.skeleton(root);
    h.api(ctx, 'GET', 'config').then(function (resp) {
      limpar();
      h.clear(root);
      var t = T[resp.lang === 'pt' ? 'pt' : 'en'];
      var pReadonly = h.iconLabel('p', 'lock', t.readonly);
      pReadonly.className = 'muted';
      root.appendChild(pReadonly);
      var porChave = {};
      (resp.settings || []).forEach(function (s) { porChave[s.key] = s; });
      // Essenciais primeiro (mesma curadoria do chat).
      var ess = (resp.essentials || []).map(function (k) { return porChave[k]; }).filter(Boolean);
      if (ess.length) { root.appendChild(h.iconLabel('h2', 'star', t.essentials)); root.appendChild(lista(ctx, ess, t, h, onDone)); }
      // Depois por categoria › grupo, na ordem do registry.
      // Fase 4 do redesign: `<details>`/`<summary>` — abre/fecha sozinho, sem JS de toggle,
      // acessivel e funciona com toque. Nao precisa de CDN nem string de HTML: o navegador ja
      // sabe renderizar o triangulo/estado nativo do elemento.
      (resp.categories || []).forEach(function (cat) {
        var itens = (resp.settings || []).filter(function (s) { return s.category === cat; });
        if (!itens.length) return;
        var det = document.createElement('details');
        var sum = document.createElement('summary');
        sum.textContent = cat;
        det.appendChild(sum);
        var grupos = {};
        var ordem = [];
        itens.forEach(function (s) { var g = s.groupLabel || ''; if (!(g in grupos)) { grupos[g] = []; ordem.push(g); } grupos[g].push(s); });
        ordem.forEach(function (g) { if (g) det.appendChild(h.el('p', 'muted', g)); det.appendChild(lista(ctx, grupos[g], t, h, onDone)); });
        root.appendChild(det);
      });
      var undo = h.iconLabel('button', 'undo', t.undo);
      undo.onclick = function () {
        apiRaw(ctx, 'POST', 'config/undo', { index: 0 }).then(function (r) {
          handleWriteResult(ctx, r.status, r.json, onDone);
        });
      };
      root.appendChild(undo);
    }).catch(function () { limpar(); h.fallback(undefined, function () { S.config(ctx, root, h); }); });
  };

  function lista(ctx, itens, t, h, onDone) {
    var card = h.el('div', 'card');
    itens.forEach(function (s) {
      var r = h.el('div', 'row');
      var k = h.el('span', 'k', s.key.replace(/^(GATEKEEPER|GOVERNOR)_/, ''));
      // Fase 9 do redesign (Rodada 2): quando o proprio controle ja demonstra o valor (switch
      // pro bool, select pro enum, range com min/max pro numerico com intervalo -- o range tem
      // rotulo ao vivo proprio, so o number puro sem intervalo mantem `.v` pra nao virar
      // ambiguo; chip pro texto/caminho, o valor vira o proprio texto do chip), o texto
      // duplicado em `.v` some -- o span continua existindo (vazio) so pra hospedar os icones de
      // lock/shadowed.
      var valorRedundante = s.editable && (s.kind === 'bool' || s.kind === 'enum' ||
        s.kind === 'text' || s.kind === 'path' ||
        (['int', 'float', 'duration_s', 'duration_ms'].indexOf(s.kind) !== -1 &&
         s.minimum !== null && s.minimum !== undefined && s.maximum !== null && s.maximum !== undefined));
      var v = h.el('span', 'v', valorRedundante ? '' : String(s.value));
      if (!s.editable) v.appendChild(h.icon('lock'));
      if (s.shadowed) { v.appendChild(h.icon('alert-triangle')); v.title = t.shadowed; }
      r.appendChild(k); r.appendChild(v);
      attachEditor(ctx, r, s, onDone, t);
      card.appendChild(r);
      // Fase 4 do redesign: ajuda tocavel no lugar do `title` — um tooltip HTML nativo so abre
      // com hover, invisivel em touchscreen. A chave vira um disclosure: toca, mostra o texto
      // logo abaixo da linha; toca de novo, esconde.
      var ajuda = s.help || s.description || '';
      if (ajuda) {
        var desc = h.el('p', 'muted help-desc', ajuda);
        desc.hidden = true;
        k.className = 'k k-help';
        k.setAttribute('role', 'button');
        k.setAttribute('tabindex', '0');
        k.onclick = function () { desc.hidden = !desc.hidden; };
        card.appendChild(desc);
      }
    });
    return card;
  }
})();
