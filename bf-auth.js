// Bluefox Sales OS: sign-in screen and the connection to the team's shared data.
// Nothing about job sites, leads or routes is in this site's files. It all loads from the
// database after a successful sign-in, and the database refuses anyone who is not signed in.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, onSnapshot, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

window.BF_AUTH_LOADED = true;
const cfg = window.BF_CONFIG || {};
const $ = (s) => document.querySelector(s);
const gate = $('#gate'), msg = $('#gate-msg'), fields = $('#gate-fields'), form = $('#gate-form');
const emailBox = $('#gate-email'), passBox = $('#gate-pass'), goBtn = $('#gate-go'), resetBtn = $('#gate-reset');

function say(text, kind) { msg.textContent = text; msg.className = 'gate-msg' + (kind ? ' ' + kind : ''); }
function explain(err) {
  const c = (err && err.code) || '';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-email' || c === 'auth/missing-password') return 'That email and password do not match. Check both and try again.';
  if (c === 'auth/too-many-requests') return 'Too many tries. Wait a few minutes, then try again.';
  if (c === 'auth/network-request-failed') return 'No connection. Check your signal and try again.';
  if (c === 'auth/user-disabled') return 'This account has been turned off. Ask the office to turn it back on.';
  return 'Sign-in did not work (' + (c || 'error') + '). Try again.';
}

if (!cfg.apiKey || !cfg.projectId) {
  say('This site is not connected to its sign-in service yet.', 'err');
} else {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  let fs;
  try { fs = initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch (e) { fs = initializeFirestore(app, { ignoreUndefinedProperties: true }); }

  const report = (err) => { if (typeof window.BF_onWriteError === 'function') window.BF_onWriteError(err); };
  const wrap = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata });
  // Same shape the app already uses for shared data. Saves are handed to the database at once,
  // so a change made with no signal is kept on the device and sent when the signal returns.
  const db = {
    doc(path) {
      const r = doc(fs, path);
      return {
        set: (d) => { setDoc(r, d).catch(report); return Promise.resolve(); },
        setWait: (d) => setDoc(r, d),
        delete: () => { deleteDoc(r).catch(report); return Promise.resolve(); },
        onSnapshot: (next, bad) => onSnapshot(r, (s) => next(wrap(s)), bad || (() => {})),
      };
    },
    collection(path) {
      const c = collection(fs, path);
      return { onSnapshot: (next, bad) => onSnapshot(c, (s) => next({ docs: s.docs.map((x) => ({ id: x.id, data: () => x.data() })), metadata: s.metadata }), bad || (() => {})) };
    },
  };

  let started = false;
  onAuthStateChanged(auth, (user) => {
    if (user) {
      gate.hidden = true; passBox.value = '';
      if (!started) { started = true; window.__bfResolve({ db, email: user.email || '', signOut: () => signOut(auth).then(() => location.reload()) }); }
    } else {
      if (started) { location.reload(); return; }
      gate.hidden = false; fields.hidden = false; say('Sign in to continue.');
      try { emailBox.focus(); } catch (e) {}
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    goBtn.disabled = true; say('Signing in…');
    signInWithEmailAndPassword(auth, emailBox.value.trim(), passBox.value)
      .catch((err) => { say(explain(err), 'err'); })
      .finally(() => { goBtn.disabled = false; });
  });
  resetBtn.addEventListener('click', () => {
    const em = emailBox.value.trim();
    if (!em) { say('Type your email in the box first, then press this again.', 'err'); return; }
    sendPasswordResetEmail(auth, em)
      .then(() => say('If that email has an account, a link to set a new password is on its way.'))
      .catch((err) => say(err && err.code === 'auth/network-request-failed' ? 'No connection. Check your signal and try again.' : 'If that email has an account, a link to set a new password is on its way.'));
  });
}
