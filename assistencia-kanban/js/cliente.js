/* =========================================================
   cliente.js — História 1: agendar conserto e acompanhar status
   ========================================================= */
(function () {
  const usuario = Auth.exigirPerfil(['cliente']);
  if (!usuario) return;
  garantirDados();

  const $ = id => document.getElementById(id);
  const HORAS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
  const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  $('quem').textContent = usuario.nome + ' · Cliente';
  $('btnSair').addEventListener('click', () => { Auth.sair(); window.location.href = 'index.html'; });

  /* ---------- Datas ---------- */
  function chaveData(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dia}`;
  }
  function proximosDiasUteis(qtd) {
    const dias = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    while (dias.length < qtd) {
      if (d.getDay() !== 0 && d.getDay() !== 6) dias.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dias;
  }
  function rotuloDia(d) {
    return `${DIAS_SEMANA[d.getDay()]}, ${d.toLocaleDateString('pt-BR')}`;
  }
  function formatarChave(chave) {
    const [a, m, d] = chave.split('-');
    return `${d}/${m}/${a}`;
  }

  /* ---------- Agendamentos ---------- */
  function agendamentos() { return DB.ler(CHAVES.agendamentos, []); }

  // Ocupa alguns horários com "outros clientes" para demonstrar o bloqueio
  function semearHorariosOcupados() {
    const ags = agendamentos();
    if (ags.some(a => a.cliente === 'Outro cliente')) return;
    proximosDiasUteis(7).forEach((d, i) => {
      [(i * 2) % HORAS.length, (i * 2 + 3) % HORAS.length].forEach(idx => {
        ags.push({
          id: 'AG-' + (1000 + ags.length + 1), cliente: 'Outro cliente',
          marca: '-', modelo: '-', defeito: '-', data: chaveData(d), hora: HORAS[idx],
          criadoEm: new Date().toISOString(), osId: null
        });
      });
    });
    DB.gravar(CHAVES.agendamentos, ags);
  }

  function horarioOcupado(data, hora) {
    return agendamentos().some(a => a.data === data && a.hora === hora);
  }
  function horarioPassou(data, hora) {
    const [h, m] = hora.split(':').map(Number);
    const [a, mes, d] = data.split('-').map(Number);
    return new Date(a, mes - 1, d, h, m) <= new Date();
  }

  function preencherDias() {
    $('data').innerHTML = proximosDiasUteis(7)
      .map(d => `<option value="${chaveData(d)}">${rotuloDia(d)}</option>`).join('');
  }

  function renderHorarios() {
    const data = $('data').value;
    $('horarios').innerHTML = HORAS.map((h, i) => {
      const ocupado = horarioOcupado(data, h);
      const passou = horarioPassou(data, h);
      const bloqueado = ocupado || passou;
      return `<input type="radio" name="hora" id="h${i}" value="${h}" ${bloqueado ? 'disabled' : ''}>
              <label for="h${i}">${h}<small>${ocupado ? 'sem vaga' : passou ? 'encerrado' : 'livre'}</small></label>`;
    }).join('');
  }

  /* ---------- Validação ---------- */
  function mostrarErro(campo, texto) {
    $('erro-' + campo).textContent = texto || '';
    const el = $(campo);
    if (el) el.classList.toggle('invalido', !!texto);
  }

  function validar() {
    let ok = true;
    const marca = $('marca').value.trim();
    const modelo = $('modelo').value.trim();
    const defeito = $('defeito').value.trim();
    const hora = document.querySelector('input[name="hora"]:checked');

    mostrarErro('marca', marca ? '' : 'Informe a marca do aparelho.');
    mostrarErro('modelo', modelo ? '' : 'Informe o modelo do aparelho.');
    mostrarErro('defeito', defeito.length >= 5 ? '' : 'Descreva o defeito (mínimo de 5 caracteres).');
    mostrarErro('hora', hora ? '' : 'Escolha um horário com vaga.');

    if (!marca || !modelo || defeito.length < 5 || !hora) ok = false;
    return ok ? { marca, modelo, defeito, data: $('data').value, hora: hora.value } : null;
  }

  $('formAgendar').addEventListener('submit', e => {
    e.preventDefault();
    $('msgSucesso').hidden = true;
    const dados = validar();
    if (!dados) return;

    // Reconfere a vaga na hora de salvar
    if (horarioOcupado(dados.data, dados.hora) || horarioPassou(dados.data, dados.hora)) {
      mostrarErro('hora', 'Esse horário acabou de ficar sem vaga. Escolha outro.');
      renderHorarios();
      return;
    }

    const ags = agendamentos();
    const novo = {
      id: 'AG-' + (1000 + ags.length + 1),
      cliente: usuario.nome,
      ...dados,
      criadoEm: new Date().toISOString(),
      osId: null
    };
    ags.push(novo);
    DB.gravar(CHAVES.agendamentos, ags);

    $('msgSucesso').textContent =
      `Agendamento ${novo.id} confirmado para ${formatarChave(novo.data)} às ${novo.hora}. Leve o aparelho nesse horário.`;
    $('msgSucesso').hidden = false;
    $('formAgendar').reset();
    ['marca', 'modelo', 'defeito', 'hora'].forEach(c => mostrarErro(c, ''));
    renderHorarios();
    renderAgendamentos();
  });

  $('data').addEventListener('change', renderHorarios);

  /* ---------- Meus agendamentos ---------- */
  function renderAgendamentos() {
    const meus = agendamentos().filter(a => a.cliente === usuario.nome)
      .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));

    if (!meus.length) {
      $('listaAgs').innerHTML = '<p class="vazio">Você ainda não tem agendamentos. Preencha o formulário ao lado.</p>';
      return;
    }
    $('listaAgs').innerHTML = `<div class="tabela-wrap"><table>
      <thead><tr><th>Quando</th><th>Aparelho</th><th>Situação</th></tr></thead>
      <tbody>${meus.map(a => `<tr>
        <td class="mono">${formatarChave(a.data)} ${a.hora}</td>
        <td>${Fmt.escapar(a.marca)} ${Fmt.escapar(a.modelo)}</td>
        <td>${a.osId
          ? `<span class="tag padrao">Recebido · ${Fmt.escapar(a.osId)}</span>`
          : 'Aguardando o aparelho chegar na loja'}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  /* ---------- Acompanhamento ---------- */
  function renderOS() {
    const filtro = $('codigo').value.trim();
    const digitos = filtro.replace(/\D/g, '');
    let minhas = OS.todas().filter(o => o.cliente === usuario.nome);   // o cliente só vê as próprias OS
    const total = minhas.length;
    if (filtro) minhas = minhas.filter(o => o.id.replace(/\D/g, '') === digitos);

    if (!minhas.length) {
      $('listaOS').innerHTML = total
        ? `<p class="vazio">Nenhuma OS sua com o código "${Fmt.escapar(filtro)}".</p>`
        : '<p class="vazio">Você ainda não tem ordens de serviço. Depois que o técnico receber seu aparelho, a OS aparece aqui.</p>';
      return;
    }

    minhas.sort((a, b) => b.id.localeCompare(a.id));
    $('listaOS').innerHTML = minhas.map(o => {
      const etapas = COLUNAS.map(c => {
        const cls = c.id < o.coluna ? 'feita' : c.id === o.coluna ? 'atual' : '';
        return `<li class="${cls}">${c.nome}</li>`;
      }).join('');
      const hist = o.historico.map(h =>
        `<li><span class="quando">${h.data} ${h.hora}</span> · ${Fmt.escapar(h.acao)} <em>(${Fmt.escapar(h.autor)})</em></li>`
      ).join('');
      return `<article class="os-card">
        <header>
          <span class="os-id">${Fmt.escapar(o.id)}</span>
          <span>${Fmt.escapar(o.marca)} ${Fmt.escapar(o.modelo)}
            ${o.etiqueta ? `<span class="tag sem-conserto">${Fmt.escapar(o.etiqueta)}</span>` : ''}</span>
        </header>
        <div>Defeito: ${Fmt.escapar(o.defeito)}</div>
        <div style="margin-top:.25rem">Etapa atual: <strong>${getColuna(o.coluna).nome}</strong></div>
        <ol class="etapas" aria-label="Etapas do conserto">${etapas}</ol>
        ${htmlOrcamento(o)}
        <details style="margin-top:.75rem"><summary>Histórico (${o.historico.length})</summary><ul class="linha-tempo">${hist}</ul></details>
      </article>`;
    }).join('');
  }


  /* ---------- Orçamento ---------- */
  const ROTULO_ORC = {
    enviado: 'Aguardando sua decisão', aprovado: 'Aprovado', recusado: 'Recusado', expirado: 'Expirado'
  };

  function htmlOrcamento(os) {
    const orc = Orc.atual(os.id);
    if (!orc) return '';
    const linhas = orc.itens.map(i => `<tr>
      <td>${Fmt.escapar(i.descricao)}</td>
      <td class="num">${i.quantidade}</td>
      <td class="num">${Fmt.dinheiro(i.valorUnit)}</td>
      <td class="num">${Fmt.dinheiro(i.quantidade * i.valorUnit)}</td></tr>`).join('');

    const pendente = orc.status === 'enviado' && os.coluna === 3;
    let rodape = '';
    if (orc.status === 'enviado') rodape = `Válido até <strong>${Fmt.dataHora(Orc.venceEm(orc))}</strong>.`;
    if (orc.status === 'expirado') rodape = 'Este orçamento passou de 5 dias e não pode mais ser aprovado. Aguarde o técnico enviar um novo.';
    if ((orc.status === 'aprovado' || orc.status === 'recusado') && orc.decisao)
      rodape = `${orc.status === 'aprovado' ? 'Aprovado' : 'Recusado'} por ${Fmt.escapar(orc.decisao.usuario)} em ${orc.decisao.data} às ${orc.decisao.hora}.`;

    return `<div class="orcamento ${orc.status}">
      <h3>Orçamento v${orc.versao} <span class="tag ${orc.status}">${ROTULO_ORC[orc.status] || orc.status}</span></h3>
      <div>Diagnóstico: ${Fmt.escapar(orc.diagnostico)}</div>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Peça / serviço</th><th class="num">Qtd</th><th class="num">Unitário</th><th class="num">Subtotal</th></tr></thead>
        <tbody>${linhas}</tbody>
        <tfoot><tr><th colspan="3">Total</th><th class="num">${Fmt.dinheiro(orc.valorTotal)}</th></tr></tfoot>
      </table></div>
      <div>Prazo do conserto: <strong>${orc.prazo} dia(s) útil(eis)</strong></div>
      <div style="margin-top:.25rem">${rodape}</div>
      ${pendente ? `<div class="acoes-orc">
        <button class="btn" type="button" data-orc="aprovar" data-os="${os.id}">Aprovar orçamento</button>
        <button class="btn perigo" type="button" data-orc="recusar" data-os="${os.id}">Recusar</button>
      </div>` : ''}
    </div>`;
  }

  let timerToast = null;
  function toast(msg, tipo = 'ok') {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast ' + (tipo === 'ok' ? '' : tipo);
    el.hidden = false;
    clearTimeout(timerToast);
    timerToast = setTimeout(() => { el.hidden = true; }, 6000);
  }

  let decisaoPendente = null;   // { osId, tipo }
  function abrirConfirmacao(osId, tipo) {
    const os = OS.buscar(osId);
    const orc = Orc.atual(osId);
    if (!os || !orc) return;
    decisaoPendente = { osId, tipo };
    const aprovar = tipo === 'aprovar';
    $('modalTitulo').textContent = aprovar ? 'Aprovar este orçamento?' : 'Recusar este orçamento?';
    $('modalTexto').textContent = aprovar
      ? `Você autoriza o conserto de ${os.marca} ${os.modelo} por ${Fmt.dinheiro(orc.valorTotal)}. O aparelho segue para Em Conserto.`
      : `O aparelho ${os.marca} ${os.modelo} será devolvido sem conserto. Essa decisão não pode ser desfeita.`;
    $('modalConfirmar').textContent = aprovar ? 'Sim, aprovar' : 'Sim, recusar';
    $('modalConfirmar').className = 'btn' + (aprovar ? '' : ' perigo');
    $('modalFundo').classList.add('aberto');
    $('modalFundo').setAttribute('aria-hidden', 'false');
    $('modalCancelar').focus();
  }
  function fecharConfirmacao() {
    decisaoPendente = null;
    $('modalFundo').classList.remove('aberto');
    $('modalFundo').setAttribute('aria-hidden', 'true');
  }

  function decidir() {
    if (!decisaoPendente) return;
    const { osId, tipo } = decisaoPendente;
    fecharConfirmacao();

    Orc.atualizarExpiracoes();   // revalida a validade no momento da decisão
    const lista = OS.todas();
    const os = lista.find(o => o.id === osId);
    const orcs = Orc.todos();
    const doOS = orcs.filter(o => o.osId === osId);
    const orc = doOS[doOS.length - 1];

    if (!os || os.cliente !== usuario.nome) return;           // só mexe nas próprias OS
    if (!orc || orc.status !== 'enviado' || os.coluna !== 3) {
      toast('Este orçamento não está mais disponível (expirou ou foi substituído).', 'erro');
      renderOS();
      return;
    }

    const aprovar = tipo === 'aprovar';
    const destino = aprovar ? 4 : 6;
    const r = podeMover(os, destino, lista, aprovar ? { aprovacao: true } : { recusa: true });
    if (!r.ok) {
      toast('Não foi possível aprovar agora. ' + r.motivo + ' Tente novamente mais tarde.', 'erro');
      return;
    }

    const agora = new Date();
    orc.status = aprovar ? 'aprovado' : 'recusado';
    orc.decisao = {
      data: agora.toLocaleDateString('pt-BR'),
      hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      usuario: usuario.nome,
      iso: agora.toISOString()
    };

    const origem = os.coluna;
    os.coluna = destino;
    os.entradaColunaEm = agora.toISOString();
    if (!aprovar) os.etiqueta = ETIQUETA_SEM_CONSERTO;

    OS.registrarHistorico(os, `Orçamento ${orc.id} ${aprovar ? 'aprovado' : 'recusado'} pelo cliente (${Fmt.dinheiro(orc.valorTotal)})`, usuario.nome);
    OS.registrarHistorico(os,
      `Movida de "${getColuna(origem).nome}" para "${getColuna(destino).nome}"` + (aprovar ? '' : ` · ${ETIQUETA_SEM_CONSERTO}`),
      usuario.nome);

    Orc.salvarTodos(orcs);
    OS.salvarTodas(lista);
    toast(aprovar ? `Orçamento aprovado. ${os.id} segue para Em Conserto.` : `Orçamento recusado. ${os.id} será devolvido sem conserto.`);
    renderOS();
  }

  $('listaOS').addEventListener('click', e => {
    const tipo = e.target.getAttribute('data-orc');
    if (tipo) abrirConfirmacao(e.target.getAttribute('data-os'), tipo);
  });
  $('modalCancelar').addEventListener('click', fecharConfirmacao);
  $('modalConfirmar').addEventListener('click', decidir);
  $('modalFundo').addEventListener('click', e => { if (e.target === $('modalFundo')) fecharConfirmacao(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharConfirmacao(); });

  $('formBusca').addEventListener('submit', e => { e.preventDefault(); renderOS(); });
  $('btnLimpar').addEventListener('click', () => { $('codigo').value = ''; renderOS(); });

  /* ---------- Início ---------- */
  semearHorariosOcupados();
  preencherDias();
  renderHorarios();
  renderAgendamentos();
  renderOS();
})();