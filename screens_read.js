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
          save: 'Salvar', cancel: 'Cancelar', emptyValue: '(vazio)',
          activeSessions: 'Sessões ativas', edit: 'Editar',
          decrease: 'Diminuir', increase: 'Aumentar',
          invalidHour: 'Hora inválida -- use 0 a 23, ou deixe vazio pra desligar.',
          modelProbeFailed: 'Não deu pra confirmar a lista real de modelos (rede ou credencial). Digite o nome manualmente.',
          modelProbeLoading: 'Buscando modelos reais do provedor...',
          moveUp: 'Mover pra cima', moveDown: 'Mover pra baixo', removeItem: 'Remover',
          addItem: 'Adicionar' },
    en: { state: 'State', session: 'Session', inflight: 'Tools in flight', subagents: 'Subagents',
          indicative: 'indicative', goal: 'Goal', phase: 'Phase', open: 'Open phases',
          waiting: 'Waiting', activity: 'Last activity', notes: 'Notes', failures: 'Failures',
          essentials: 'Essentials', readonly: '= locked by the process environment, not editable here.',
          shadowed: 'value comes from the process environment; writing would have no effect', none: 'none',
          undo: 'Undo last', restartQ: 'Restart the daemon now?',
          save: 'Save', cancel: 'Cancel', emptyValue: '(empty)',
          activeSessions: 'Active sessions', edit: 'Edit',
          decrease: 'Decrease', increase: 'Increase',
          invalidHour: 'Invalid hour -- use 0 to 23, or leave empty to disable.',
          modelProbeFailed: 'Could not confirm the real model list (network or credential). Type the name manually.',
          modelProbeLoading: 'Looking up the real models from the provider...',
          moveUp: 'Move up', moveDown: 'Move down', removeItem: 'Remove',
          addItem: 'Add' }
  };

  function row(h, k, v) {
    var r = h.el('div', 'row'); r.appendChild(h.el('span', 'k', k)); r.appendChild(h.el('span', 'v', v)); return r;
  }

  // Fase 13 do redesign (Rodada 3): card de config nasce travado; "Editar" destrava. Fase 14
  // (achado no gate): o dono trocou "cada campo salva sozinho ao mudar" por salvamento em lote --
  // "Salvar" grava tudo que mudou desde que destravou, "Cancelar" descarta sem gravar nada.
  // Estado no escopo do modulo, chaveado por um id estavel de card (essentials, ou
  // "categoria/grupo"); sobrevive a re-renderizacoes de S.config, reseta so ao recarregar a pagina.
  var cardEditState = {};

  // Achado no gate da Fase 13 (Rodada 3), pre-existente desde a Fase 4: o `<details>` de
  // categoria nasce SEMPRE fechado a cada reconstrucao da tela -- e `onDone` reconstroi a tela
  // inteira apos CADA escrita de config. Editar um campo dentro de uma categoria aberta fazia ela
  // fechar sozinha na hora (lido pelo dono como "a tela fechando"). Mesmo padrao de persistencia
  // que `cardEditState`: guarda quais categorias estao abertas, sobrevive ao reload completo.
  var categoryOpenState = {};

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
      // Fase 11 do redesign (Rodada 2): alem do resumo "desta" sessao acima, lista TODAS as
      // sessoes ativas do gatekeeper -- dado novo (ManifestStore.open_runs() inteiro), busca
      // independente, falha aqui nao invalida o card de status principal.
      h.api(ctx, 'GET', 'sessions').then(function (respSessoes) {
        var lista = (respSessoes && respSessoes.sessions) || [];
        if (!lista.length) return;
        root.appendChild(h.el('h2', null, t.activeSessions));
        lista.forEach(function (sess) {
          var c = h.el('div', 'card');
          c.appendChild(row(h, t.session, sess.sessionId || '?'));
          c.appendChild(row(h, t.state, sess.state || '?'));
          if (sess.goal) c.appendChild(row(h, t.goal, sess.goal));
          if (sess.currentPhase) c.appendChild(row(h, t.phase, sess.currentPhase));
          if (sess.pendingInteraction) c.appendChild(row(h, t.waiting, sess.pendingInteraction));
          root.appendChild(c);
        });
      }).catch(function () { /* lista de sessoes e so um extra; o status principal ja apareceu */ });
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

  function handleWriteResult(ctx, status, json, onDone, h) {
    var tg = window.Telegram && window.Telegram.WebApp;
    var t = T[pickLang(tg)];
    var msg = (json && json.detail) ? json.detail : ('HTTP ' + status);
    if (status === 200 && json && json.ok && json.needs_restart) {
      new Promise(function (res) { tg.showConfirm(msg + '\n' + t.restartQ, res); })
        .then(function (ok) { if (ok) apiRaw(ctx, 'POST', 'daemon/restart', {}); });
    } else if (h && h.showToast) {
      // Fase 10 do redesign (Rodada 2): toast proprio no lugar de tg.showAlert -- sucesso e
      // falha de escrita de config nao devem parecer o Telegram falando com o dono.
      h.showToast(msg, json && json.ok ? 'success' : 'danger');
    } else if (tg) {
      tg.showAlert(msg);  // rede de seguranca: chamador que nao propagou `h` ainda funciona.
    }
    if (onDone) onDone();
  }

  // Fase 9 do redesign (Rodada 2): fluxo de escrita unico, reaproveitado por todo kind de
  // controle. Antes so o branch enum tratava confirm_required (409) — bool gravava direto e uma
  // chave critica do tipo bool falharia silenciosamente em vez de pedir confirmacao.
  function writeSetting(ctx, item, value, onDone, h) {
    var tg = window.Telegram && window.Telegram.WebApp;
    setConfig(ctx, item.key, value, false).then(function (r) {
      if (r.status === 409 && r.json && r.json.code === 'confirm_required') {
        new Promise(function (res) {
          tg.showConfirm('Chave crítica. Trocar ' + item.key + ' de ' + (r.json.current || '?') + ' para ' + value + '?', res);
        }).then(function (ok) {
          if (!ok) { if (onDone) onDone(); return; }
          setConfig(ctx, item.key, value, true).then(function (r2) { handleWriteResult(ctx, r2.status, r2.json, onDone, h); });
        });
      } else {
        handleWriteResult(ctx, r.status, r.json, onDone, h);
      }
    });
  }

  // Fase 14 do redesign (Rodada 3, achado no gate): "Salvar" do card grava em lote tudo que ficou
  // pendente durante a edicao -- um `writeSetting()` de cada vez (mesmo caminho de sempre, com o
  // mesmo aviso de chave critica quando cabe), encadeados pra so recarregar a tela no final.
  function salvarPendencias(ctx, itens, pendencias, onDone, h) {
    var chaves = Object.keys(pendencias);
    if (!chaves.length) { if (onDone) onDone(); return; }
    var porChave = {};
    itens.forEach(function (s) { porChave[s.key] = s; });
    var i = 0;
    function proxima() {
      if (i >= chaves.length) { if (onDone) onDone(); return; }
      var chave = chaves[i++];
      writeSetting(ctx, porChave[chave], pendencias[chave], proxima, h);
    }
    proxima();
  }

  var SMART_REVIEW_TIERS_CONHECIDOS = ['safe', 'project', 'suspicious'];

  // Fase 17 do redesign (Rodada 3): mesma allowlist canonica de GATEKEEPER_BACKEND (backend,
  // config_registry.py) -- essa chave e deprecated, entao nunca chega na resposta /config (mesmo
  // achado da Fase 15 com FALLBACK_BACKEND); precisa de copia propria aqui.
  var BACKEND_CHAIN_CONHECIDOS = ['ollama', 'gemini', 'cerebras', 'custom', 'claude', 'openai',
    'openrouter', 'huggingface'];

  // Fase 15 do redesign (Rodada 3): `notifications.py` ja trata qualquer valor fora de "vazio ou
  // 0-23" como desligado silenciosamente -- a validacao aqui e so pra avisar o dono na hora em vez
  // de aceitar um valor que na pratica nao faz nada.
  var HORA_VALIDACAO_CHAVES = ['GATEKEEPER_NOTIFY_QUIET_START', 'GATEKEEPER_NOTIFY_QUIET_END'];

  // Fase 16 do redesign (Rodada 3): espelha o mapeamento chave->backend da rota
  // `GET providers/<backend>` (`suite_core/miniapp/routes_read.py`) -- nao ha modulo compartilhado
  // entre Python e JS, mapa pequeno (8 entradas), duplicacao aceitavel.
  var MODELO_CHAVE_BACKEND = {
    GATEKEEPER_MODEL: 'ollama',
    GATEKEEPER_GEMINI_MODEL: 'gemini',
    GATEKEEPER_CEREBRAS_MODEL: 'cerebras',
    GATEKEEPER_CUSTOM_MODEL: 'custom',
    GATEKEEPER_OPENAI_MODEL: 'openai',
    GATEKEEPER_OPENROUTER_MODEL: 'openrouter',
    GATEKEEPER_CLAUDE_MODEL: 'claude',
    GATEKEEPER_CLAUDE_HEADLESS_MODEL: 'claude'
  };
  function horaValida(v) {
    if (v === '') return true;
    if (!/^\d+$/.test(v)) return false;
    var n = parseInt(v, 10);
    return n >= 0 && n <= 23;
  }
  // Bloqueia o Salvar do dialogo em vez de aceitar um valor que o backend so ia ignorar.
  // Fase 16 do redesign (Rodada 3): busca a lista real de modelos do provedor (rota
  // `providers/<backend>`, sem chamada de inferencia) e devolve um <select> pronto -- quem chama
  // decide o que fazer se a promise falhar (nunca bloqueia a edicao, so nao troca o input).
  // `backend` sempre vem de `MODELO_CHAVE_BACKEND` (mapa fixo, nunca entrada do usuario); o
  // servidor tambem valida contra a allowlist de `providers.SPECS` (Fase 16, Task 1).
  function buscaSelectDeModelos(ctx, h, backend, valorAtual) {
    return h.api(ctx, 'GET', 'providers/' + backend).then(function (resp) {
      if (!resp.reachable || !resp.models || !resp.models.length) throw new Error('unreachable');
      var sel = document.createElement('select');
      var temValorAtual = false;
      resp.models.forEach(function (modelo) {
        var opt = document.createElement('option');
        opt.value = modelo; opt.textContent = modelo;
        if (modelo === valorAtual) { opt.selected = true; temValorAtual = true; }
        sel.appendChild(opt);
      });
      if (!temValorAtual && valorAtual) {
        var extra = document.createElement('option');
        extra.value = valorAtual; extra.textContent = valorAtual; extra.selected = true;
        sel.insertBefore(extra, sel.firstChild);
      }
      return sel;
    });
  }

  function aplicaValidacaoHora(inp, salvar, t) {
    var erroHora = document.createElement('p');
    erroHora.className = 'muted err';
    erroHora.textContent = t.invalidHour;
    var validaCampo = function () {
      var valido = horaValida(inp.value.trim());
      erroHora.hidden = valido;
      salvar.disabled = !valido;
    };
    inp.oninput = validaCampo;
    validaCampo();
    return erroHora;
  }

  function attachTiersChips(item, t, h, pendencias, row) {
    var atuais = (item.value || '').split(',').map(function (v) { return v.trim(); }).filter(Boolean);
    var selecionados = atuais.slice();
    var wrapTiers = document.createElement('div');
    wrapTiers.className = 'chip-group row-control';
    var chipsEls = [];
    SMART_REVIEW_TIERS_CONHECIDOS.forEach(function (tierNome) {
      var chipTier = document.createElement('button');
      chipTier.type = 'button';
      chipTier.className = 'tier-chip';
      chipTier.textContent = tierNome;
      chipTier.disabled = true;  // Fase 13 do redesign (Rodada 3): card nasce travado.
      var marcaSelecionado = function () {
        var marcado = selecionados.indexOf(tierNome) !== -1;
        chipTier.setAttribute('aria-pressed', marcado ? 'true' : 'false');
        chipTier.classList.toggle('selected', marcado);
      };
      marcaSelecionado();
      chipTier.onclick = function () {
        var pos = selecionados.indexOf(tierNome);
        if (pos !== -1) { selecionados.splice(pos, 1); } else { selecionados.push(tierNome); }
        marcaSelecionado();
        pendencias[item.key] = selecionados.join(',');
      };
      wrapTiers.appendChild(chipTier);
      chipsEls.push(chipTier);
    });
    row.appendChild(wrapTiers);
    return chipsEls;
  }

  // Fase 17 do redesign (Rodada 3): controle de GATEKEEPER_BACKEND_CHAIN -- reordenar/adicionar/
  // remover, nunca digitar texto livre (elimina o typo silencioso que motivou manter esta chave
  // travada ate aqui; reforcado tambem no validate() do servidor, Task 1). Numero de linhas muda
  // (add/remove), diferente de todo outro controle (numero fixo de elementos) -- por isso devolve
  // um wrapper com `.disabled` customizado via defineProperty em vez de uma lista de elementos: e
  // o unico jeito do card travar/destravar este controle sem `lista()` precisar saber que ele e
  // dinamico.
  function attachBackendChainEditor(item, pendencias, t, h, row) {
    var atuais = (item.value || '').split(',').map(function (v) { return v.trim(); }).filter(Boolean);
    var travado = true;
    var wrap = document.createElement('div');
    wrap.className = 'chain-editor row-control';
    var listaEl = document.createElement('div');
    listaEl.className = 'chain-list';
    var selectAdd = document.createElement('select');
    selectAdd.className = 'row-control';
    var botaoAdd = document.createElement('button');
    botaoAdd.type = 'button';
    botaoAdd.textContent = t.addItem;

    function atualizaCsv() { pendencias[item.key] = atuais.join(','); }

    function redesenhaLista() {
      h.clear(listaEl);
      atuais.forEach(function (nome, indice) {
        var linha = document.createElement('div');
        linha.className = 'chain-item';
        linha.appendChild(h.el('span', 'chain-nome', nome));
        var subir = document.createElement('button');
        subir.type = 'button'; subir.className = 'stepper-btn';
        subir.textContent = '▲'; subir.setAttribute('aria-label', t.moveUp);
        subir.disabled = travado || indice === 0;
        subir.onclick = function () {
          var tmp = atuais[indice - 1]; atuais[indice - 1] = atuais[indice]; atuais[indice] = tmp;
          atualizaCsv(); redesenhaLista();
        };
        var descer = document.createElement('button');
        descer.type = 'button'; descer.className = 'stepper-btn';
        descer.textContent = '▼'; descer.setAttribute('aria-label', t.moveDown);
        descer.disabled = travado || indice === atuais.length - 1;
        descer.onclick = function () {
          var tmp = atuais[indice + 1]; atuais[indice + 1] = atuais[indice]; atuais[indice] = tmp;
          atualizaCsv(); redesenhaLista();
        };
        var remover = document.createElement('button');
        remover.type = 'button'; remover.className = 'stepper-btn';
        remover.textContent = '✕'; remover.setAttribute('aria-label', t.removeItem);
        remover.disabled = travado;
        remover.onclick = function () {
          atuais.splice(indice, 1);
          atualizaCsv(); redesenhaLista(); redesenhaSelect();
        };
        linha.appendChild(subir); linha.appendChild(descer); linha.appendChild(remover);
        listaEl.appendChild(linha);
      });
    }

    function redesenhaSelect() {
      h.clear(selectAdd);
      BACKEND_CHAIN_CONHECIDOS.filter(function (b) { return atuais.indexOf(b) === -1; })
        .forEach(function (nome) {
          var opt = document.createElement('option');
          opt.value = nome; opt.textContent = nome;
          selectAdd.appendChild(opt);
        });
      var semOpcoes = selectAdd.children.length === 0;
      selectAdd.disabled = travado || semOpcoes;
      botaoAdd.disabled = travado || semOpcoes;
    }

    botaoAdd.onclick = function () {
      if (!selectAdd.value) return;
      atuais.push(selectAdd.value);
      atualizaCsv(); redesenhaLista(); redesenhaSelect();
    };

    Object.defineProperty(wrap, 'disabled', {
      get: function () { return travado; },
      set: function (v) { travado = !!v; redesenhaLista(); redesenhaSelect(); }
    });

    redesenhaLista(); redesenhaSelect();
    var addRow = document.createElement('div');
    addRow.className = 'chain-add-row';
    addRow.appendChild(selectAdd); addRow.appendChild(botaoAdd);
    wrap.appendChild(listaEl); wrap.appendChild(addRow);
    row.appendChild(wrap);
    return wrap;
  }

  function attachEditor(ctx, row, item, t, h, pendencias) {
    if (!item.editable) return;
    // Fase 15 do redesign (Rodada 3): as 3 unicas opcoes reais que esta chave aceita (confirmado
    // lendo `_classify_edit()` no backend -- so safe/project/suspicious, nao os ~7 imaginados no
    // rascunho original do plano) viram chips de multi-selecao. Chave continua `kind=text` no
    // registry (nao e um enum de valor unico), valor gravado como CSV.
    if (item.key === 'GATEKEEPER_SMART_REVIEW_TIERS') return attachTiersChips(item, t, h, pendencias, row);
    if (item.key === 'GATEKEEPER_BACKEND_CHAIN') return attachBackendChainEditor(item, pendencias, t, h, row);
    if (item.kind === 'bool') {
      // Fase 9 do redesign (Rodada 2): switch nativo no lugar do botao on/off -- o proprio
      // controle ja demonstra o estado (marcado/desmarcado), sem precisar de texto ao lado.
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'switch';
      chk.checked = item.value === 'true';
      chk.disabled = true;  // Fase 13 do redesign (Rodada 3): card nasce travado.
      // Fase 14 (achado no gate): so acumula em `pendencias` -- quem grava e o "Salvar" do card.
      chk.onchange = function () { pendencias[item.key] = chk.checked ? 'true' : 'false'; };
      row.appendChild(chk);
      return chk;
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
      sel.disabled = true;  // Fase 13 do redesign (Rodada 3): card nasce travado.
      // Fase 14 (achado no gate): so acumula em `pendencias` -- quem grava e o "Salvar" do card.
      sel.onchange = function () { pendencias[item.key] = sel.value; };
      row.appendChild(sel);
      return sel;
    }
    var NUMERIC_KINDS = ['int', 'float', 'duration_s', 'duration_ms'];
    if (NUMERIC_KINDS.indexOf(item.kind) !== -1) {
      var temIntervalo = item.minimum !== null && item.minimum !== undefined &&
        item.maximum !== null && item.maximum !== undefined;
      var passo = item.kind === 'float' ? '0.01' : '1';
      // Fase 14 do redesign (Rodada 3): stepper -/+ reaproveita o mesmo incremento que o chat ja
      // usa (steps_for() no backend, exposto via item.steps) -- o menor passo declarado/derivado,
      // digitacao direta continua disponivel pro ajuste fino que o botao nao cobre.
      var incremento = (item.steps && item.steps.length) ? item.steps[0] :
        (item.kind === 'float' ? 0.01 : 1);
      // Fase 14 do redesign (Rodada 3): botoes -/+ e o input ficam juntos num wrapper proprio
      // (`.stepper-wrap`, carrega o `row-control` que antes ia direto no input) -- sem isso o
      // `.row` externo podia separar os botoes do input em linhas diferentes ao quebrar.
      var wrap = document.createElement('div');
      wrap.className = 'stepper-wrap row-control';
      var menos = document.createElement('button');
      menos.type = 'button'; menos.className = 'stepper-btn';
      menos.textContent = '−'; menos.setAttribute('aria-label', t.decrease);
      var mais = document.createElement('button');
      mais.type = 'button'; mais.className = 'stepper-btn';
      mais.textContent = '+'; mais.setAttribute('aria-label', t.increase);
      if (temIntervalo) {
        // Fase 9 do redesign (Rodada 2): range com rotulo ao vivo -- unico jeito de ver o
        // numero exato durante o arraste, entao nao e redundante com o proprio slider.
        var range = document.createElement('input');
        range.type = 'range';
        range.min = String(item.minimum);
        range.max = String(item.maximum);
        range.step = passo;
        range.value = item.value;
        var val = document.createElement('span');
        val.className = 'range-val';
        val.textContent = item.value;
        range.disabled = true;  // Fase 13 do redesign (Rodada 3): card nasce travado.
        range.oninput = function () { val.textContent = range.value; };
        // Fase 14 (achado no gate): so acumula em `pendencias` -- quem grava e o "Salvar" do card.
        range.onchange = function () { pendencias[item.key] = range.value; };
        var atualizaLimites = function () {
          var atual = parseFloat(range.value);
          menos.disabled = range.disabled || atual <= item.minimum;
          mais.disabled = range.disabled || atual >= item.maximum;
        };
        menos.onclick = function () {
          var novo = Math.max(item.minimum, parseFloat(range.value) - incremento);
          range.value = novo; val.textContent = String(novo);
          atualizaLimites();
          pendencias[item.key] = String(novo);
        };
        mais.onclick = function () {
          var novo = Math.min(item.maximum, parseFloat(range.value) + incremento);
          range.value = novo; val.textContent = String(novo);
          atualizaLimites();
          pendencias[item.key] = String(novo);
        };
        atualizaLimites();
        wrap.appendChild(menos); wrap.appendChild(range); wrap.appendChild(mais);
        row.appendChild(wrap);
        row.appendChild(val);
        return [menos, range, mais];
      } else {
        var num = document.createElement('input');
        num.type = 'number';
        num.step = passo;
        num.value = item.value;
        num.disabled = true;  // Fase 13 do redesign (Rodada 3): card nasce travado.
        // Fase 14 (achado no gate): so acumula em `pendencias` -- quem grava e o "Salvar" do card.
        num.onchange = function () { pendencias[item.key] = num.value; };
        menos.onclick = function () {
          var novo = (parseFloat(num.value) || 0) - incremento;
          num.value = novo;
          pendencias[item.key] = String(novo);
        };
        mais.onclick = function () {
          var novo = (parseFloat(num.value) || 0) + incremento;
          num.value = novo;
          pendencias[item.key] = String(novo);
        };
        wrap.appendChild(menos); wrap.appendChild(num); wrap.appendChild(mais);
        row.appendChild(wrap);
        return [menos, num, mais];
      }
    }
    if (item.kind === 'text' || item.kind === 'path') {
      // Fase 9 do redesign (Rodada 2): chip que abre um <dialog> nativo pra editar -- resolve o
      // overflow de tentar caber um input de texto na linha apertada do row, e o proprio chip ja
      // mostra o valor atual (sem duplicar em `.v`).
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'row-control chip';
      chip.textContent = item.value || t.emptyValue;
      chip.disabled = true;  // Fase 13 do redesign (Rodada 3): card nasce travado.
      chip.onclick = function () {
        var dlg = document.createElement('dialog');
        dlg.className = 'gk-dialog';
        var lbl = document.createElement('label');
        lbl.textContent = item.key;
        var inp = document.createElement('input');
        inp.type = 'text';
        // Fase 14 (achado no gate): reabrir o dialogo mostra o valor ja pendente nesta sessao de
        // edicao (se houver), nao o valor antigo do servidor.
        inp.value = pendencias[item.key] !== undefined ? pendencias[item.key] : item.value;
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
        // Fase 14 (achado no gate): so acumula em `pendencias` -- quem grava e o "Salvar" do card.
        salvar.onclick = function () {
          dlg.close();
          chip.textContent = inp.value || t.emptyValue;
          pendencias[item.key] = inp.value;
        };
        acoes.appendChild(cancelar);
        acoes.appendChild(salvar);
        dlg.appendChild(lbl);
        dlg.appendChild(inp);
        if (HORA_VALIDACAO_CHAVES.indexOf(item.key) !== -1) dlg.appendChild(aplicaValidacaoHora(inp, salvar, t));
        var backendModelo = MODELO_CHAVE_BACKEND[item.key];
        if (backendModelo) {
          // Achado no gate: alguns provedores (ex Ollama local) demoram alguns segundos pra
          // responder -- sem aviso visivel na hora, parecia que nada estava acontecendo. Mostra
          // "buscando..." desde o inicio, troca pro select (sucesso) ou pro aviso de falha (nunca
          // some sem dizer nada -- ou um ou outro, sempre visivel).
          var avisoModelo = document.createElement('p');
          avisoModelo.className = 'muted';
          avisoModelo.textContent = t.modelProbeLoading;
          dlg.appendChild(avisoModelo);
          buscaSelectDeModelos(ctx, h, backendModelo, inp.value).then(function (sel) {
            inp.replaceWith(sel);
            inp = sel;
            avisoModelo.remove();
          }).catch(function () { avisoModelo.textContent = t.modelProbeFailed; });
        }
        dlg.appendChild(acoes);
        dlg.addEventListener('close', function () { dlg.remove(); });
        row.appendChild(dlg);
        dlg.showModal();
      };
      row.appendChild(chip);
      return chip;
    }
  }

  S.config = function (ctx, root, h, scrollY) {
    var onDone = function () { S.config(ctx, root, h, window.scrollY); };
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
      if (ess.length) { root.appendChild(h.iconLabel('h2', 'star', t.essentials)); root.appendChild(lista(ctx, ess, t, h, onDone, 'essentials')); }
      // Depois por categoria › grupo, na ordem do registry.
      // Fase 4 do redesign: `<details>`/`<summary>` — abre/fecha sozinho, sem JS de toggle,
      // acessivel e funciona com toque. Nao precisa de CDN nem string de HTML: o navegador ja
      // sabe renderizar o estado nativo do elemento. Fase 13 (Rodada 3): barra com titulo +
      // seta a direita (marcador nativo removido, icone proprio no lugar -- CSS gira 180o quando
      // aberto); conteudo mora dentro de uma caixa visual quando expandida; estado aberto/fechado
      // persiste em `categoryOpenState` (evento nativo `toggle`), sobrevive ao reload de `onDone`.
      (resp.categories || []).forEach(function (cat) {
        var itens = (resp.settings || []).filter(function (s) { return s.category === cat; });
        if (!itens.length) return;
        var det = document.createElement('details');
        det.className = 'cat-details';
        det.open = !!categoryOpenState[cat];
        det.addEventListener('toggle', function () { categoryOpenState[cat] = det.open; });
        var sum = document.createElement('summary');
        sum.appendChild(h.el('span', null, cat));
        var chevron = h.icon('arrow-down');
        chevron.classList.add('details-chevron');
        sum.appendChild(chevron);
        det.appendChild(sum);
        var conteudo = document.createElement('div');
        conteudo.className = 'cat-content';
        var grupos = {};
        var ordem = [];
        itens.forEach(function (s) { var g = s.groupLabel || ''; if (!(g in grupos)) { grupos[g] = []; ordem.push(g); } grupos[g].push(s); });
        ordem.forEach(function (g) { if (g) conteudo.appendChild(h.el('p', 'muted', g)); conteudo.appendChild(lista(ctx, grupos[g], t, h, onDone, cat + '/' + g)); });
        det.appendChild(conteudo);
        root.appendChild(det);
      });
      var undo = h.iconLabel('button', 'undo', t.undo);
      undo.onclick = function () {
        apiRaw(ctx, 'POST', 'config/undo', { index: 0 }).then(function (r) {
          handleWriteResult(ctx, r.status, r.json, onDone, h);
        });
      };
      root.appendChild(undo);
      if (scrollY != null) window.scrollTo(0, scrollY);
    }).catch(function () { limpar(); h.fallback(undefined, function () { S.config(ctx, root, h); }); });
  };

  function lista(ctx, itens, t, h, onDone, cardId) {
    var card = h.el('div', 'card');
    // Fase 13 do redesign (Rodada 3): linhas vao pra um wrapper `.card-body` em vez de direto no
    // `.card` -- a camada de bloqueio (overlay com desfoque) cobre so o body, nunca o cabecalho
    // com o botao Editar/Salvar.
    var body = document.createElement('div');
    body.className = 'card-body';
    var controles = [];
    // Fase 14 do redesign (Rodada 3, achado no gate): edicoes ficam aqui enquanto o card esta
    // destravado -- nada e gravado ate o dono tocar "Salvar" (ou descartado ao tocar "Cancelar").
    var pendencias = {};
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
      var controle = attachEditor(ctx, r, s, t, h, pendencias);
      // Fase 14 do redesign (Rodada 3): attachEditor() pode devolver mais de um controle (range
      // com botoes -/+ ao lado) -- os dois formatos (elemento unico ou array) sao aceitos aqui.
      if (Array.isArray(controle)) { controles = controles.concat(controle); }
      else if (controle) { controles.push(controle); }
      body.appendChild(r);
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
        body.appendChild(desc);
      }
    });
    card.appendChild(body);
    // Fase 13 do redesign (Rodada 3): cabecalho com Editar/Salvar -- so quando o card tem pelo
    // menos um controle editavel (card 100% travado pelo ambiente nao ganha o botao). Estado
    // (destravado ou nao) mora em `cardEditState`, sobrevive ao reload completo que `onDone`
    // dispara apos cada escrita. Camada de bloqueio (leve desfoque) cobre so o `.card-body`,
    // nunca o cabecalho -- da pra ler as configuracoes atras dela, so nao interagir (a trava real
    // e o `disabled` dos controles; a camada e so o sinal visual). Fase 14 (achado no gate):
    // destravado mostra DOIS botoes -- "Salvar" grava em lote tudo que ficou em `pendencias` e
    // "Cancelar" descarta sem gravar nada (os dois voltam pro card travado com um reload).
    if (controles.length) {
      var destravado = !!cardEditState[cardId];
      controles.forEach(function (c) { c.disabled = !destravado; });
      var overlay = document.createElement('div');
      overlay.className = 'card-lock-overlay';
      overlay.hidden = destravado;
      body.appendChild(overlay);
      var head = document.createElement('div');
      head.className = 'card-head';
      var renderHead = function () {
        h.clear(head);
        if (destravado) {
          var salvar = h.iconLabel('button', 'check', t.save);
          salvar.className = 'edit-toggle';
          salvar.onclick = function () {
            cardEditState[cardId] = false;
            controles.forEach(function (c) { c.disabled = true; });
            salvarPendencias(ctx, itens, pendencias, onDone, h);
          };
          var cancelar = h.iconLabel('button', 'x', t.cancel);
          cancelar.className = 'edit-toggle cancel';
          cancelar.onclick = function () {
            cardEditState[cardId] = false;
            onDone();
          };
          head.appendChild(salvar);
          head.appendChild(cancelar);
        } else {
          var editar = h.iconLabel('button', 'edit', t.edit);
          editar.className = 'edit-toggle';
          editar.onclick = function () {
            destravado = true;
            cardEditState[cardId] = true;
            controles.forEach(function (c) { c.disabled = false; });
            overlay.hidden = true;
            renderHead();
          };
          head.appendChild(editar);
        }
      };
      renderHead();
      card.insertBefore(head, card.firstChild);
    }
    return card;
  }
})();
