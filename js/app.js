(function(){
  const KEY = 'textos-padrao:v1';
  const THEME_KEY = 'tema';
  const $ = (id) => document.getElementById(id);

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function seed(){
    const t1 = uid(), t2 = uid();
    return {
      version: 1,
      active: t1,
      tabs: [
        { id: t1, name: 'E-mails', items: [
          { id: uid(), label: 'Saudação', text: 'Prezados(as),\n\nBom dia.\n\n' },
          { id: uid(), label: 'Encerramento', text: 'Permaneço à disposição para quaisquer esclarecimentos.\n\nAtenciosamente,' },
          { id: uid(), label: 'Confirmação de recebimento', text: 'Acuso o recebimento da mensagem e informo que a demanda já está em análise.' }
        ]},
        { id: t2, name: 'Despachos', items: [
          { id: uid(), label: 'Encaminhamento', text: 'Encaminho para conhecimento e providências cabíveis.' },
          { id: uid(), label: 'Arquivamento', text: 'Cumpridas as providências, arquive-se.' }
        ]}
      ]
    };
  }

  function valid(d){
    return d && Array.isArray(d.tabs) && d.tabs.every(t =>
      t && typeof t.name === 'string' && Array.isArray(t.items) &&
      t.items.every(i => i && typeof i.label === 'string' && typeof i.text === 'string'));
  }

  function normalize(d){
    d.tabs.forEach(t => { t.id = t.id || uid(); t.items.forEach(i => { i.id = i.id || uid(); }); });
    if (!d.tabs.some(t => t.id === d.active)) d.active = d.tabs[0] ? d.tabs[0].id : null;
    return d;
  }

  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); if (valid(d)) return normalize(d); }
    } catch (e) {}
    return seed();
  }

  let state = load();
  let editMode = false;
  let query = '';

  function save(){
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Não foi possível salvar neste navegador.'); }
  }

  const activeTab = () => state.tabs.find(t => t.id === state.active) || null;

  // ---------- Área de transferência ----------
  async function copyText(text){
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) {}
      ta.remove();
      return ok;
    }
  }

  let toastTimer;
  function toast(msg){
    const el = $('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------- Renderização ----------
  function el(tag, props, ...children){
    const n = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) n.setAttribute(k, v);
    }
    children.flat().forEach(c => { if (c != null) n.append(c); });
    return n;
  }

  function renderTabs(){
    const nav = $('tabs'); nav.replaceChildren();
    state.tabs.forEach(t => {
      const selected = !query && t.id === state.active;
      nav.append(el('button', {
        class: 'tab', role: 'tab', 'aria-selected': String(selected),
        onclick: () => { state.active = t.id; query = ''; $('search').value = ''; save(); render(); }
      }, t.name, el('span', { class: 'count' }, String(t.items.length))));
    });
    if (editMode) nav.append(el('button', { class: 'tab add', onclick: () => openTabDialog(null) }, '+ Nova seção'));
    $('tabtools').hidden = !(editMode && activeTab() && !query);
  }

  function card(item, tab, showFrom){
    const done = el('span', { class: 'done', 'aria-hidden': 'true' }, 'Copiado');
    const c = el('div', { class: 'card' });
    const btn = el('button', {
      class: 'copy', title: 'Copiar "' + item.label + '"',
      onclick: async () => {
        const ok = await copyText(item.text);
        if (ok) {
          c.classList.add('copied');
          setTimeout(() => c.classList.remove('copied'), 700);
          toast('Copiado: ' + item.label);
        } else {
          toast('Não foi possível copiar. Tente novamente.');
        }
      }
    },
      el('span', { class: 'label' }, item.label),
      el('span', { class: 'preview' }, item.text),
      showFrom ? el('span', { class: 'from' }, tab.name) : null
    );
    c.append(btn, done);
    if (editMode) {
      const idx = tab.items.indexOf(item);
      c.append(el('div', { class: 'tools' },
        el('button', { 'aria-label': 'Mover para trás', title: 'Mover para trás', onclick: () => moveItem(tab, idx, -1) }, '←'),
        el('button', { 'aria-label': 'Mover para frente', title: 'Mover para frente', onclick: () => moveItem(tab, idx, 1) }, '→'),
        el('button', { onclick: () => openItemDialog(item, tab) }, 'Editar'),
        el('button', { class: 'del', onclick: () => deleteItem(tab, item) }, 'Excluir')
      ));
    }
    return c;
  }

  function renderGrid(){
    const grid = $('grid'), empty = $('empty');
    grid.replaceChildren();
    let count = 0;

    if (query) {
      const q = query.toLowerCase();
      state.tabs.forEach(t => t.items.forEach(i => {
        if (i.label.toLowerCase().includes(q) || i.text.toLowerCase().includes(q)) {
          grid.append(card(i, t, true)); count++;
        }
      }));
      empty.hidden = count > 0;
      empty.textContent = 'Nenhum texto encontrado para "' + query + '".';
      return;
    }

    const tab = activeTab();
    if (!tab) {
      empty.hidden = false;
      empty.textContent = 'Nenhuma seção ainda. Clique em Editar e depois em "+ Nova seção".';
      return;
    }
    tab.items.forEach(i => { grid.append(card(i, tab, false)); count++; });
    if (editMode) grid.append(el('button', { class: 'newcard', onclick: () => openItemDialog(null, tab) }, '+ Adicionar texto'));
    empty.hidden = count > 0 || editMode;
    empty.textContent = 'Esta seção está vazia. Clique em Editar para adicionar o primeiro texto.';
  }

  function render(){ renderTabs(); renderGrid(); }

  // ---------- Itens ----------
  function moveItem(tab, idx, dir){
    const j = idx + dir;
    if (j < 0 || j >= tab.items.length) return;
    [tab.items[idx], tab.items[j]] = [tab.items[j], tab.items[idx]];
    save(); render();
  }

  function deleteItem(tab, item){
    if (!confirm('Excluir o texto "' + item.label + '"?')) return;
    tab.items = tab.items.filter(i => i !== item);
    save(); render(); toast('Texto excluído');
  }

  let editing = null; // { item, tab }
  function openItemDialog(item, tab){
    editing = { item, tab };
    $('itemTitle').textContent = item ? 'Editar texto' : 'Novo texto';
    $('itemLabel').value = item ? item.label : '';
    $('itemText').value = item ? item.text : '';
    const sel = $('itemTab'); sel.replaceChildren();
    state.tabs.forEach(t => sel.append(el('option', { value: t.id }, t.name)));
    sel.value = tab.id;
    $('itemDelete').hidden = !item;
    $('itemDlg').showModal();
    $('itemLabel').focus();
  }

  $('itemForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const label = $('itemLabel').value.trim();
    const text = $('itemText').value;
    if (!label || !text.trim()) return;
    const target = state.tabs.find(t => t.id === $('itemTab').value) || editing.tab;
    if (editing.item) {
      editing.item.label = label; editing.item.text = text;
      if (target !== editing.tab) {
        editing.tab.items = editing.tab.items.filter(i => i !== editing.item);
        target.items.push(editing.item);
      }
    } else {
      target.items.push({ id: uid(), label, text });
    }
    save(); $('itemDlg').close(); render();
    toast(editing.item ? 'Alterações salvas' : 'Texto adicionado');
  });
  $('itemCancel').addEventListener('click', () => $('itemDlg').close());
  $('itemDelete').addEventListener('click', () => {
    const { item, tab } = editing;
    $('itemDlg').close();
    deleteItem(tab, item);
  });

  // ---------- Seções ----------
  let editingTab = null;
  function openTabDialog(tab){
    editingTab = tab;
    $('tabTitle').textContent = tab ? 'Renomear seção' : 'Nova seção';
    $('tabName').value = tab ? tab.name : '';
    $('tabDlg').showModal();
    $('tabName').focus();
  }
  $('tabForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('tabName').value.trim();
    if (!name) return;
    if (editingTab) editingTab.name = name;
    else { const t = { id: uid(), name, items: [] }; state.tabs.push(t); state.active = t.id; }
    save(); $('tabDlg').close(); render();
  });
  $('tabCancel').addEventListener('click', () => $('tabDlg').close());

  $('tabtools').addEventListener('click', (e) => {
    const act = e.target.dataset.act; const tab = activeTab();
    if (!act || !tab) return;
    const idx = state.tabs.indexOf(tab);
    if (act === 'tab-rename') openTabDialog(tab);
    if (act === 'tab-left' || act === 'tab-right') {
      const j = idx + (act === 'tab-left' ? -1 : 1);
      if (j < 0 || j >= state.tabs.length) return;
      [state.tabs[idx], state.tabs[j]] = [state.tabs[j], state.tabs[idx]];
      save(); render();
    }
    if (act === 'tab-delete') {
      const n = tab.items.length;
      const msg = n ? 'Excluir a seção "' + tab.name + '" e seus ' + n + ' texto(s)?' : 'Excluir a seção "' + tab.name + '"?';
      if (!confirm(msg)) return;
      state.tabs.splice(idx, 1);
      state.active = state.tabs[Math.max(0, idx - 1)] ? state.tabs[Math.max(0, idx - 1)].id : null;
      save(); render(); toast('Seção excluída');
    }
  });

  // ---------- Controles gerais ----------
  $('editToggle').addEventListener('click', () => {
    editMode = !editMode;
    const b = $('editToggle');
    b.classList.toggle('on', editMode);
    b.setAttribute('aria-pressed', String(editMode));
    b.textContent = editMode ? 'Concluir edição' : 'Editar';
    render();
  });

  $('search').addEventListener('input', (e) => { query = e.target.value.trim(); render(); });
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing) { e.preventDefault(); $('search').focus(); }
    if (e.key === 'Escape' && document.activeElement === $('search')) { $('search').value = ''; query = ''; render(); }
  });

  // Backup
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    a.href = URL.createObjectURL(blob);
    a.download = 'textos-padrao-backup-' + stamp + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup exportado');
  });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!valid(d)) throw new Error('formato');
      if (!confirm('Substituir todos os textos atuais pelos do backup?')) return;
      state = normalize(d); save(); query = ''; $('search').value = ''; render();
      toast('Backup importado');
    } catch (err) {
      toast('Arquivo inválido. Use um backup exportado por esta página.');
    }
  });

  // Tema claro/escuro (mesma chave e valores da Calculadora de Dias Úteis;
  // o tema inicial já foi aplicado pelo script no <head> do index.html)
  function atualizarIconeTema(tema){
    $('btnTema').textContent = tema === 'escuro' ? '☀️' : '🌙';
  }
  function aplicarTema(tema){
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem(THEME_KEY, tema); } catch (e) {}
    atualizarIconeTema(tema);
  }
  atualizarIconeTema(document.documentElement.getAttribute('data-theme') || 'claro');
  $('btnTema').addEventListener('click', () => {
    const atual = document.documentElement.getAttribute('data-theme') || 'claro';
    aplicarTema(atual === 'escuro' ? 'claro' : 'escuro');
  });

  render();
})();
