/* =========================================================
   gestor.js — História 4: painel do gestor
   Métricas e regras ficam em status.js; aqui só lemos e exibimos.
   ========================================================= */
(function () {
  const usuario = Auth.exigirPerfil(['gestor']);
  if (!usuario) return;
  garantirDados();

  const $ = id => document.getElementById(id);
  $('quem').textContent = usuario.nome + ' · Gestor';
  $('btnSair').addEventListener('click', () => { Auth.sair(); window.location.href = 'index.html'; });

  const devolvida = os => os.etiqueta === ETIQUETA_SEM_CONSERTO;

  /* ---------- Métricas ---------- */
  function renderMetricas(lista) {
    const ativas = lista.filter(o => o.coluna < 6);
    const concluidas = lista.filter(o => o.coluna === 6);
    const urgentes = ativas.filter(o => o.classe === 'urgente').length;
    const semConserto = concluidas.filter(devolvida).length;
    const emRisco = ativas.filter(o => riscoDaOS(o));
    const colunasWip = COLUNAS.filter(c => c.wip !== null && contarNaColuna(lista, c.id) >= c.wip);

    // Mostra a conta para o gestor poder conferir à mão
    const tempos = lista.map(tempoDeConsertoMs).filter(t => t !== null);
    const media = mediaConserto(lista);
    const conta = tempos.length
      ? (tempos.length <= 6
          ? `(${tempos.map(t => (t / 86400000).toFixed(1).replace('.', ',')).join(' + ')}) ÷ ${tempos.length} dias`
          : `soma dos tempos ÷ ${tempos.length} OS`)
      : 'nenhuma OS concluída com conserto ainda';

    const cartoes = [
      { nome: 'Em andamento', valor: ativas.length, detalhe: `${urgentes} urgente(s) ativo(s)` },
      { nome: 'Concluídas', valor: concluidas.length, detalhe: `${semConserto} devolvida(s) sem conserto` },
      { nome: 'Tempo médio de conserto', valor: formatarDuracao(media.ms),
        detalhe: `Recebido → Pronto, ${media.n} OS com conserto concluído. ${conta}` },
      { nome: 'OS com prazo em risco', valor: emRisco.length, alerta: emRisco.length > 0,
        detalhe: 'Data Fixa a menos de 24h ou Padrão parada há mais de 3 dias úteis' },
      { nome: 'Colunas no limite de WIP', valor: colunasWip.length, alerta: colunasWip.length > 0,
        detalhe: colunasWip.length ? colunasWip.map(c => c.nome).join(', ') : 'Todas com vaga' }
    ];

    $('metricas').innerHTML = cartoes.map(c => `
      <div class="metrica${c.alerta ? ' alerta' : ''}">
        <div class="nome">${c.nome}</div>
        <div class="valor">${c.valor}</div>
        <div class="detalhe">${c.detalhe}</div>
      </div>`).join('');
  }

  /* ---------- Alertas ---------- */
  function renderAlertas(lista) {
    const itens = [];

    COLUNAS.filter(c => c.wip !== null).forEach(c => {
      const qtd = contarNaColuna(lista, c.id);
      if (qtd > c.wip) {
        itens.push(`<li><span class="tag risco">WIP excedido</span> <strong>${c.nome}</strong> está com ${qtd}/${c.wip} (chamado Urgente passou do limite).</li>`);
      } else if (qtd === c.wip) {
        itens.push(`<li><span class="tag risco">WIP no limite</span> <strong>${c.nome}</strong> está com ${qtd}/${c.wip}: novos cartões Padrão e Data Fixa ficam bloqueados.</li>`);
      }
    });

    ordenarFila(lista.filter(o => o.coluna < 6)).forEach(o => {
      const risco = riscoDaOS(o);
      if (!risco) return;
      itens.push(`<li><span class="tag risco">${risco}</span>
        <span class="mono">${Fmt.escapar(o.id)}</span>
        <span class="tag ${o.classe}">${CLASSES[o.classe].icone} ${CLASSES[o.classe].rotulo}</span>
        ${Fmt.escapar(o.marca)} ${Fmt.escapar(o.modelo)} · ${getColuna(o.coluna).nome}
        ${o.classe === 'dataFixa' && o.dataLimite ? ' · prazo ' + Fmt.dataHora(o.dataLimite) : ''}</li>`);
    });

    $('alertas').innerHTML = itens.length ? itens.join('') : '<li>Nenhum alerta no momento.</li>';
  }

  /* ---------- Fila por coluna (somente leitura) ---------- */
  function renderFila(lista) {
    $('fila').innerHTML = COLUNAS.map(c => {
      const itens = ordenarFila(lista.filter(o => o.coluna === c.id));
      const qtd = itens.length;
      const comLimite = c.wip !== null;
      const cheia = comLimite && qtd >= c.wip;
      const excedida = comLimite && qtd > c.wip;

      const cartoes = itens.map(o => {
        const risco = riscoDaOS(o);
        const cls = CLASSES[o.classe];
        return `<article class="cartao ${o.classe}${risco ? ' em-risco' : ''}">
          <div class="topo-cartao">
            <span class="os-id">${Fmt.escapar(o.id)}</span>
            <span class="tag ${o.classe}">${cls.icone} ${cls.rotulo}</span>
          </div>
          <div>${Fmt.escapar(o.marca)} ${Fmt.escapar(o.modelo)}</div>
          <div class="meta">${Fmt.escapar(o.cliente)}</div>
          <div class="tags">
            ${o.classe === 'dataFixa' && o.dataLimite ? `<span class="tag dataFixa">Prazo ${Fmt.dataHora(o.dataLimite)}</span>` : ''}
            ${risco ? `<span class="tag risco">${risco}</span>` : ''}
            ${devolvida(o) ? `<span class="tag sem-conserto">${ETIQUETA_SEM_CONSERTO}</span>` : ''}
          </div>
        </article>`;
      }).join('');

      return `<section class="coluna${cheia ? ' cheia' : ''}${excedida ? ' excedida' : ''}" aria-label="${c.nome}">
        <div class="coluna-cabecalho">
          <span>${c.nome}</span>
          <span class="wip${cheia ? ' cheio' : ''}">${comLimite ? `${qtd}/${c.wip}` : qtd}</span>
        </div>
        <div class="coluna-corpo">${cartoes}</div>
      </section>`;
    }).join('');
  }

  /* ---------- Histórico com filtros ---------- */
  function montarOpcoesFiltros(lista) {
    const tecnicos = [...new Set(lista.map(o => o.tecnico).filter(Boolean))].sort();
    const tecAtual = $('fTec').value;
    $('fTec').innerHTML = '<option value="">Todos</option>' +
      tecnicos.map(t => `<option value="${Fmt.escapar(t)}">${Fmt.escapar(t)}</option>`).join('') +
      '<option value="__sem">Sem técnico</option>';
    $('fTec').value = tecAtual;

    const stAtual = $('fStatus').value;
    $('fStatus').innerHTML = '<option value="">Todos</option>' +
      COLUNAS.map(c => `<option value="c${c.id}">${c.id}. ${c.nome}${c.id === 6 ? ' (todas)' : ''}</option>`).join('') +
      '<option value="devolvida">Devolvidas sem conserto</option>';
    $('fStatus').value = stAtual;
  }

  function aplicarFiltros(lista) {
    const de = $('fDe').value ? new Date($('fDe').value + 'T00:00:00') : null;
    const ate = $('fAte').value ? new Date($('fAte').value + 'T23:59:59.999') : null;
    const tec = $('fTec').value;
    const st = $('fStatus').value;

    if (de && ate && de > ate) return null;   // intervalo inválido

    return lista.filter(o => {
      const entrada = new Date(o.criadaEm);
      if (de && entrada < de) return false;
      if (ate && entrada > ate) return false;
      if (tec === '__sem' && o.tecnico) return false;
      if (tec && tec !== '__sem' && o.tecnico !== tec) return false;
      if (st === 'devolvida' && !devolvida(o)) return false;
      if (st.startsWith('c') && o.coluna !== Number(st.slice(1))) return false;
      return true;
    });
  }

  function renderHistorico(lista) {
    const filtradas = aplicarFiltros(lista);
    $('erroFiltro').hidden = filtradas !== null;
    const resultado = (filtradas || []).sort((a, b) => new Date(b.criadaEm) - new Date(a.criadaEm));

    $('contagem').textContent = `Mostrando ${resultado.length} de ${lista.length} registros.`;

    if (!resultado.length) {
      $('tabHist').innerHTML = '<tr><td colspan="9" class="vazio">Nenhum serviço encontrado com esses filtros.</td></tr>';
      return;
    }

    $('tabHist').innerHTML = resultado.map(o => {
      const cls = CLASSES[o.classe];
      const tempo = tempoDeConsertoMs(o);
      return `<tr>
        <td class="mono">${Fmt.escapar(o.id)}</td>
        <td>${Fmt.escapar(o.cliente)}</td>
        <td>${Fmt.escapar(o.marca)} ${Fmt.escapar(o.modelo)}</td>
        <td><span class="tag ${o.classe}">${cls.icone} ${cls.rotulo}</span></td>
        <td>${o.tecnico ? Fmt.escapar(o.tecnico) : '—'}</td>
        <td>${getColuna(o.coluna).nome}${devolvida(o) ? ` <span class="tag sem-conserto">${ETIQUETA_SEM_CONSERTO}</span>` : ''}</td>
        <td class="mono">${Fmt.dataHora(o.criadaEm)}</td>
        <td class="mono">${o.coluna === 6 ? (devolvida(o) ? 'não se aplica' : formatarDuracao(tempo)) : '—'}</td>
        <td><button class="btn-mini" type="button" data-id="${Fmt.escapar(o.id)}">Trilha</button></td>
      </tr>`;
    }).join('');
  }

  $('filtros').addEventListener('input', () => renderHistorico(OS.todas()));
  $('filtros').addEventListener('change', () => renderHistorico(OS.todas()));
  $('filtros').addEventListener('submit', e => e.preventDefault());
  $('btnLimparFiltros').addEventListener('click', () => {
    $('filtros').reset();
    renderHistorico(OS.todas());
  });

  /* ---------- Modal: trilha de auditoria ---------- */
  $('tabHist').addEventListener('click', e => {
    const id = e.target.getAttribute('data-id');
    if (!id) return;
    const os = OS.buscar(id);
    if (!os) return;
    $('modalTitulo').textContent = `${os.id} · ${os.marca} ${os.modelo}`;
    $('modalCorpo').innerHTML = `<ul class="linha-tempo">${
      [...os.historico].reverse().map(h =>
        `<li><span class="quando">${h.data} ${h.hora}</span> · ${Fmt.escapar(h.acao)} <em>(${Fmt.escapar(h.autor)})</em></li>`
      ).join('')}</ul>`;
    $('modalFundo').classList.add('aberto');
    $('modalFundo').setAttribute('aria-hidden', 'false');
    $('modalFechar').focus();
  });
  function fecharModal() {
    $('modalFundo').classList.remove('aberto');
    $('modalFundo').setAttribute('aria-hidden', 'true');
  }
  $('modalFechar').addEventListener('click', fecharModal);
  $('modalFundo').addEventListener('click', e => { if (e.target === $('modalFundo')) fecharModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });

  /* ---------- Início ---------- */
  function render() {
    const lista = OS.todas();
    renderMetricas(lista);
    renderAlertas(lista);
    renderFila(lista);
    montarOpcoesFiltros(lista);
    renderHistorico(lista);
  }
  render();
})();