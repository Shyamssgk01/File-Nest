/* ═══════════════════════════════════════════════════════════
   FILE NEST – auth.js
   Firebase Email Verification + Google Sign-In
   ─────────────────────────────────────────────────────────
   SETUP STEPS:
   1. Go to https://console.firebase.google.com
   2. Create a project → Authentication → Sign-in method
      → Enable "Email/Password" and "Google"
   3. Project Settings → Your apps → Web app → copy firebaseConfig
   4. Paste your config in the firebaseConfig object below
   5. Authentication → Settings → Authorized domains
      → Add your GitHub Pages domain (e.g. yourname.github.io)
═══════════════════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 🔴 PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ── Check config is filled in ─────────────────────────────
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
  document.addEventListener('DOMContentLoaded', () => {
    showError(
      '⚠️ Firebase not configured. Open auth.js and replace the firebaseConfig values with your real Firebase project config.'
    );
  });
}

let app, auth, googleProvider;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} catch (e) {
  console.error('Firebase init error:', e);
}

let currentTab = 'signin';

/* ── Show / hide screens ─────────────────────────────────── */
function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('mainWrapper').style.display = 'none';
}

function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('sidebar').style.display = '';
  document.getElementById('mainWrapper').style.display = '';
}

/* ── Tab switching ───────────────────────────────────────── */
window.switchTab = function (tab) {
  currentTab = tab;
  const isSignIn = tab === 'signin';

  const tabIn = document.getElementById('tabSignIn');
  const tabUp = document.getElementById('tabSignUp');
  tabIn.style.background = isSignIn ? '#6c63ff' : 'transparent';
  tabIn.style.color = isSignIn ? '#fff' : '#888';
  tabUp.style.background = isSignIn ? 'transparent' : '#6c63ff';
  tabUp.style.color = isSignIn ? '#888' : '#fff';

  document.getElementById('authBtn').textContent = isSignIn ? 'Sign In' : 'Create Account';
  document.getElementById('authSwitch').innerHTML = isSignIn
    ? `Don't have an account? <span onclick="switchTab('signup')" style="color:#6c63ff;cursor:pointer;font-weight:600;">Sign Up</span>`
    : `Already have an account? <span onclick="switchTab('signin')" style="color:#6c63ff;cursor:pointer;font-weight:600;">Sign In</span>`;

  hideError();
  document.getElementById('verifyMsg').style.display = 'none';
  document.getElementById('continueBtn').style.display = 'none';
};

/* ── Error helpers ───────────────────────────────────────── */
function showError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError() {
  document.getElementById('authError').style.display = 'none';
}

/* ── Main auth button handler ────────────────────────────── */
window.handleAuth = async function () {
  if (!auth) {
    showError('⚠️ Firebase is not initialized. Check your firebaseConfig in auth.js.');
    return;
  }

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  hideError();

  if (!email || !password) {
    showError('Please enter your email and password.');
    return;
  }

  const btn = document.getElementById('authBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Please wait…';
  btn.disabled = true;

  try {
    if (currentTab === 'signup') {
      // ── Sign Up ───────────────────────────────────────
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      await signOut(auth);
      document.getElementById('verifyMsg').style.display = 'block';
      document.getElementById('continueBtn').style.display = 'block';

    } else {
      // ── Sign In ───────────────────────────────────────
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
        await signOut(auth);
        showError('Please verify your email first. A new verification link has been sent.');
        document.getElementById('verifyMsg').style.display = 'block';
        document.getElementById('continueBtn').style.display = 'block';
      }
      // If verified → onAuthStateChanged calls showApp()
    }

  } catch (err) {
    // Raw error code shown in brackets to help debug
    console.error('Auth error:', err.code, err.message);
    showError(friendlyError(err.code) + '  [' + err.code + ']');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

/* ── "Continue" — after user clicks the verification email ── */
window.checkVerification = async function () {
  if (!auth) return;

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;

  if (!email || !password) {
    showError('Please enter your email and password to continue.');
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await cred.user.reload();

    if (cred.user.emailVerified) {
      showApp();
    } else {
      await signOut(auth);
      showError('Email not verified yet. Please click the link in your inbox first.');
    }
  } catch (err) {
    console.error('Verify error:', err.code, err.message);
    showError(friendlyError(err.code) + '  [' + err.code + ']');
  }
};

/* ── Google Sign-In ──────────────────────────────────────── */
window.handleGoogle = async function () {
  if (!auth) return;
  hideError();
  try {
    await signInWithPopup(auth, googleProvider);
    // Google accounts are always verified → onAuthStateChanged handles the rest
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      console.error('Google error:', err.code, err.message);
      showError(friendlyError(err.code) + '  [' + err.code + ']');
    }
  }
};

/* ── Sign Out ────────────────────────────────────────────── */
window.handleSignOut = async function () {
  if (!auth) return;
  await signOut(auth);
  showAuthScreen();
};

/* ── Auth state listener (runs on every page load) ───────── */
if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (user && user.emailVerified) {
      showApp();
    } else {
      showAuthScreen();
    }
  });
} else {
  showAuthScreen();
}

/* ── Friendly error messages ─────────────────────────────── */
function friendlyError(code) {
  const map = {
    'auth/user-not-found':            'No account found with this email.',
    'auth/wrong-password':            'Incorrect password. Please try again.',
    'auth/invalid-credential':        'Incorrect email or password.',
    'auth/invalid-login-credentials': 'Incorrect email or password.',
    'auth/email-already-in-use':      'An account with this email already exists.',
    'auth/weak-password':             'Password must be at least 6 characters.',
    'auth/invalid-email':             'Please enter a valid email address.',
    'auth/too-many-requests':         'Too many failed attempts. Please try again later.',
    'auth/popup-closed-by-user':      'Google sign-in was cancelled.',
    'auth/network-request-failed':    'Network error. Please check your connection.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
                                      '⚠️ Invalid API key — check your firebaseConfig in auth.js.',
    'auth/configuration-not-found':   '⚠️ Firebase not configured properly — check auth.js.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
