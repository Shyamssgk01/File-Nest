// ═══════════════════════════════════════════════════
//  auth.js  — Firebase Email Verification for File Nest
//  Replace firebaseConfig below with YOUR project config
// ═══════════════════════════════════════════════════

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

// 🔴 REPLACE THIS with your Firebase project config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

let currentTab = 'signin';

// ── Show/hide auth screen ──────────────────────────
function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  // Hide the main app
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('mainWrapper').style.display = 'none';
}
function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('sidebar').style.display = '';
  document.getElementById('mainWrapper').style.display = '';
}

// ── Tab switching ──────────────────────────────────
window.switchTab = function(tab) {
  currentTab = tab;
  const isSignIn = tab === 'signin';
  document.getElementById('tabSignIn').style.background = isSignIn ? '#6c63ff' : 'transparent';
  document.getElementById('tabSignIn').style.color = isSignIn ? '#fff' : '#888';
  document.getElementById('tabSignUp').style.background = isSignIn ? 'transparent' : '#6c63ff';
  document.getElementById('tabSignUp').style.color = isSignIn ? '#888' : '#fff';
  document.getElementById('authBtn').textContent = isSignIn ? 'Sign In' : 'Create Account';
  document.getElementById('authSwitch').innerHTML = isSignIn
    ? `Don't have an account? <span onclick="switchTab('signup')" style="color:#6c63ff;cursor:pointer;font-weight:600;">Sign Up</span>`
    : `Already have an account? <span onclick="switchTab('signin')" style="color:#6c63ff;cursor:pointer;font-weight:600;">Sign In</span>`;
  hideError();
  document.getElementById('verifyMsg').style.display = 'none';
  document.getElementById('continueBtn').style.display = 'none';
};

// ── Error helper ───────────────────────────────────
function showError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError() {
  document.getElementById('authError').style.display = 'none';
}

// ── Main auth handler ──────────────────────────────
window.handleAuth = async function() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  hideError();

  if (!email || !password) { showError('Please enter your email and password.'); return; }

  const btn = document.getElementById('authBtn');
  btn.textContent = 'Please wait…';
  btn.disabled = true;

  try {
    if (currentTab === 'signup') {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      document.getElementById('verifyMsg').style.display = 'block';
      document.getElementById('continueBtn').style.display = 'block';
      btn.textContent = 'Create Account';
    } else {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!cred.user.emailVerified) {
        showError('Please verify your email first. Check your inbox.');
        await sendEmailVerification(cred.user); // resend
        document.getElementById('verifyMsg').style.display = 'block';
        document.getElementById('continueBtn').style.display = 'block';
        await signOut(auth);
      }
      // If verified, onAuthStateChanged will handle showing the app
    }
  } catch (err) {
    showError(friendlyError(err.code));
  } finally {
    btn.disabled = false;
    if (btn.textContent === 'Please wait…') btn.textContent = currentTab === 'signin' ? 'Sign In' : 'Create Account';
  }
};

// ── Check verification after clicking Continue ─────
window.checkVerification = async function() {
  await auth.currentUser?.reload();
  if (auth.currentUser?.emailVerified) {
    showApp();
  } else {
    showError('Email not verified yet. Please check your inbox and click the link.');
  }
};

// ── Google Sign In ─────────────────────────────────
window.handleGoogle = async function() {
  try {
    await signInWithPopup(auth, googleProvider);
    // onAuthStateChanged handles the rest
  } catch (err) {
    showError(friendlyError(err.code));
  }
};

// ── Auth state listener ────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (user && user.emailVerified) {
    showApp();
  } else {
    showAuthScreen();
  }
});

// ── Friendly error messages ────────────────────────
function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/invalid-credential': 'Invalid email or password.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
