import React, { useEffect, useMemo, useRef, useState } from 'react';
import { blankState, normalizeState, replaceState } from './db.js';
import {
  loginWithEmail,
  logout,
  registerWithEmail,
  saveSharedState,
  uploadMemoryPhoto,
  watchAuth,
  watchSharedState,
} from './firebase.js';

const sessionKey = 'casal-current-user';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const categories = ['Alimentacao', 'Lazer', 'Contas', 'Transporte', 'Casa', 'Saude', 'Viagem', 'Outros'];
const eventTypes = ['Data especial', 'Compromisso', 'Viagem', 'Lembrete'];
const goalTypes = ['Financeira', 'Pessoal', 'Do casal'];
const themePalettes = {
  blue: {
    '--rose': '#3b82f6',
    '--rose-dark': '#1d4ed8',
    '--soft': '#eaf2ff',
    '--theme-glow': 'rgba(59, 130, 246, 0.18)',
  },
  pink: {
    '--rose': '#e85d83',
    '--rose-dark': '#b8325c',
    '--soft': '#fff0f3',
    '--theme-glow': 'rgba(232, 93, 131, 0.18)',
  },
};
const tabs = [
  ['dashboard', 'Inicio'],
  ['memories', 'Memorias'],
  ['finance', 'Financas'],
  ['planning', 'Planejamento'],
  ['goals', 'Metas'],
  ['journal', 'Diario'],
  ['settings', 'Backup'],
];

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 7);
}

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function daysBetween(start, end = new Date()) {
  if (!start) return 0;
  const diff = end.setHours(0, 0, 0, 0) - parseDate(start).setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor(diff / 86400000));
}

function formatDate(value) {
  if (!value) return '';
  return parseDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function anniversaryText(memoryDate) {
  const now = new Date();
  const date = parseDate(memoryDate);
  let years = now.getFullYear() - date.getFullYear();
  if (years < 1) return 'memoria recente';
  return `ha ${years} ${years === 1 ? 'ano' : 'anos'}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function App() {
  const [state, setState] = useState(blankState);
  const [ready, setReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const remoteUpdateRef = useRef(false);
  const currentUserId = authUser?.email?.toLowerCase() || localStorage.getItem(sessionKey) || '';

  useEffect(() => {
    const unsubscribe = watchAuth((user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady || !authUser) return undefined;
    setReady(false);
    setCloudReady(false);
    setCloudError('');
    const unsubscribe = watchSharedState((snapshot) => {
      remoteUpdateRef.current = true;
      const cloudState = snapshot.exists() ? snapshot.data().state : null;
      setState(normalizeState(cloudState));
      setReady(true);
      setCloudReady(true);
    }, (error) => {
      setCloudError('blocked');
      setReady(true);
      setCloudReady(false);
    });
    return unsubscribe;
  }, [authReady, authUser]);

  useEffect(() => {
    if (!ready || !cloudReady || !authUser) return;
    if (remoteUpdateRef.current) {
      remoteUpdateRef.current = false;
      return;
    }
    saveSharedState(state);
  }, [ready, cloudReady, authUser, state]);

  const currentUser = state.users.find((user) => user.id === currentUserId);
  const currentTheme = themeForUser(state, currentUserId);

  function update(mutator) {
    setState((previous) => {
      const draft = structuredClone(previous);
      mutator(draft);
      return draft;
    });
  }

  if (!authReady) return <div className="loading">Carregando login...</div>;
  if (!authUser) return <AuthScreen />;
  if (!ready) return <div className="loading">Sincronizando o cantinho de voces...</div>;
  if (cloudError) return <CloudError />;
  if (!state.couple) return <Onboarding authUser={authUser} onCreate={(next) => setState(next)} />;
  if (!currentUser) return <NoAccess />;

  return (
    <div className="app-shell" style={currentTheme}>
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Casal</p>
          <h1>{state.couple.name}</h1>
          <p className="muted">{daysBetween(state.couple.startDate)} dias juntos</p>
        </div>
        <nav>
          {tabs.map(([id, label]) => (
            <button className={activeTab === id ? 'active' : ''} key={id} onClick={() => setActiveTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="profile-switch">
          <span>Entrou como</span>
          <strong>{currentUser.name}</strong>
          <button className="ghost" onClick={logout}>Sair</button>
        </div>
      </aside>

      <main className="main">
        {activeTab === 'dashboard' && <Dashboard state={state} currentUser={currentUser} setActiveTab={setActiveTab} />}
        {activeTab === 'memories' && <Memories state={state} update={update} currentUser={currentUser} />}
        {activeTab === 'finance' && <Finance state={state} update={update} currentUser={currentUser} />}
        {activeTab === 'planning' && <Planning state={state} update={update} currentUser={currentUser} />}
        {activeTab === 'goals' && <Goals state={state} update={update} currentUser={currentUser} />}
        {activeTab === 'journal' && <Journal state={state} update={update} currentUser={currentUser} />}
        {activeTab === 'settings' && <Settings state={state} onImport={setState} />}
      </main>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await loginWithEmail(form.email, form.password);
      } else {
        await registerWithEmail(form.email, form.password);
      }
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="welcome">
      <form className="welcome-card auth-card" onSubmit={submit}>
        <p className="eyebrow">Login do casal</p>
        <h1>{mode === 'login' ? 'Entrar no app compartilhado.' : 'Criar acesso.'}</h1>
        <p className="muted">Use email e senha. Voces dois precisam ter conta para compartilhar os mesmos dados.</p>
        <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Senha<input type="password" minLength="6" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary" disabled={loading}>{loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Criar uma conta' : 'Ja tenho conta'}
        </button>
      </form>
    </div>
  );
}

function Onboarding({ authUser, onCreate }) {
  const currentEmail = authUser.email?.toLowerCase() || '';
  const [form, setForm] = useState({ a: '', b: '', emailA: currentEmail, emailB: '', startDate: today(), coupleName: '' });

  function submit(event) {
    event.preventDefault();
    const userA = { id: form.emailA.trim().toLowerCase(), name: form.a.trim() || 'Pessoa 1', email: form.emailA.trim().toLowerCase(), theme: 'blue' };
    const userB = { id: form.emailB.trim().toLowerCase(), name: form.b.trim() || 'Pessoa 2', email: form.emailB.trim().toLowerCase(), theme: 'pink' };
    const name = form.coupleName.trim() || `${userA.name} e ${userB.name}`;
    localStorage.setItem(sessionKey, currentEmail);
    onCreate({
      ...blankState,
      couple: { id: uid(), name, startDate: form.startDate },
      users: [userA, userB],
    });
  }

  return (
    <div className="welcome">
      <form className="welcome-card" onSubmit={submit}>
        <p className="eyebrow">Primeiro passo</p>
        <h1>Organizem a vida a dois em um so lugar.</h1>
        <p className="muted">Esse cadastro cria o espaco compartilhado. Use os emails que cada um vai usar no login.</p>
        <label>Nome da primeira pessoa<input required value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} /></label>
        <label>Email da primeira pessoa<input type="email" required value={form.emailA} onChange={(e) => setForm({ ...form, emailA: e.target.value })} /></label>
        <label>Nome da segunda pessoa<input required value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} /></label>
        <label>Email da segunda pessoa<input type="email" required value={form.emailB} onChange={(e) => setForm({ ...form, emailB: e.target.value })} /></label>
        <label>Nome do casal<input value={form.coupleName} onChange={(e) => setForm({ ...form, coupleName: e.target.value })} placeholder="Ex: Ana e Leo" /></label>
        <label>Data de inicio<input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
        <button className="primary">Criar nosso app</button>
      </form>
    </div>
  );
}

function CloudError() {
  return (
    <div className="welcome compact">
      <section className="welcome-card">
        <p className="eyebrow">Firebase</p>
        <h1>Algo bloqueou a sincronizacao.</h1>
        <p className="error-text">Nao foi possivel carregar os dados compartilhados com este login.</p>
        <button className="primary" onClick={logout}>Sair</button>
      </section>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="welcome compact">
      <section className="welcome-card">
        <p className="eyebrow">Acesso</p>
        <h1>Esse login nao tem acesso ao casal.</h1>
        <p className="muted">Entre com uma conta autorizada para acessar os dados compartilhados.</p>
        <button className="primary" onClick={logout}>Entrar com outro email</button>
      </section>
    </div>
  );
}

function UserPicker({ users, onChoose }) {
  return (
    <div className="welcome compact">
      <section className="welcome-card">
        <p className="eyebrow">Login local</p>
        <h1>Quem esta usando agora?</h1>
        <div className="user-grid">
          {users.map((user, index) => <button className={`person-card ${user.theme || (index === 0 ? 'blue' : 'pink')}`} key={user.id} onClick={() => onChoose(user.id)}>{user.name}</button>)}
        </div>
      </section>
    </div>
  );
}

function Dashboard({ state, currentUser, setActiveTab }) {
  const stats = useFinanceStats(state);
  const oldMemory = useMemo(() => {
    const now = new Date();
    return [...state.memories]
      .filter((memory) => parseDate(memory.date) < now)
      .sort((a, b) => Math.abs(parseDate(a.date).getMonth() - now.getMonth()) - Math.abs(parseDate(b.date).getMonth() - now.getMonth()))[0];
  }, [state.memories]);
  const upcoming = [...state.events].filter((event) => event.date >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

  return (
    <section className="page">
      <Header title={`Oi, ${currentUser.name}`} subtitle="Um resumo rapido do relacionamento, planos e dinheiro do mes." />
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Contador</p>
          <h2>{daysBetween(state.couple.startDate)} dias juntos</h2>
          <p>Desde {formatDate(state.couple.startDate)}</p>
        </div>
        <button onClick={() => setActiveTab('journal')}>Escrever no diario</button>
      </div>
      <div className="dashboard-grid">
        <Metric label="Gasto no mes" value={money.format(stats.expenses)} detail={`Restante: ${money.format(stats.remainingBudget)}`} />
        <Metric label="Receitas" value={money.format(stats.income)} detail={`Saldo: ${money.format(stats.balance)}`} />
        <Metric label="Caixinhas" value={money.format(stats.savingsTotal)} detail={`Falta total: ${money.format(stats.savingsMissing)}`} />
      </div>
      <div className="two-col">
        <section className="panel">
          <div className="section-title"><h3>Proximos eventos</h3><button className="ghost" onClick={() => setActiveTab('planning')}>Abrir</button></div>
          <List items={upcoming} empty="Nenhum evento futuro ainda." render={(event) => <><strong>{event.title}</strong><span>{formatDate(event.date)} · {event.type}</span></>} />
        </section>
        <section className="panel memory-highlight">
          <div className="section-title"><h3>Memoria antiga</h3><button className="ghost" onClick={() => setActiveTab('memories')}>Ver linha do tempo</button></div>
          {oldMemory ? (
            <article>
              {oldMemory.photo && <img src={oldMemory.photo} alt={oldMemory.title} />}
              <strong>{oldMemory.title}</strong>
              <span>{anniversaryText(oldMemory.date)} · {formatDate(oldMemory.date)}</span>
              <p>{oldMemory.description}</p>
            </article>
          ) : <p className="muted">Adicione fotos e momentos para o app lembrar voces depois.</p>}
        </section>
      </div>
    </section>
  );
}

function Memories({ state, update, currentUser }) {
  const [form, setForm] = useState({ title: '', date: today(), description: '', photo: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [openPhoto, setOpenPhoto] = useState(null);
  const memories = [...state.memories].sort((a, b) => b.date.localeCompare(a.date));

  async function submit(event) {
    event.preventDefault();
    update((draft) => draft.memories.push({ id: uid(), ...form, userId: currentUser.id, createdAt: new Date().toISOString() }));
    setForm({ title: '', date: today(), description: '', photo: '' });
  }

  async function setPhoto(file) {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const photo = await uploadMemoryPhoto(file);
      setForm((current) => ({ ...current, photo }));
    } catch {
      setUploadError('Nao foi possivel carregar a foto. Tente uma imagem menor ou em outro formato.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="page">
      <Header title="Memorias" subtitle="Fotos, datas e pequenos capitulos da historia de voces." />
      <div className="workspace">
        <form className="panel form-panel" onSubmit={submit}>
          <h3>Nova memoria</h3>
          <label>Titulo<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Data<input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label>Foto<input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} /></label>
          {uploading && <p className="muted">Preparando foto...</p>}
          {uploadError && <p className="error-text">{uploadError}</p>}
          {form.photo && <img className="preview" src={form.photo} alt="Previa" />}
          <label>Descricao<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <button className="primary" disabled={uploading}>Salvar memoria</button>
        </form>
        <div className="timeline">
          {memories.map((memory) => (
            <article className="memory-card" key={memory.id}>
              {memory.photo && (
                <button className="photo-button" type="button" onClick={() => setOpenPhoto(memory)}>
                  <img src={memory.photo} alt={memory.title} />
                </button>
              )}
              <div>
                <p className="eyebrow">{formatDate(memory.date)} · {anniversaryText(memory.date)}</p>
                <h3>{memory.title}</h3>
                <p>{memory.description}</p>
                <button className="danger" onClick={() => update((draft) => draft.memories = draft.memories.filter((item) => item.id !== memory.id))}>Remover</button>
              </div>
            </article>
          ))}
          {!memories.length && <Empty text="A linha do tempo esta pronta para receber a primeira foto." />}
        </div>
      </div>
      {openPhoto && (
        <div className="photo-modal" role="dialog" aria-modal="true" onClick={() => setOpenPhoto(null)}>
          <div className="photo-modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="photo-modal-close" type="button" aria-label="Fechar foto" onClick={() => setOpenPhoto(null)}>Fechar</button>
            <img src={openPhoto.photo} alt={openPhoto.title} />
            <strong>{openPhoto.title}</strong>
          </div>
        </div>
      )}
    </section>
  );
}

function Finance({ state, update, currentUser }) {
  const stats = useFinanceStats(state);
  const [transaction, setTransaction] = useState({ type: 'expense', description: '', amount: '', category: categories[0], date: today(), scope: 'shared' });
  const [newBox, setNewBox] = useState({ goalName: '', target: '' });
  const thisMonth = monthKey();
  const monthTransactions = state.transactions.filter((item) => item.date.startsWith(thisMonth)).sort((a, b) => b.date.localeCompare(a.date));
  const categoryTotals = categories.map((category) => ({
    category,
    total: monthTransactions.filter((item) => item.type === 'expense' && item.category === category).reduce((sum, item) => sum + Number(item.amount), 0),
  })).filter((item) => item.total > 0);
  const maxCategory = Math.max(1, ...categoryTotals.map((item) => item.total));

  function saveTransaction(event) {
    event.preventDefault();
    update((draft) => draft.transactions.push({ id: uid(), ...transaction, amount: Number(transaction.amount), userId: currentUser.id }));
    setTransaction({ ...transaction, description: '', amount: '' });
  }

  function createSavingsBox(event) {
    event.preventDefault();
    update((draft) => draft.savingsBoxes.push({
      id: uid(),
      goalName: newBox.goalName.trim() || 'Nova caixinha',
      target: Number(newBox.target || 0),
      contributions: [],
    }));
    setNewBox({ goalName: '', target: '' });
  }

  function saveDeposit(event, boxId) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount') || 0);
    const note = String(form.get('note') || '');
    if (!amount) return;
    update((draft) => {
      const box = draft.savingsBoxes.find((item) => item.id === boxId);
      if (box) box.contributions.push({ id: uid(), amount, note, date: today(), userId: currentUser.id });
    });
    event.currentTarget.reset();
  }

  return (
    <section className="page">
      <Header title="Financas" subtitle="Controle o mes, separe gastos e acompanhe a caixinha do casal." />
      <div className="dashboard-grid">
        <Metric label="Orcamento mensal" value={money.format(stats.budget)} detail={`Usado: ${Math.min(100, stats.budgetUsage).toFixed(0)}%`} />
        <Metric label="Gastos" value={money.format(stats.expenses)} detail={`Compartilhados: ${money.format(stats.sharedExpenses)}`} />
        <Metric label="Pode gastar" value={money.format(stats.remainingBudget)} detail={`Saldo geral: ${money.format(stats.balance)}`} />
      </div>
      <div className="workspace">
        <form className="panel form-panel" onSubmit={saveTransaction}>
          <h3>Novo lancamento</h3>
          <Segment value={transaction.type} onChange={(type) => setTransaction({ ...transaction, type })} options={[['expense', 'Despesa'], ['income', 'Receita']]} />
          <label>Descricao<input required value={transaction.description} onChange={(e) => setTransaction({ ...transaction, description: e.target.value })} /></label>
          <label>Valor<input type="number" min="0" step="0.01" required value={transaction.amount} onChange={(e) => setTransaction({ ...transaction, amount: e.target.value })} /></label>
          <label>Categoria<select value={transaction.category} onChange={(e) => setTransaction({ ...transaction, category: e.target.value })}>{categories.map((cat) => <option key={cat}>{cat}</option>)}</select></label>
          <label>Data<input type="date" value={transaction.date} onChange={(e) => setTransaction({ ...transaction, date: e.target.value })} /></label>
          <label>Tipo de gasto<select value={transaction.scope} onChange={(e) => setTransaction({ ...transaction, scope: e.target.value })}><option value="shared">Compartilhado</option><option value="personal">Individual</option></select></label>
          <button className="primary">Salvar lancamento</button>
        </form>
        <section className="panel">
          <div className="section-title"><h3>Orcamento e categorias</h3></div>
          <label>Orcamento de {monthLabel(thisMonth)}<input type="number" min="0" step="0.01" value={state.budgets[thisMonth] || ''} onChange={(e) => update((draft) => draft.budgets[thisMonth] = Number(e.target.value))} /></label>
          <Progress value={stats.budget ? stats.expenses / stats.budget : 0} />
          <div className="bars">
            {categoryTotals.map((item) => <Bar key={item.category} label={item.category} value={item.total} max={maxCategory} />)}
            {!categoryTotals.length && <p className="muted">Sem despesas no mes atual.</p>}
          </div>
        </section>
      </div>
      <div className="two-col">
        <section className="panel">
          <div className="section-title"><h3>Caixinhas do casal</h3></div>
          <form className="inline-form savings-create" onSubmit={createSavingsBox}>
            <input placeholder="Objetivo: viagem, casa, emergencia..." required value={newBox.goalName} onChange={(e) => setNewBox({ ...newBox, goalName: e.target.value })} />
            <input type="number" min="0" step="0.01" placeholder="Meta total" value={newBox.target} onChange={(e) => setNewBox({ ...newBox, target: e.target.value })} />
            <button className="primary">Criar caixinha</button>
          </form>
          <div className="savings-grid">
            {state.savingsBoxes.map((box) => {
              const total = box.contributions.reduce((sum, item) => sum + Number(item.amount), 0);
              const missing = Math.max(0, Number(box.target || 0) - total);
              return (
                <article className="savings-card" key={box.id}>
                  <div className="savings-head">
                    <label>Objetivo<input value={box.goalName} onChange={(e) => update((draft) => draft.savingsBoxes.find((item) => item.id === box.id).goalName = e.target.value)} /></label>
                    <label>Meta total<input type="number" min="0" step="0.01" value={box.target || ''} onChange={(e) => update((draft) => draft.savingsBoxes.find((item) => item.id === box.id).target = Number(e.target.value))} /></label>
                  </div>
                  <h2>{money.format(total)}</h2>
                  <p className="muted">{box.goalName} · falta {money.format(missing)}</p>
                  <Progress value={box.target ? total / box.target : 0} />
                  <form className="inline-form" onSubmit={(event) => saveDeposit(event, box.id)}>
                    <input name="amount" type="number" min="0" step="0.01" placeholder="Valor" required />
                    <input name="note" placeholder="Observacao" />
                    <button>Adicionar</button>
                  </form>
                  <List items={[...box.contributions].reverse()} empty="Nenhuma contribuicao ainda." render={(item) => <><strong>{money.format(item.amount)}</strong><span>{userName(state, item.userId)} · {formatDate(item.date)} · {item.note}</span></>} />
                  <button className="danger" onClick={() => {
                    if (window.confirm(`Remover a caixinha "${box.goalName}"?`)) {
                      update((draft) => draft.savingsBoxes = draft.savingsBoxes.filter((item) => item.id !== box.id));
                    }
                  }}>Remover caixinha</button>
                </article>
              );
            })}
            {!state.savingsBoxes.length && <Empty text="Crie uma caixinha para viagem, casa, emergencia ou qualquer plano de voces." />}
          </div>
        </section>
        <section className="panel">
          <h3>Lancamentos do mes</h3>
          <List items={monthTransactions} empty="Nenhum lancamento neste mes." render={(item) => <><strong>{item.description} · {money.format(item.amount)}</strong><span>{item.type === 'income' ? 'Receita' : 'Despesa'} · {item.category} · {item.scope === 'shared' ? 'Compartilhado' : userName(state, item.userId)}</span><button className="danger" onClick={() => update((draft) => draft.transactions = draft.transactions.filter((row) => row.id !== item.id))}>Remover</button></>} />
        </section>
      </div>
    </section>
  );
}

function Planning({ state, update, currentUser }) {
  const [event, setEvent] = useState({ title: '', date: today(), type: eventTypes[0], notes: '' });
  const [task, setTask] = useState({ title: '', dueDate: today(), list: 'Geral' });
  const events = [...state.events].sort((a, b) => a.date.localeCompare(b.date));
  const grouped = events.reduce((acc, item) => {
    const key = item.date.slice(0, 7);
    acc[key] = [...(acc[key] || []), item];
    return acc;
  }, {});

  function saveEvent(e) {
    e.preventDefault();
    update((draft) => draft.events.push({ id: uid(), ...event, userId: currentUser.id }));
    setEvent({ title: '', date: today(), type: eventTypes[0], notes: '' });
  }

  function saveTask(e) {
    e.preventDefault();
    update((draft) => draft.tasks.push({ id: uid(), ...task, done: false, userId: currentUser.id }));
    setTask({ title: '', dueDate: today(), list: 'Geral' });
  }

  return (
    <section className="page">
      <Header title="Planejamento" subtitle="Calendario, viagens, datas especiais e tarefas em conjunto." />
      <div className="workspace">
        <form className="panel form-panel" onSubmit={saveEvent}>
          <h3>Novo evento</h3>
          <label>Titulo<input required value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })} /></label>
          <label>Data<input type="date" value={event.date} onChange={(e) => setEvent({ ...event, date: e.target.value })} /></label>
          <label>Tipo<select value={event.type} onChange={(e) => setEvent({ ...event, type: e.target.value })}>{eventTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Notas<textarea value={event.notes} onChange={(e) => setEvent({ ...event, notes: e.target.value })} /></label>
          <button className="primary">Salvar evento</button>
        </form>
        <section className="panel">
          <h3>Calendario compartilhado</h3>
          <div className="calendar-list">
            {Object.entries(grouped).map(([key, items]) => (
              <div key={key}>
                <h4>{monthLabel(key)}</h4>
                {items.map((item) => <div className="calendar-row" key={item.id}><time>{parseDate(item.date).getDate()}</time><div><strong>{item.title}</strong><span>{item.type} · {item.notes}</span></div><button className="danger" onClick={() => update((draft) => draft.events = draft.events.filter((row) => row.id !== item.id))}>Remover</button></div>)}
              </div>
            ))}
            {!events.length && <Empty text="Adicione aniversarios, viagens e compromissos." />}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="section-title"><h3>Checklist</h3></div>
        <form className="inline-form" onSubmit={saveTask}>
          <input required placeholder="Tarefa" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />
          <input placeholder="Lista" value={task.list} onChange={(e) => setTask({ ...task, list: e.target.value })} />
          <input type="date" value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} />
          <button>Adicionar</button>
        </form>
        <div className="task-list">
          {state.tasks.map((item) => <label className="task" key={item.id}><input type="checkbox" checked={item.done} onChange={(e) => update((draft) => draft.tasks.find((row) => row.id === item.id).done = e.target.checked)} /><span className={item.done ? 'done' : ''}>{item.title}</span><small>{item.list} · {formatDate(item.dueDate)}</small><button className="danger" onClick={() => update((draft) => draft.tasks = draft.tasks.filter((row) => row.id !== item.id))}>Remover</button></label>)}
        </div>
      </section>
    </section>
  );
}

function Goals({ state, update }) {
  const [form, setForm] = useState({ title: '', type: goalTypes[0], target: '', current: '', dueDate: today() });
  function submit(event) {
    event.preventDefault();
    update((draft) => draft.goals.push({ id: uid(), ...form, target: Number(form.target), current: Number(form.current), done: false }));
    setForm({ title: '', type: goalTypes[0], target: '', current: '', dueDate: today() });
  }

  return (
    <section className="page">
      <Header title="Metas do casal" subtitle="Objetivos financeiros, pessoais e planos grandes em progresso." />
      <div className="workspace">
        <form className="panel form-panel" onSubmit={submit}>
          <h3>Nova meta</h3>
          <label>Titulo<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Tipo<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{goalTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Meta numerica<input type="number" min="0" step="0.01" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></label>
          <label>Progresso atual<input type="number" min="0" step="0.01" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} /></label>
          <label>Prazo<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
          <button className="primary">Criar meta</button>
        </form>
        <div className="goal-grid">
          {state.goals.map((goal) => {
            const progress = goal.target ? goal.current / goal.target : goal.done ? 1 : 0;
            return <article className="goal-card" key={goal.id}><p className="eyebrow">{goal.type} · {formatDate(goal.dueDate)}</p><h3>{goal.title}</h3><Progress value={progress} /><div className="goal-actions"><input type="number" min="0" step="0.01" value={goal.current} onChange={(e) => update((draft) => draft.goals.find((item) => item.id === goal.id).current = Number(e.target.value))} /><label><input type="checkbox" checked={goal.done} onChange={(e) => update((draft) => draft.goals.find((item) => item.id === goal.id).done = e.target.checked)} /> Concluida</label><button className="danger" onClick={() => update((draft) => draft.goals = draft.goals.filter((item) => item.id !== goal.id))}>Remover</button></div></article>;
          })}
          {!state.goals.length && <Empty text="Crie a primeira meta de voces." />}
        </div>
      </div>
    </section>
  );
}

function Journal({ state, update, currentUser }) {
  const [text, setText] = useState('');
  function submit(event) {
    event.preventDefault();
    update((draft) => draft.journal.push({ id: uid(), text, userId: currentUser.id, date: new Date().toISOString() }));
    setText('');
  }

  return (
    <section className="page">
      <Header title="Diario e mensagens" subtitle="Um espaco simples para registrar conversas, combinados e carinho." />
      <form className="panel journal-form" onSubmit={submit}>
        <textarea required placeholder="Escreva uma mensagem, combinados da semana ou uma lembranca..." value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary">Publicar</button>
      </form>
      <div className="journal-list">
        {[...state.journal].reverse().map((entry) => <article className="journal-entry" key={entry.id}><strong>{userName(state, entry.userId)}</strong><time>{new Date(entry.date).toLocaleString('pt-BR')}</time><p>{entry.text}</p><button className="danger" onClick={() => update((draft) => draft.journal = draft.journal.filter((item) => item.id !== entry.id))}>Remover</button></article>)}
      </div>
    </section>
  );
}

function Settings({ state, onImport }) {
  const inputRef = useRef(null);

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `casal-backup-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file) {
    if (!file) return;
    const json = JSON.parse(await file.text());
    const next = await replaceState(json);
    onImport(next);
  }

  return (
    <section className="page">
      <Header title="Backup local" subtitle="Exporte e importe os dados deste navegador quando precisar." />
      <section className="panel backup-panel">
        <h3>Seus dados ficam locais</h3>
        <p className="muted">O backup inclui cadastros, fotos salvas como dados de imagem, financas, eventos, metas e diario.</p>
        <div className="backup-actions">
          <button className="primary" onClick={exportBackup}>Exportar backup</button>
          <button onClick={() => inputRef.current.click()}>Importar backup</button>
          <input ref={inputRef} type="file" accept="application/json" hidden onChange={(e) => importBackup(e.target.files[0])} />
        </div>
      </section>
    </section>
  );
}

function useFinanceStats(state) {
  return useMemo(() => {
    const key = monthKey();
    const budget = Number(state.budgets[key] || 0);
    const monthTransactions = state.transactions.filter((item) => item.date.startsWith(key));
    const income = monthTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = monthTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0);
    const sharedExpenses = monthTransactions.filter((item) => item.type === 'expense' && item.scope === 'shared').reduce((sum, item) => sum + Number(item.amount), 0);
    const savingsTotal = state.savingsBoxes.reduce((sum, box) => {
      return sum + box.contributions.reduce((boxSum, item) => boxSum + Number(item.amount), 0);
    }, 0);
    const savingsMissing = state.savingsBoxes.reduce((sum, box) => {
      const total = box.contributions.reduce((boxSum, item) => boxSum + Number(item.amount), 0);
      return sum + Math.max(0, Number(box.target || 0) - total);
    }, 0);
    return {
      budget,
      income,
      expenses,
      sharedExpenses,
      balance: income - expenses,
      remainingBudget: budget - expenses,
      budgetUsage: budget ? (expenses / budget) * 100 : 0,
      savingsTotal,
      savingsMissing,
    };
  }, [state]);
}

function userName(state, id) {
  return state.users.find((user) => user.id === id)?.name || 'Casal';
}

function themeForUser(state, id) {
  const index = state.users.findIndex((user) => user.id === id);
  const theme = state.users[index]?.theme || (index === 0 ? 'blue' : 'pink');
  return themePalettes[theme] || themePalettes.pink;
}

function firebaseErrorMessage(error) {
  const code = error?.code || '';
  if (code.includes('auth/invalid-credential')) return 'Nao foi possivel entrar com essas credenciais.';
  if (code.includes('auth/email-already-in-use')) return 'Nao foi possivel criar a conta com esses dados.';
  if (code.includes('auth/weak-password')) return 'Use uma senha com pelo menos 6 caracteres.';
  if (code.includes('auth/operation-not-allowed')) return 'Login por email e senha ainda nao esta habilitado.';
  return 'Nao foi possivel concluir. Tente novamente.';
}

function Header({ title, subtitle }) {
  return <header className="page-header"><p className="eyebrow">Organizacao a dois</p><h2>{title}</h2><p>{subtitle}</p></header>;
}

function Metric({ label, value, detail }) {
  return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Progress({ value }) {
  const width = `${Math.max(0, Math.min(100, value * 100))}%`;
  return <div className="progress"><span style={{ width }} /></div>;
}

function Segment({ value, onChange, options }) {
  return <div className="segment">{options.map(([id, label]) => <button type="button" className={value === id ? 'selected' : ''} key={id} onClick={() => onChange(id)}>{label}</button>)}</div>;
}

function List({ items, empty, render }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return <div className="list">{items.map((item) => <div className="list-row" key={item.id}>{render(item)}</div>)}</div>;
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

function Bar({ label, value, max }) {
  return <div className="bar"><div><span>{label}</span><strong>{money.format(value)}</strong></div><i style={{ width: `${(value / max) * 100}%` }} /></div>;
}

export default App;
