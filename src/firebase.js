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
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';

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
const storage = getStorage(app);
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
  await setDoc(coupleDoc, {
    state,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadMemoryPhoto(file, userId) {
  const extension = file.name.split('.').pop() || 'jpg';
  const path = `memories/${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
