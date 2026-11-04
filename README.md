# 📱 Plataforma Web de Gestão para Assistência Técnica de Celulares

Projeto desenvolvido para digitalizar, organizar e dar transparência ao fluxo de conserto de celulares de ponta a ponta — desde o agendamento e entrada do aparelho até a aprovação de orçamento, controle de qualidade, pagamento e análise de métricas gerenciais.

O sistema aplica na prática os conceitos do método **Kanban** (visualização do fluxo, Limites de WIP, Políticas Explícitas de transição e Classes de Serviço) utilizando tecnologias web nativas.

---

## 🚀 Como Executar o Projeto (Guia para o Professor)

O projeto foi construído em **HTML5, CSS3 e JavaScript Puro (Vanilla JS)**, utilizando o `localStorage` do navegador como banco de dados persistente. Não é necessário instalar dependências (Node.js, banco de dados externo ou bibliotecas).

### Passo a Passo para Abrir:
1. Extraia o arquivo `.zip` do projeto em uma pasta no seu computador.
2. Abra a pasta `Etapa 5/`.
3. Dê um duplo clique no arquivo **`index.html`** para abri-lo em qualquer navegador moderno (Google Chrome, Mozilla Firefox ou Microsoft Edge).
   * *Dica opcional:* Caso utilize o VS Code, também pode executá-lo através da extensão *Live Server*.

---

## 👥 Perfis de Acesso e Como Testar o Fluxo

Na tela inicial (`index.html`), você pode escolher com qual perfil deseja acessar a plataforma (ou alternar entre os perfis para simular a jornada completa de uma Ordem de Serviço):

| Perfil | Arquivo Principal | O que este perfil faz no sistema? |
| :--- | :--- | :--- |
| **1. Cliente** | `cliente.html` | Agenda horários disponíveis, consulta suas próprias OS, aprova/recusa orçamentos online, realiza o pagamento simulado e visualiza a OS finalizada. |
| **2. Técnico** | `tecnico.html` | Recebe aparelhos (gera OS), movimenta os cards no quadro Kanban (*Drag & Drop* / botões), registra diagnósticos, envia orçamentos e preenche o checklist de testes finais. |
| **3. Gestor** | `gestor.html` | Monitora a fila ordenada por Classe de Serviço, acompanha alertas de WIP e prazos em risco, analisa o Tempo Médio de Conserto (*Lead Time*) e filtra o histórico completo. |

> 🔒 **Controle de Acesso:** O sistema valida o usuário logado no `localStorage`. Caso um usuário com perfil de *Cliente* ou *Técnico* tente acessar diretamente a página `gestor.html`, o acesso é bloqueado automaticamente (conforme exigido na História 4).

---

## 🧪 Roteiro de Testes Sugerido para Avaliação (As 4 Histórias)

Para validar rapidamente todos os Critérios de Aceite e Regras de Negócio implementados, sugerimos seguir a ordem abaixo:

### Passo 1: Agendamento pelo Cliente (História 1)
1. Acesse como **Cliente** (`index.html` ➔ `cliente.html`).
2. Preencha o formulário de agendamento informando **Marca**, **Modelo**, **Defeito relatado** e escolha um **horário disponível**.
3. *Validação:* Tente agendar novamente no mesmo horário e observe que o horário sem vaga aparece **bloqueado**.

### Passo 2: Recebimento, Kanban e Limites de WIP (História 2)
1. Alterne o acesso para o perfil **Técnico** (`tecnico.html`).
2. Confirme o recebimento do agendamento para criar a Ordem de Serviço (OS) na coluna **1. Recebido / Triagem** (definindo também a Classe de Serviço: *Urgente*, *Data Fixa* ou *Padrão*).
3. Movimente os cartões pelo quadro Kanban e teste as travas do módulo `js/status.js`:
   * **Regra de Progressão Linear:** Tente pular etapas (ex: arrastar de *Em Diagnóstico* direto para *Pronto*). O sistema bloqueará a ação, permitindo apenas avançar para a coluna imediatamente seguinte (`colunaAtual + 1`).
   * **Exceção de Retorno:** Verifique que a única volta permitida no fluxo técnico é da coluna **5. Testes Finais** de volta para **4. Em Conserto** (caso o aparelho reprove no teste de qualidade).
   * **Trava de Limite WIP:** Tente colocar mais cartões do que o limite permitido nas colunas técnicas (*Em Diagnóstico*: máx. 5 | *Em Conserto*: máx. 4 | *Testes Finais*: máx. 3). O sistema impedirá a entrada de novos cartões quando a coluna atingir sua capacidade máxima.

### Passo 3: Envio e Decisão de Orçamento (História 3)
1. Ainda no painel do **Técnico**, selecione uma OS na coluna **2. Em Diagnóstico**, registre o diagnóstico técnico, adicione as peças/valores e envie o orçamento (validade automática de 5 dias). A OS avançará para **3. Aguardando Aprovação**.
2. Volte para a visão do **Cliente** (`cliente.html`) e localize a OS:
   * **Caminho A (Aprovar):** Clique em **Aprovar Orçamento** e confirme no modal. A OS será movida automaticamente para **4. Em Conserto** e registrará data, hora e autor no histórico.
   * **Caminho B (Recusar):** Em outra OS de teste, clique em **Recusar Orçamento**. A OS pulará as etapas de reparo e irá direto para **6. Pronto / Finalizado** com a etiqueta **"Devolver sem conserto"**.
   * **Caminho C (Expiração):** Orçamentos enviados há mais de 5 dias são identificados automaticamente como **Expirados** ao abrir a página.

### Passo 4: Conclusão do Reparo, Pagamento e Painel do Gestor (Histórias 1 e 4)
1. No painel do **Técnico**, avance uma OS aprovada de *Em Conserto* para *Testes Finais*, conclua a verificação e mova para **6. Pronto / Finalizado** (onde o cliente pode quitar e emitir sua OS final).
2. Acesse o sistema com o perfil **Gestor** (`gestor.html`) e verifique:
   * **Métricas em Tempo Real:** Cálculo automático do **Tempo Médio de Conserto** (da entrada em *Recebido/Triagem* até *Pronto*, considerando as OS concluídas).
   * **Destaques Visuais de Risco:** Identificação clara de colunas no limite/acima de WIP e de Ordens de Serviço com prazo em risco.
   * **Ordenação por Classe de Serviço:** Fila estruturada respeitando a prioridade (*Urgente* ➔ *Data Fixa* ➔ *Padrão*).
   * **Filtros de Histórico:** Utilize os filtros combinados por **Período**, **Técnico** e **Status** para inspecionar os registros e a trilha de auditoria (data, hora e autor de cada movimentação).

---

## 📋 Resumo das Políticas Explícitas do Kanban no Código

### 1. Colunas e Limites de WIP (*Work In Progress*)
| # | Coluna do Fluxo | Limite WIP | Regra Principal de Saída / Transição |
| :-: | :--- | :---: | :--- |
| **1** | **Recebido / Triagem** | Sem limite | Recebimento confirmado pelo técnico + atribuição inicial. |
| **2** | **Em Diagnóstico** | **5** | Diagnóstico preenchido + envio de orçamento com peças, valor e prazo. |
| **3** | **Aguardando Aprovação** | Sem limite | Aprovação do cliente (vai para Coluna 4) ou Recusa (vai para Coluna 6 com tag de devolução). |
| **4** | **Em Conserto** | **4** | Reparo executado na bancada pelo técnico responsável. |
| **5** | **Testes Finais** | **3** | Aprovação nos testes libera para *Pronto* (Coluna 6). Reprovação retorna para *Em Conserto* (Coluna 4). |
| **6** | **Pronto / Finalizado** | Sem limite | Serviço concluído (ou devolução sem reparo), cálculo de métricas e liberação da OS final. |

### 2. Classes de Serviço (Priorização da Fila)
* 🔴 **Urgente (*Expedite*):** Prioridade máxima (1ª). Posicionado no topo da fila para ação imediata.
* 🟡 **Data Fixa (*Fixed Date*):** Prioridade alta (2ª). Possui data limite definida e alerta visual caso o prazo entre em risco.
* 🔵 **Padrão (*Standard*):** Prioridade normal (3ª). Segue ordem de chegada (*FIFO*).

---

## 📂 Estrutura de Pastas e Arquivos

```text
Etapa 5/
├── index.html          # Tela inicial de seleção/autenticação de perfil e visão geral
├── cliente.html        # Interface do Cliente (Agendamento, Acompanhamento e Aprovação de Orçamento)
├── tecnico.html        # Interface do Técnico (Quadro Kanban Drag & Drop, Diagnóstico e Orçamentos)
├── gestor.html         # Interface do Gestor (Dashboard de Métricas, Alertas WIP/Risco e Histórico)
├── css/
│   └── style.css       # Estilização global, layout em CSS Grid, cores das Classes de Serviço e modais
└── js/
    ├── app.js          # Inicialização do localStorage (dados base/seed), sessão de usuário e utilitários
    ├── status.js       # Motor de regras do Kanban: limites de WIP, transições e função podeMover()
    ├── cliente.js      # Lógica de agendamento com bloqueio de vagas, consulta de OS e decisão de orçamento
    ├── tecnico.js      # Lógica do quadro Kanban, Drag & Drop HTML5, criação de orçamento e histórico
    └── gestor.js       # Bloqueio de permissão, cálculo de tempo médio, alertas e Array.filter do histórico
```

---

## 🛠️ Dica para Reiniciar os Dados de Teste (Reset do Banco Local)
Como todas as interações ficam salvas no `localStorage` do navegador (chaves como `agendamentos`, `ordens_servico`, `orcamentos` e `usuario_logado`), caso deseje restaurar o sistema ao seu estado original de fábrica durante a correção:
1. Pressione `F12` no navegador para abrir o *DevTools* (Ferramentas do Desenvolvedor).
2. Vá até a aba **Console** (ou *Application > Local Storage*), digite `localStorage.clear()` e pressione `Enter`.
3. Recarregue a página (`F5`).