/* =========================================================
   app.js — localStorage, autenticação simulada e utilitários
   Depende de status.js (carregue status.js ANTES deste arquivo)
   ========================================================= */

const CHAVES = {
  usuario: 'usuario_logado',
  agendamentos: 'agendamentos',
  ordens: 'ordens_servico',
  orcamentos: 'orcamentos'
};

/* ---------- Acesso ao localStorage ---------- */
const DB = {
  ler(chave, padrao = []) {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : padrao;
    } catch (e) {
      console.warn('Falha ao ler', chave, e);
      return padrao;
    }
  },
  gravar(chave, valor) {
    localStorage.setItem(chave, JSON.stringify(valor));
  },
  remover(chave) {
    localStorage.removeItem(chave);
  }
};

/* ---------- Autenticação simulada ---------- */
const Auth = {
  usuario() {
    return DB.ler(CHAVES.usuario, null);
  },
  entrar(nome, perfil) {
    DB.gravar(CHAVES.usuario, { nome: nome.trim(), perfil });
  },
  sair() {
    DB.remover(CHAVES.usuario);
  },
  /** Use no topo das páginas protegidas. Redireciona se o perfil não confere. */
  exigirPerfil(perfisPermitidos) {
    const u = this.usuario();
    if (!u || !perfisPermitidos.includes(u.perfil)) {
      sessionStorage.setItem('acesso_negado', '1');
      window.location.href = 'index.html';
      return null;
    }
    return u;
  }
};

/* ---------- Ordens de serviço ---------- */
const OS = {
  todas() {
    return DB.ler(CHAVES.ordens, []);
  },
  salvarTodas(lista) {
    DB.gravar(CHAVES.ordens, lista);
  },
  buscar(id) {
    return this.todas().find(o => o.id === id);
  },
  proximoId() {
    const nums = this.todas().map(o => parseInt(o.id.replace('#OS-', ''), 10));
    return '#OS-' + (nums.length ? Math.max(...nums) + 1 : 1001);
  },
  /** Registra uma entrada na trilha de auditoria da OS (mutação em memória). */
  registrarHistorico(os, acao, autor) {
    const agora = new Date();
    os.historico.push({
      data: agora.toLocaleDateString('pt-BR'),
      hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      autor: autor || (Auth.usuario() ? Auth.usuario().nome : 'Sistema'),
      acao,
      iso: agora.toISOString()
    });
  }
};

/* ---------- Dados de exemplo (seed) ---------- */
function diasAtras(n, horas = 0) {
  return new Date(Date.now() - n * 86400000 - horas * 3600000).toISOString();
}
function emHoras(h) {
  return new Date(Date.now() + h * 3600000).toISOString();
}

function criarOSSeed(num, cliente, marca, modelo, defeito, classe, coluna, diasNaColuna, extra = {}) {
  const entrada = diasAtras(diasNaColuna);
  const os = {
    id: '#OS-' + num,
    cliente, marca, modelo, defeito, classe, coluna,
    dataLimite: extra.dataLimite || null,
    etiqueta: extra.etiqueta || null,
    tecnico: coluna >= 2 ? 'Marina' : null,
    criadaEm: diasAtras(diasNaColuna + 2),
    entradaColunaEm: entrada,
    historico: [
      { data: new Date(diasAtras(diasNaColuna + 2)).toLocaleDateString('pt-BR'), hora: '09:00', autor: 'Marina', acao: 'OS criada em Recebido / Triagem', iso: diasAtras(diasNaColuna + 2) }
    ]
  };
  if (coluna > 1) {
    os.historico.push({
      data: new Date(entrada).toLocaleDateString('pt-BR'), hora: '14:30', autor: 'Marina',
      acao: `Movida para ${getColuna(coluna).nome}`, iso: entrada
    });
  }
  return os;
}

function gerarDadosExemplo() {
  const o = criarOSSeed;
  const lista = [
    o(1001, 'Carlos', 'Samsung', 'Galaxy A54', 'Tela trincada', 'padrao', 1, 0),
    o(1002, 'Ana Souza', 'Apple', 'iPhone 11', 'Bateria não carrega', 'dataFixa', 1, 0, { dataLimite: emHoras(12) }),
    o(1003, 'Carlos', 'Motorola', 'Moto G32', 'Não liga', 'padrao', 2, 5),
    o(1004, 'Bruno Lima', 'Xiaomi', 'Redmi Note 12', 'Sem áudio', 'urgente', 2, 1),
    o(1005, 'Carlos', 'Apple', 'iPhone 13', 'Câmera embaçada', 'padrao', 3, 1),
    o(1006, 'Julia Reis', 'Samsung', 'Galaxy S21', 'Molhou', 'dataFixa', 4, 2, { dataLimite: emHoras(72) }),
    o(1007, 'Pedro Alves', 'Motorola', 'Edge 30', 'Botão power', 'padrao', 4, 1),
    o(1008, 'Carlos', 'Xiaomi', 'Poco X5', 'Touch falhando', 'padrao', 4, 1),
    o(1009, 'Lia Santos', 'Samsung', 'Galaxy A32', 'Tela trincada', 'padrao', 5, 1),
    o(1010, 'Rafa Dias', 'Apple', 'iPhone 12', 'Face ID', 'dataFixa', 5, 1, { dataLimite: emHoras(30) }),
    o(1011, 'Marta Cruz', 'Motorola', 'Moto E22', 'Bateria viciada', 'padrao', 5, 0),
    o(1012, 'Carlos', 'Samsung', 'Galaxy J7', 'Conector de carga', 'padrao', 6, 1)
  ];
  OS.salvarTodas(lista);
  DB.gravar(CHAVES.agendamentos, []);
  DB.gravar(CHAVES.orcamentos, []);
}

function garantirDados() {
  if (!localStorage.getItem(CHAVES.ordens)) gerarDadosExemplo();
  Orc.semearSeFaltar();
  Orc.atualizarExpiracoes();   // checa a validade dos orçamentos ao abrir qualquer página
}

function resetarTudo() {
  Object.values(CHAVES).forEach(c => localStorage.removeItem(c));
  gerarDadosExemplo();
}

/* ---------- Utilitários de formatação ---------- */
const Fmt = {
  dinheiro(v) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
  dataHora(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },
  escapar(txt) {
    const d = document.createElement('div');
    d.textContent = txt == null ? '' : String(txt);
    return d.innerHTML;
  }
};

/* ---------- Orçamentos (História 3) ---------- */
const Orc = {
  todos() { return DB.ler(CHAVES.orcamentos, []); },
  salvarTodos(lista) { DB.gravar(CHAVES.orcamentos, lista); },
  daOS(osId) { return this.todos().filter(o => o.osId === osId).sort((a, b) => a.versao - b.versao); },
  atual(osId) { const l = this.daOS(osId); return l.length ? l[l.length - 1] : null; },
  proximoId() { return 'ORC-' + (1001 + this.todos().length); },

  calcularTotal(itens) {
    const total = itens.reduce((soma, i) => soma + Number(i.quantidade) * Number(i.valorUnit), 0);
    return Math.round(total * 100) / 100;
  },
  venceEm(orc) {
    return new Date(new Date(orc.dataEnvio).getTime() + VALIDADE_ORCAMENTO_DIAS * 86400000);
  },
  /** Só orçamentos ainda pendentes ("enviado") podem expirar. */
  expirado(orc, agora = new Date()) {
    return orc.status === 'enviado' && agora > this.venceEm(orc);
  },
  /** Marca como "expirado" os orçamentos vencidos e registra no histórico da OS. */
  atualizarExpiracoes() {
    const orcs = this.todos();
    const vencidos = orcs.filter(o => this.expirado(o));
    if (!vencidos.length) return;
    const lista = OS.todas();
    vencidos.forEach(o => {
      o.status = 'expirado';
      const os = lista.find(x => x.id === o.osId);
      if (os) OS.registrarHistorico(os, `Orçamento ${o.id} expirou (${VALIDADE_ORCAMENTO_DIAS} dias sem resposta do cliente)`, 'Sistema');
    });
    this.salvarTodos(orcs);
    OS.salvarTodas(lista);
  },
  /** Dados de exemplo: toda OS em Aguardando Aprovação precisa ter um orçamento. */
  semearSeFaltar() {
    const lista = OS.todas();
    const orcs = this.todos();
    let mudou = false;
    lista.filter(o => o.coluna === 3 && !orcs.some(q => q.osId === o.id)).forEach(os => {
      const itens = [
        { descricao: 'Módulo da câmera', quantidade: 1, valorUnit: 480 },
        { descricao: 'Mão de obra', quantidade: 1, valorUnit: 120 }
      ];
      os.diagnostico = os.diagnostico || 'Módulo da câmera com umidade interna.';
      orcs.push({
        id: 'ORC-' + (1001 + orcs.length), osId: os.id, versao: 1,
        diagnostico: os.diagnostico, itens, valorTotal: this.calcularTotal(itens), prazo: 3,
        dataEnvio: diasAtras(1), status: 'enviado', decisao: null
      });
      mudou = true;
    });
    if (mudou) { this.salvarTodos(orcs); OS.salvarTodas(lista); }
  }
};