// Minimal quiz app using Google Sheets + Apps Script + Firebase (Auth + Realtime DB)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getDatabase, ref, set, push } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

// 1) ======== CONFIG ========

// TODO: paste your Firebase config here (from Firebase console)
// Example:
// const firebaseConfig = {
//   apiKey: "…",
//   authDomain: "…",
//   databaseURL: "…",
//   projectId: "…",
//   storageBucket: "…",
//   messagingSenderId: "…",
//   appId: "…"
// };
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBSDsDbaAu_9efkv1oFGZROnOMahd0dkco",
  authDomain: "khatwat-survay.firebaseapp.com",
  projectId: "khatwat-survay",
  storageBucket: "khatwat-survay.firebasestorage.app",
  messagingSenderId: "223955649486",
  appId: "1:223955649486:web:b3962d8b5fbd0cdb2b219f",
  measurementId: "G-MXR7GNDXEE"
};

// Google Apps Script web app endpoint (ends with /exec)
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbz1fRnzEKhezzSJUJ6D1D87zLRX9APtRpNbaOIDbl10mYQhVJAUI5BvlKIznMqqbnTUug/exec"; // <-- replace

// How many questions to pick (null or 0 = use all)
const QUESTIONS_LIMIT = 0; // e.g., set to 20 to pick 20 random questions

// 2) ======== INIT ========
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (s) => document.querySelector(s);
const authSection = $('#authSection');
const quizSection = $('#quizSection');
const userArea = $('#userArea');
const welcome = $('#welcome');

const signupBtn = $('#signupBtn');
const loginBtn = $('#loginBtn');
const logoutBtn = $('#logoutBtn');

const nameIn = $('#name');
const ageIn = $('#age');
const gradeIn = $('#grade');
const signupEmailIn = $('#signupEmail');
const signupPassIn = $('#signupPassword');
const loginEmailIn = $('#loginEmail');
const loginPassIn = $('#loginPassword');

const currentIdxEl = $('#currentIdx');
const totalQEl = $('#totalQ');
const correctCountEl = $('#correctCount');
const wrongCountEl = $('#wrongCount');
const remainingCountEl = $('#remainingCount');
const questionEl = $('#question');
const optionsEl = $('#options');
const dotsEl = $('#dots');
const nextBtn = $('#nextBtn');
const prevBtn = $('#prevBtn');
const finishBtn = $('#finishBtn');

const resultCard = $('#resultCard');
const scoreText = $('#scoreText');
const reviewEl = $('#review');

let QUESTIONS = [];
let index = 0;
let answers = []; // {selectedIndex, isCorrect, correctIndex}

// 3) ======== HELPERS ========
function shuffle(arr) {
  // Fisher–Yates
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeCorrect(correct, options) {
  const map = { A: 0, B: 1, C: 2, D: 3, a:0, b:1, c:2, d:3 };
  if (typeof correct === 'string' && correct.trim() in map) return map[correct.trim()];
  // fallback: match by text
  const idx = options.findIndex(o => (o + '').trim() === (correct + '').trim());
  return idx >= 0 ? idx : 0;
}

function buildDots(total) {
  dotsEl.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    d.textContent = i + 1;
    d.addEventListener('click', () => {
      index = i;
      renderQuestion();
    });
    dotsEl.appendChild(d);
  }
}

function updateDots() {
  const children = Array.from(dotsEl.children);
  children.forEach((d, i) => {
    d.classList.remove('current', 'correct', 'incorrect');
    if (i === index) d.classList.add('current');
    if (answers[i]) {
      if (answers[i].isCorrect) d.classList.add('correct');
      else d.classList.add('incorrect');
    }
  });
}

function updateProgress() {
  const total = QUESTIONS.length;
  const correct = answers.filter(a => a && a.isCorrect).length;
  const attempted = answers.filter(a => a).length;
  const wrong = attempted - correct;
  const remaining = total - attempted;
  currentIdxEl.textContent = index + 1;
  totalQEl.textContent = total;
  correctCountEl.textContent = correct;
  wrongCountEl.textContent = wrong;
  remainingCountEl.textContent = remaining;
}

function lockOptions() {
  Array.from(optionsEl.children).forEach(btn => btn.disabled = true);
}
function unlockOptions() {
  Array.from(optionsEl.children).forEach(btn => btn.disabled = false);
}

// 4) ======== RENDER ========
function renderQuestion() {
  updateProgress();
  updateDots();

  const q = QUESTIONS[index];
  questionEl.textContent = q.question;

  // shuffle options but keep track of which index is correct after shuffle
  const ops = q.options.map((t, idx) => ({ t, originalIndex: idx }));
  const shuffled = shuffle(ops);
  const correctOriginal = q.correctIndex; // index in original options
  const correctAfterShuffle = shuffled.findIndex(o => o.originalIndex === correctOriginal);

  optionsEl.innerHTML = '';
  shuffled.forEach((o, i) => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = o.t;
    btn.addEventListener('click', () => {
      // already answered? allow change until next/prev?
      const wasAnswered = !!answers[index];
      answers[index] = {
        selectedIndex: i,
        isCorrect: i === correctAfterShuffle,
        correctIndex: correctAfterShuffle,
        shownOrder: shuffled.map(x => x.originalIndex) // to reconstruct later
      };

      // colorize
      Array.from(optionsEl.children).forEach(b => b.classList.remove('selected', 'correct', 'incorrect'));
      btn.classList.add('selected');
      // show correct/incorrect colors immediately
      if (i === correctAfterShuffle) btn.classList.add('correct');
      else {
        btn.classList.add('incorrect');
        // mark correct
        const correctBtn = optionsEl.children[correctAfterShuffle];
        if (correctBtn) correctBtn.classList.add('correct');
      }

      lockOptions();
      updateProgress();
      updateDots();

      // auto-advance if not last and user changed nothing before
      if (!wasAnswered && index < QUESTIONS.length - 1) {
        setTimeout(() => {
          index++;
          renderQuestion();
        }, 500);
      }
    });
    optionsEl.appendChild(btn);
  });

  // if already answered, reflect state
  const a = answers[index];
  unlockOptions();
  if (a) {
    lockOptions();
    const btns = Array.from(optionsEl.children);
    btns[a.selectedIndex].classList.add('selected', a.isCorrect ? 'correct' : 'incorrect');
    if (!a.isCorrect) btns[a.correctIndex].classList.add('correct');
  }

  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === QUESTIONS.length - 1;
}

function showResult() {
  const total = QUESTIONS.length;
  const correct = answers.filter(a => a && a.isCorrect).length;
  scoreText.textContent = `${correct} / ${total}`;
  reviewEl.innerHTML = '';

  QUESTIONS.forEach((q, i) => {
    const a = answers[i];
    const div = document.createElement('div');
    div.className = 'review-item';
    const status = a && a.isCorrect ? '<span class="tag good">صح</span>' : '<span class="tag bad">غلط</span>';
    const sel = a ? q.options[a.shownOrder[a.selectedIndex]] : '—';
    const cor = q.options[q.correctIndex];
    div.innerHTML = `
      <div><b>${i+1}) ${q.question}</b> ${status}</div>
      <div>إجابتك: ${sel}</div>
      <div>الإجابة الصحيحة: ${cor}</div>
    `;
    reviewEl.appendChild(div);
  });

  resultCard.classList.remove('hide');
}

// 5) ======== DATA FLOW ========
async function loadQuestions() {
  const res = await fetch(SHEET_API_URL);
  const data = await res.json();

  // normalize and shuffle questions
  const normalized = data.map(row => {
    const options = (row.options || []).filter(Boolean);
    const correctIndex = normalizeCorrect(row.correct, options);
    return { question: row.question, options, correctIndex };
  });

  let pool = shuffle(normalized);
  if (QUESTIONS_LIMIT && QUESTIONS_LIMIT > 0) {
    pool = pool.slice(0, Math.min(QUESTIONS_LIMIT, pool.length));
  }

  QUESTIONS = pool;
  answers = new Array(QUESTIONS.length);
  buildDots(QUESTIONS.length);
  renderQuestion();
}

async function saveResultToDB() {
  const user = auth.currentUser;
  if (!user) return;
  const total = QUESTIONS.length;
  const correct = answers.filter(a => a && a.isCorrect).length;
  const payload = {
    uid: user.uid,
    displayName: user.displayName || '',
    email: user.email,
    score: correct,
    total: total,
    ts: Date.now(),
    answers: answers.map((a, i) => ({
      question: QUESTIONS[i].question,
      selectedIndex: a ? a.selectedIndex : null,
      correctIndex: QUESTIONS[i].correctIndex,
      isCorrect: a ? a.isCorrect : false
    }))
  };
  const keyRef = push(ref(db, `results/${user.uid}`));
  await set(keyRef, payload);
}

// 6) ======== AUTH HANDLERS ========
signupBtn?.addEventListener('click', async () => {
  const name = nameIn.value.trim();
  const age = ageIn.value ? Number(ageIn.value) : null;
  const grade = gradeIn.value || '';
  const email = signupEmailIn.value.trim();
  const pass = signupPassIn.value;

  if (!name || !email || !pass) {
    alert('من فضلك املأ الاسم والإيميل وكلمة السر');
    return;
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    // store profile
    await set(ref(db, `users/${cred.user.uid}`), {
      name, email, age, grade, createdAt: Date.now()
    });
    alert('تم التسجيل بنجاح! يمكنك البدء في الامتحان.');
  } catch (e) {
    alert('خطأ في التسجيل: ' + e.message);
  }
});

loginBtn?.addEventListener('click', async () => {
  const email = loginEmailIn.value.trim();
  const pass = loginPassIn.value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    alert('خطأ في تسجيل الدخول: ' + e.message);
  }
});

logoutBtn?.addEventListener('click', async () => {
  await signOut(auth);
});

// 7) ======== NAVIGATION ========
nextBtn.addEventListener('click', () => {
  if (index < QUESTIONS.length - 1) {
    index++;
    renderQuestion();
  }
});
prevBtn.addEventListener('click', () => {
  if (index > 0) {
    index--;
    renderQuestion();
  }
});
finishBtn.addEventListener('click', async () => {
  if (!confirm('هل تريد إنهاء الامتحان وحفظ النتيجة؟')) return;
  await saveResultToDB();
  showResult();
});

// 8) ======== AUTH STATE ========
onAuthStateChanged(auth, async (user) => {
  if (user) {
    welcome.textContent = `أهلًا، ${user.displayName || user.email}`;
    userArea.classList.remove('hide');
    authSection.classList.add('hide');
    quizSection.classList.remove('hide');
    // Load questions when user logged in
    try {
      await loadQuestions();
    } catch (e) {
      alert('تعذر تحميل بنك الأسئلة. تأكد من رابط Google Apps Script.');
    }
  } else {
    userArea.classList.add('hide');
    authSection.classList.remove('hide');
    quizSection.classList.add('hide');
    resultCard.classList.add('hide');
  }
});
