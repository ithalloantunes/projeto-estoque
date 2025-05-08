<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Sistema de Estoque – Açaí da Bara</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .hidden { display: none; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    input, button { padding: 6px; margin: 4px; }
    .edit-input { width: 90%; padding: 4px; }
  </style>
</head>
<body>
  <h1>Sistema de Estoque – Açaí da Bara</h1>

  <div id="auth">
    <!-- Formulário de Login/Cadastro mantido igual -->
  </div>

  <div id="main" class="hidden">
    <button onclick="logout()">Sair</button>
    <h2>Controle de Estoque</h2>
    
    <!-- Formulário simplificado -->
    <div>
      <h3>Adicionar Produto</h3>
      <input id="produto" placeholder="Produto">
      <input id="tipo" placeholder="Tipo">
      <input id="lote" placeholder="Lote">
      <input id="quantidade" type="number" placeholder="Quantidade">
      <button onclick="adicionar()">Adicionar</button>
    </div>

    <!-- Tabela editável -->
    <h3>Estoque</h3>
    <table id="tabela">
      <thead>
        <tr>
          <th>ID</th>
          <th>Produto</th>
          <th>Tipo</th>
          <th>Lote</th>
          <th>Qtd</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
    <p id="msg"></p>
  </div>

  <script>
    const api = '/api';
    let userId = null;
    let editingId = null;

    // Funções auxiliares
    function show(id) { document.getElementById(id).classList.remove('hidden'); }
    function hide(id) { document.getElementById(id).classList.add('hidden'); }
    function setMsg(id, txt) { document.getElementById(id).innerText = txt; }

    // Autenticação (mantida igual)

    // Funções de Estoque Atualizadas
    async function adicionar() {
      try {
        const body = {
          produto: document.getElementById('produto').value,
          tipo: document.getElementById('tipo').value,
          lote: document.getElementById('lote').value,
          quantidade: Number(document.getElementById('quantidade').value)
        };

        const res = await fetch(`${api}/estoque`, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error('Falha ao adicionar');
        
        // Limpar campos
        ['produto', 'tipo', 'lote', 'quantidade'].forEach(id => {
          document.getElementById(id).value = '';
        });
        
        listar();
      } catch (error) {
        setMsg('msg', `Erro: ${error.message}`);
      }
    }

    async function remover(id) {
      if (!confirm('Tem certeza que deseja remover?')) return;
      
      try {
        const res = await fetch(`${api}/estoque/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Falha ao remover');
        listar();
      } catch (error) {
        setMsg('msg', `Erro: ${error.message}`);
      }
    }

    function iniciarEdicao(id, produto, tipo, lote, quantidade) {
      editingId = id;
      const tr = document.querySelector(`tr[data-id="${id}"]`);
      
      tr.innerHTML = `
        <td>${id}</td>
        <td><input class="edit-input" value="${produto}"></td>
        <td><input class="edit-input" value="${tipo}"></td>
        <td><input class="edit-input" value="${lote}"></td>
        <td><input class="edit-input" type="number" value="${quantidade}"></td>
        <td>
          <button onclick="salvarEdicao()">Salvar</button>
          <button onclick="cancelarEdicao()">Cancelar</button>
        </td>
      `;
    }

    async function salvarEdicao() {
      try {
        const tr = document.querySelector(`tr[data-id="${editingId}"]`);
        const inputs = tr.querySelectorAll('input');
        
        const updatedData = {
          produto: inputs[0].value,
          tipo: inputs[1].value,
          lote: inputs[2].value,
          quantidade: Number(inputs[3].value)
        };

        const res = await fetch(`${api}/estoque/${editingId}`, {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(updatedData)
        });

        if (!res.ok) throw new Error('Falha ao atualizar');
        
        editingId = null;
        listar();
      } catch (error) {
        setMsg('msg', `Erro: ${error.message}`);
      }
    }

    function cancelarEdicao() {
      editingId = null;
      listar();
    }

    function preencherTabela(data) {
      const tbody = document.querySelector('#tabela tbody');
      tbody.innerHTML = '';

      for (const [id, item] of Object.entries(data)) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', id);
        tr.innerHTML = `
          <td>${id}</td>
          <td>${item.produto}</td>
          <td>${item.tipo}</td>
          <td>${item.lote}</td>
          <td>${item.quantidade}</td>
          <td>
            <button onclick="iniciarEdicao('${id}', '${item.produto}', '${item.tipo}', '${item.lote}', ${item.quantidade})">
              Editar
            </button>
            <button onclick="remover('${id}')">Remover</button>
          </td>
        `;
        tbody.appendChild(tr);
      }
    }

    async function listar() {
      try {
        const res = await fetch(`${api}/estoque`);
        const data = await res.json();
        preencherTabela(data);
      } catch (error) {
        setMsg('msg', 'Erro ao carregar estoque');
      }
    }

    // Restante do código mantido igual
  </script>
</body>
</html>
