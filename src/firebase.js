import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBYLmBIfERBRhZXMZ5v3RtWCTw97Bk4GLA',
  authDomain: 'casaljuntos-559e7.firebaseapp.com',
  projectId: 'casaljuntos-559e7',
  storageBucket: 'casaljuntos-559e7.firebasestorage.app',
  messagingSenderId: '888627463818',
  appId: '1:888627463818:web:21a321b203df9202410f73',
  measurementId: 'G-4FNF90P80W',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
const coupleDoc = doc(firestore, 'couples', 'casal-juntos');

setPersistence(auth, browserLocalPersistence);

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export function logout() {
  return signOut(auth);
}

export function watchSharedState(callback, onError) {
  return onSnapshot(coupleDoc, callback, onError);
}

export async function getSharedState() {
  return getDoc(coupleDoc);
}

export async function saveSharedState(state) {
  const allowedEmails = state.users
    .map((user) => (user.email || user.id || '').trim().toLowerCase())
    .filter(Boolean);

  await setDoc(coupleDoc, {
    allowedEmails,
    state,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadMemoryPhoto(file) {
  if (!auth.currentUser) throw new Error('not-authenticated');
  return compressImageToDataUrl(file);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function compressImageToDataUrl(file) {
  const original = await readFileAsDataUrl(file);
  const image = await loadImage(original);
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.72);
}
