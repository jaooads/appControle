const DB_NAME = 'casal-local-db';
const DB_VERSION = 1;
const STORE = 'documents';
const STATE_KEY = 'app-state';

const blankState = {
  couple: null,
  users: [],
  memories: [],
  transactions: [],
  budgets: {},
  savingsBoxes: [],
  events: [],
  tasks: [],
  goals: [],
  journal: [],
};

function normalizeState(state) {
  const savingsBoxes = Array.isArray(state?.savingsBoxes)
    ? state.savingsBoxes
    : state?.savings
      ? [{
          id: 'legacy-savings',
          goalName: state.savings.goalName || 'Nossa caixinha',
          target: Number(state.savings.target || 0),
          contributions: state.savings.contributions || [],
        }]
      : [];

  return {
    ...blankState,
    ...(state || {}),
    savingsBoxes: savingsBoxes.map((box, index) => ({
      id: box.id || `savings-${index}`,
      goalName: box.goalName || 'Nova caixinha',
      target: Number(box.target || 0),
      contributions: box.contributions || [],
    })),
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const result = callback(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function loadState() {
  const saved = await withStore('readonly', (store) => {
    const request = store.get(STATE_KEY);
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  });

  return normalizeState(saved);
}

export async function saveState(state) {
  await withStore('readwrite', (store) => {
    store.put(state, STATE_KEY);
  });
}

export async function replaceState(state) {
  const next = normalizeState(state);
  await saveState(next);
  return next;
}

export { blankState };
