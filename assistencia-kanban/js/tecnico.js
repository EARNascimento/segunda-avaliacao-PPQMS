/* =========================================================
   tecnico.js — História 2: painel do técnico e atualização de status
   As regras de transição ficam em status.js (podeMover).
   ========================================================= */
(function () {
  const usuario = Auth.exigirPerfil(['tecnico']);
  if (!usuario) return;
  garantirDados();

  const $ = id => document.getElementById(id);
  let arrastandoId = null;
  let timerToast = null;

  $('quem').textContent = usuario.nome + ' · Técnico';
  $('btnSair').addEventListener('click', () => { Auth.sair(); window.location.href = 'index.html'; });

  /* ---------- Mensagens ---------- */
  function toast(msg, tipo = 'ok') {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast ' + (tipo === 'ok' ? '' : tipo);
    el.hidden = false;
    clearTimeout(timerToast);
    timerToast = setTimeout(() => { el.hidden = true; }, 5000);
  }

  /* ---------- Movimentação (núcleo da História 2) ---------- */
  function moverOS(id, destino) {
    const lista = OS.todas();
    const os = lista.find(o => o.id === id);
    if (!os) return;

    const origem = os.coluna;

    // Diagnóstico -> Aguardando Aprovação só acontece enviando o orçamento
    if (origem === 2 && destino === 3) { abrirOrcamento(os); return; }

    const r = podeMover(os, destino, lista);
    if (!r.ok) {
      toast(r.motivo, 'erro');
      return;
    }

    os.coluna = destino;
    os.entradaColunaEm = new Date().toISOString();
    if (destino >= 2 && !os.tecnico) os.tecnico = usuario.nome;

    const retorno = origem === 5 && destino === 4;
    OS.registrarHistorico(
      os,
      (retorno ? 'Reprovada nos testes finais. ' : '') +
      `Movida de "${getColuna(origem).nome}" para "${getColuna(destino).nome}"` +
      (r.excedeWip ? ' (WIP excedido por chamado Urgente)' : ''),
      usuario.nome
    );

    OS.salvarTodas(lista);
    toast(
      r.excedeWip ? r.motivo : `${os.id} movida para ${getColuna(destino).nome}.`,
      r.excedeWip ? 'alerta' : 'ok'
    );
    render();
  }

  /* ---------- Renderização do quadro ---------- */
  function diasNaColuna(os) {
    return Math.floor((Date.now() - new Date(os.entradaColunaEm)) / 86400000);
  }

  let cacheOrc = [];
  function orcamentoAtual(osId) {
    const l = cacheOrc.filter(o => o.osId === osId);
    return l.length ? l[l.length - 1] : null;   // versões são gravadas em ordem
  }

  function htmlCartao(os) {
    const risco = riscoDaOS(os);
    const cls = CLASSES[os.classe];
    const dias = diasNaColuna(os);

    let acoes = '';
    let orcHtml = '';
    if (os.coluna === 2) {
      acoes = `<div class="cartao-acoes">
        <button class="btn-mini principal" type="button" data-acao="orcamento" data-id="${os.id}">Diagnosticar e enviar orçamento</button>
      </div>`;
    } else if (os.coluna === 3) {
      const orc = orcamentoAtual(os.id);
      if (orc) {
        const pendente = orc.status === 'enviado';
        orcHtml = `<div class="orc-resumo">Orçamento v${orc.versao} · ${Fmt.dinheiro(orc.valorTotal)} ·
          ${pendente ? 'vence ' + Fmt.dataHora(Orc.venceEm(orc)) : '<span class="tag expirado">expirado</span>'}</div>`;
        acoes = `<div class="espera">Aguardando decisão do cliente</div>
          <div class="cartao-acoes"><button class="btn-mini ${pendente ? '' : 'alerta'}" type="button" data-acao="orcamento" data-id="${os.id}">Novo orçamento</button></div>`;
      } else {
        acoes = '<div class="espera">Aguardando decisão do cliente</div>';
      }
    } else if (os.coluna < 6) {
      const prox = getColuna(os.coluna + 1).nome;
      acoes = `<div class="cartao-acoes">
        <button class="btn-mini principal" type="button" data-acao="avancar" data-id="${os.id}">Avançar ▸ ${prox}</button>
        ${os.coluna === 5 ? `<button class="btn-mini alerta" type="button" data-acao="reprovar" data-id="${os.id}">Reprovou nos testes</button>` : ''}
      </div>`;
    }

    return `<article class="cartao ${os.classe}${risco ? ' em-risco' : ''}" draggable="true" data-id="${os.id}">
      <div class="topo-cartao">
        <span class="os-id">${Fmt.escapar(os.id)}</span>
        <span class="tag ${os.classe}">${cls.icone} ${cls.rotulo}</span>
      </div>
      <div>${Fmt.escapar(os.marca)} ${Fmt.escapar(os.modelo)}</div>
      <div class="meta">${Fmt.escapar(os.cliente)} · ${Fmt.escapar(os.defeito)}</div>
      <div class="meta">${dias === 0 ? 'Entrou hoje nesta etapa' : dias + (dias === 1 ? ' dia' : ' dias') + ' nesta etapa'}</div>
      <div class="tags">
        ${os.classe === 'dataFixa' && os.dataLimite ? `<span class="tag dataFixa">Prazo ${Fmt.dataHora(os.dataLimite)}</span>` : ''}
        ${risco ? `<span class="tag risco">${risco}</span>` : ''}
        ${os.etiqueta ? `<span class="tag sem-conserto">${Fmt.escapar(os.etiqueta)}</span>` : ''}
      </div>
      ${orcHtml}
      ${acoes}
      <div class="cartao-acoes">
        <button class="btn-mini" type="button" data-acao="historico" data-id="${os.id}">Histórico</button>
      </div>
    </article>`;
  }

  function renderQuadro() {
    cacheOrc = Orc.todos();
    const lista = OS.todas();
    const excedidas = [];

    $('quadro').innerHTML = COLUNAS.map(c => {
      const itens = ordenarFila(lista.filter(o => o.coluna === c.id));
      const qtd = itens.length;
      const comLimite = c.wip !== null;
      const cheia = comLimite && qtd >= c.wip;
      const excedida = comLimite && qtd > c.wip;
      if (excedida) excedidas.push(`${c.nome} (${qtd}/${c.wip})`);

      return `<section class="coluna${cheia ? ' cheia' : ''}${excedida ? ' excedida' : ''}" data-col="${c.id}" aria-label="${c.nome}">
        <div class="coluna-cabecalho">
          <span>${c.nome}</span>
          <span class="wip${cheia ? ' cheio' : ''}">${comLimite ? `${qtd}/${c.wip}` : qtd}</span>
        </div>
        <div class="coluna-corpo">${itens.map(htmlCartao).join('')}</div>
      </section>`;
    }).join('');

    const aviso = $('avisoWip');
    if (excedidas.length) {
      aviso.textContent = 'Alerta de WIP excedido por chamado Urgente em: ' + excedidas.join('; ') + '. O gestor também vê este alerta.';
      aviso.hidden = false;
    } else {
      aviso.hidden = true;
    }
  }

  /* ---------- Recebimento de aparelhos agendados ---------- */
  function renderRecebimentos() {
    const pendentes = DB.ler(CHAVES.agendamentos, [])
      .filter(a => !a.osId && a.cliente !== 'Outro cliente')
      .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));

    if (!pendentes.length) {
      $('recebimentos').innerHTML =
        '<p class="vazio">Nenhum aparelho aguardando. Agende um conserto pela área do cliente para ele aparecer aqui.</p>';
      return;
    }

    $('recebimentos').innerHTML = pendentes.map(a => {
      const [ano, mes, dia] = a.data.split('-');
      return `<div class="recebimento" data-ag="${a.id}">
        <strong>${Fmt.escapar(a.marca)} ${Fmt.escapar(a.modelo)}</strong>
        <div class="meta">${Fmt.escapar(a.cliente)} · ${dia}/${mes}/${ano} às ${a.hora}</div>
        <div class="meta">${Fmt.escapar(a.defeito)}</div>
        <div class="linha">
          <div>
            <label for="cls-${a.id}">Classe de serviço</label>
            <select id="cls-${a.id}" data-campo="classe">
              <option value="padrao">🔵 Padrão</option>
              <option value="dataFixa">🟡 Data Fixa</option>
              <option value="urgente">🔴 Urgente</option>
            </select>
          </div>
          <div data-campo-prazo hidden>
            <label for="prz-${a.id}">Prazo combinado</label>
            <input id="prz-${a.id}" type="datetime-local" data-campo="prazo">
          </div>
        </div>
        <button class="btn" type="button" data-acao="receber" data-ag="${a.id}">Confirmar recebimento</button>
      </div>`;
    }).join('');
  }

  $('recebimentos').addEventListener('change', e => {
    if (e.target.getAttribute('data-campo') === 'classe') {
      e.target.closest('.recebimento').querySelector('[data-campo-prazo]').hidden = e.target.value !== 'dataFixa';
    }
  });

  $('recebimentos').addEventListener('click', e => {
    if (e.target.getAttribute('data-acao') !== 'receber') return;
    const cartao = e.target.closest('.recebimento');
    const agId = e.target.getAttribute('data-ag');
    const classe = cartao.querySelector('[data-campo="classe"]').value;
    const prazoValor = cartao.querySelector('[data-campo="prazo"]').value;

    if (classe === 'dataFixa') {
      if (!prazoValor) { toast('Informe o prazo combinado para a classe Data Fixa.', 'erro'); return; }
      if (new Date(prazoValor) <= new Date()) { toast('O prazo precisa estar no futuro.', 'erro'); return; }
    }

    const ags = DB.ler(CHAVES.agendamentos, []);
    const ag = ags.find(a => a.id === agId);
    if (!ag || ag.osId) return;

    const lista = OS.todas();
    const urgentesAtivos = lista.filter(o => o.classe === 'urgente' && o.coluna < 6).length;

    const agora = new Date().toISOString();
    const os = {
      id: OS.proximoId(),
      cliente: ag.cliente, marca: ag.marca, modelo: ag.modelo, defeito: ag.defeito,
      classe, dataLimite: classe === 'dataFixa' ? new Date(prazoValor).toISOString() : null,
      coluna: 1, etiqueta: null, tecnico: null,
      criadaEm: agora, entradaColunaEm: agora, historico: []
    };
    OS.registrarHistorico(os, 'Recebimento confirmado. OS criada em Recebido / Triagem', usuario.nome);
    lista.push(os);
    OS.salvarTodas(lista);

    ag.osId = os.id;
    DB.gravar(CHAVES.agendamentos, ags);

    if (classe === 'urgente' && urgentesAtivos >= 1) {
      toast(`${os.id} criada. Atenção: já existe ${urgentesAtivos} chamado(s) Urgente ativo(s). O recomendado é 1 por técnico.`, 'alerta');
    } else {
      toast(`${os.id} criada em Recebido / Triagem.`);
    }
    render();
  });

  /* ---------- Cliques nos cartões ---------- */
  $('quadro').addEventListener('click', e => {
    const acao = e.target.getAttribute('data-acao');
    const id = e.target.getAttribute('data-id');
    if (!acao || !id) return;
    const os = OS.buscar(id);
    if (!os) return;

    if (acao === 'avancar') moverOS(id, os.coluna + 1);
    if (acao === 'reprovar') moverOS(id, 4);
    if (acao === 'historico') abrirHistorico(os);
    if (acao === 'orcamento') abrirOrcamento(os);
  });

  /* ---------- Arrastar e soltar (HTML5 Drag and Drop) ---------- */
  function limparMarcas() {
    document.querySelectorAll('.coluna').forEach(c => c.classList.remove('alvo-valido', 'alvo-invalido'));
    document.querySelectorAll('.cartao.arrastando').forEach(c => c.classList.remove('arrastando'));
  }

  $('quadro').addEventListener('dragstart', e => {
    const cartao = e.target.closest('.cartao');
    if (!cartao) return;
    arrastandoId = cartao.getAttribute('data-id');
    e.dataTransfer.setData('text/plain', arrastandoId);
    e.dataTransfer.effectAllowed = 'move';
    cartao.classList.add('arrastando');

    // Mostra onde o cartão pode (verde) e não pode (vermelho) cair
    const lista = OS.todas();
    const os = lista.find(o => o.id === arrastandoId);
    document.querySelectorAll('.coluna').forEach(colEl => {
      const destino = Number(colEl.getAttribute('data-col'));
      if (destino === os.coluna) return;
      const opts = (os.coluna === 2 && destino === 3) ? { orcamento: true } : {};
      colEl.classList.add(podeMover(os, destino, lista, opts).ok ? 'alvo-valido' : 'alvo-invalido');
    });
  });

  $('quadro').addEventListener('dragend', () => { arrastandoId = null; limparMarcas(); });

  $('quadro').addEventListener('dragover', e => {
    if (arrastandoId && e.target.closest('.coluna')) e.preventDefault();
  });

  $('quadro').addEventListener('drop', e => {
    const colEl = e.target.closest('.coluna');
    if (!colEl || !arrastandoId) return;
    e.preventDefault();
    const id = arrastandoId;
    arrastandoId = null;
    limparMarcas();
    const destino = Number(colEl.getAttribute('data-col'));
    const os = OS.buscar(id);
    if (os && destino !== os.coluna) moverOS(id, destino);
  });


  /* ---------- Orçamento (História 3) ---------- */
  let orcOsId = null;

  function linhaItem(item = { descricao: '', quantidade: 1, valorUnit: '' }) {
    return `<div class="item-orc">
      <input type="text" data-f="descricao" placeholder="Peça ou serviço" aria-label="Descrição" value="${Fmt.escapar(item.descricao)}">
      <input type="number" data-f="quantidade" min="1" step="1" aria-label="Quantidade" value="${item.quantidade}">
      <input type="number" data-f="valorUnit" min="0.01" step="0.01" aria-label="Valor unitário (R$)" placeholder="R$ unit." value="${item.valorUnit}">
      <button class="btn-mini alerta" type="button" data-remover aria-label="Remover item">✕</button>
    </div>`;
  }

  function lerItens() {
    return [...document.querySelectorAll('#orcItens .item-orc')].map(l => ({
      descricao: l.querySelector('[data-f=descricao]').value.trim(),
      quantidade: Number(l.querySelector('[data-f=quantidade]').value),
      valorUnit: Number(l.querySelector('[data-f=valorUnit]').value)
    }));
  }

  function atualizarTotalOrc() {
    const itens = lerItens().filter(i => i.quantidade > 0 && i.valorUnit > 0);
    $('orcTotal').textContent = Fmt.dinheiro(Orc.calcularTotal(itens));
  }

  function erroOrc(campo, texto) { $('erro-' + campo).textContent = texto || ''; }

  function abrirOrcamento(os) {
    orcOsId = os.id;
    const anterior = orcamentoAtualFresco(os.id);
    $('orcTitulo').textContent = `${anterior ? 'Novo orçamento' : 'Enviar orçamento'} · ${os.id} · ${os.marca} ${os.modelo}`;

    const nota = $('orcNota');
    if (anterior) {
      nota.textContent = `O orçamento v${anterior.versao} (${Fmt.dinheiro(anterior.valorTotal)}) será substituído. A validade de ${VALIDADE_ORCAMENTO_DIAS} dias recomeça a contar a partir do envio.`;
      nota.hidden = false;
    } else {
      nota.hidden = true;
    }

    $('orcDiag').value = os.diagnostico || '';
    $('orcPrazo').value = anterior ? anterior.prazo : 3;
    const itens = anterior ? anterior.itens : [{ descricao: '', quantidade: 1, valorUnit: '' }];
    $('orcItens').innerHTML = itens.map(linhaItem).join('');
    ['orcDiag', 'orcItens', 'orcPrazo'].forEach(c => erroOrc(c, ''));
    atualizarTotalOrc();

    $('modalOrcFundo').classList.add('aberto');
    $('modalOrcFundo').setAttribute('aria-hidden', 'false');
    $('orcDiag').focus();
  }

  function orcamentoAtualFresco(osId) { return Orc.atual(osId); }

  function fecharOrcamento() {
    $('modalOrcFundo').classList.remove('aberto');
    $('modalOrcFundo').setAttribute('aria-hidden', 'true');
    orcOsId = null;
  }

  $('orcAddItem').addEventListener('click', () => {
    $('orcItens').insertAdjacentHTML('beforeend', linhaItem());
    $('orcItens').lastElementChild.querySelector('input').focus();
  });
  $('orcItens').addEventListener('input', atualizarTotalOrc);
  $('orcItens').addEventListener('click', e => {
    if (!e.target.hasAttribute('data-remover')) return;
    e.target.closest('.item-orc').remove();
    atualizarTotalOrc();
  });
  $('orcCancelar').addEventListener('click', fecharOrcamento);
  $('modalOrcFundo').addEventListener('click', e => { if (e.target === $('modalOrcFundo')) fecharOrcamento(); });

  $('formOrc').addEventListener('submit', e => {
    e.preventDefault();
    const diag = $('orcDiag').value.trim();
    const itens = lerItens();
    const prazo = Number($('orcPrazo').value);

    const diagOk = diag.length >= 5;
    const itensOk = itens.length > 0 && itens.every(i => i.descricao && Number.isInteger(i.quantidade) && i.quantidade >= 1 && i.valorUnit > 0);
    const prazoOk = Number.isInteger(prazo) && prazo >= 1;

    erroOrc('orcDiag', diagOk ? '' : 'Registre o diagnóstico (mínimo de 5 caracteres) antes de enviar o orçamento.');
    erroOrc('orcItens', itensOk ? '' : (itens.length ? 'Preencha descrição, quantidade (inteira) e valor maior que zero em todos os itens.' : 'Adicione pelo menos um item.'));
    erroOrc('orcPrazo', prazoOk ? '' : 'Informe o prazo em dias úteis (mínimo 1).');
    if (!diagOk || !itensOk || !prazoOk) return;

    const lista = OS.todas();
    const os = lista.find(o => o.id === orcOsId);
    if (!os) return;
    const orcs = Orc.todos();
    const doOS = orcs.filter(o => o.osId === os.id);
    const versao = doOS.length + 1;

    // Qualquer orçamento anterior ainda em aberto deixa de valer
    doOS.forEach(o => { if (o.status === 'enviado' || o.status === 'expirado') o.status = 'substituido'; });

    const novo = {
      id: Orc.proximoId(), osId: os.id, versao,
      diagnostico: diag, itens, valorTotal: Orc.calcularTotal(itens), prazo,
      dataEnvio: new Date().toISOString(), status: 'enviado', decisao: null
    };
    orcs.push(novo);

    os.diagnostico = diag;
    OS.registrarHistorico(os, `Diagnóstico registrado: ${diag}`, usuario.nome);
    OS.registrarHistorico(os, `Orçamento ${novo.id} (v${versao}) enviado: ${Fmt.dinheiro(novo.valorTotal)}, prazo de ${prazo} dia(s) útil(eis)`, usuario.nome);

    if (os.coluna === 2) {
      const r = podeMover(os, 3, lista, { orcamento: true });
      if (!r.ok) { toast(r.motivo, 'erro'); return; }
      const origem = os.coluna;
      os.coluna = 3;
      os.entradaColunaEm = new Date().toISOString();
      OS.registrarHistorico(os, `Movida de "${getColuna(origem).nome}" para "${getColuna(3).nome}"`, usuario.nome);
    }

    Orc.salvarTodos(orcs);
    OS.salvarTodas(lista);
    fecharOrcamento();
    toast(`Orçamento ${novo.id} enviado para ${os.cliente}: ${Fmt.dinheiro(novo.valorTotal)}.`);
    render();
  });

  /* ---------- Modal de histórico ---------- */
  function abrirHistorico(os) {
    $('modalTitulo').textContent = `${os.id} · ${os.marca} ${os.modelo}`;
    $('modalCorpo').innerHTML = `<ul class="linha-tempo">${
      [...os.historico].reverse().map(h =>
        `<li><span class="quando">${h.data} ${h.hora}</span> · ${Fmt.escapar(h.acao)} <em>(${Fmt.escapar(h.autor)})</em></li>`
      ).join('')}</ul>`;
    $('modalFundo').classList.add('aberto');
    $('modalFundo').setAttribute('aria-hidden', 'false');
    $('modalFechar').focus();
  }
  function fecharModal() {
    $('modalFundo').classList.remove('aberto');
    $('modalFundo').setAttribute('aria-hidden', 'true');
  }
  $('modalFechar').addEventListener('click', fecharModal);
  $('modalFundo').addEventListener('click', e => { if (e.target === $('modalFundo')) fecharModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { fecharModal(); fecharOrcamento(); } });

  /* ---------- Início ---------- */
  function render() {
    renderRecebimentos();
    renderQuadro();
  }
  render();
})();