const API = 'http://localhost:8000';

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  userId: localStorage.getItem('sm_user') || '',
  userName: localStorage.getItem('sm_name') || '',
  subjects: [],
  topicMap: {},       // { subject: [topics] }
  activeSubject: null,
  activeMaterialTopic: null,
  plan: null,
  session: {
    topic: '', duration: 10, timeLeft: 0, elapsed: 0,
    clickCount: 0, idleTime: 0, timeToStart: 0,
    setupTime: Date.now(), focusResult: null,
    prevFocusScore: 0.7, completed: true, difficulty: 'easy',
    timerInterval: null, idleInterval: null, focusTimeout: null,
    lastActivity: Date.now()
  }
};

const INTERVENTIONS = [
  { type: 'mcq', question: 'What is the time complexity of Binary Search?', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], answer: 1 },
  { type: 'mcq', question: 'Which data structure uses LIFO?', options: ['Queue', 'Array', 'Stack', 'Linked List'], answer: 2 },
  { type: 'mcq', question: 'In Greedy Algorithm, what do we choose at each step?', options: ['Random choice', 'Worst option', 'Locally optimal choice', 'Global minimum'], answer: 2 },
  { type: 'flashcard', front: '💡 What is Dynamic Programming?', back: 'A method for solving complex problems by breaking them into simpler overlapping subproblems, storing results to avoid recomputation.' },
  { type: 'flashcard', front: '💡 What is Big O Notation?', back: 'Big O describes the upper bound of algorithm complexity — how performance scales with input size in the worst case.' },
];

// ─── Init ─────────────────────────────────────────────────────────────────────
window.onload = () => {
  if (state.userId) {
    showPage('dashboard');
    loadDashboard();
  } else {
    showPage('setup');
  }
};

// ─── Navigation ───────────────────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');

  const navBtns = document.querySelectorAll('.nav-item');
  navBtns.forEach(b => { if (b.getAttribute('onclick')?.includes(name)) b.classList.add('active'); });

  if (name === 'dashboard') loadDashboard();
  if (name === 'session') loadTodayTopics();
}

// ─── Setup ────────────────────────────────────────────────────────────────────
async function doSetup() {
  const name = document.getElementById('setup-name').value.trim();
  if (!name) return;
  const id = 'user_' + Date.now();
  try {
    await apiFetch('/api/user/create', 'POST', { user_id: id, name });
    apiFetch('/api/admin/train-models', 'POST', {}).catch(() => {});
  } catch (e) {
    showToast('⚠️ Cannot reach backend. Working in offline mode.');
  }
  state.userId = id;
  state.userName = name;
  localStorage.setItem('sm_user', id);
    localStorage.setItem('sm_name', name);
  document.getElementById('sidebar-name').textContent = name;
  showPage('dashboard');
  showToast('Welcome to StreakMind! 🎉');
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  if (!state.userId) return;
  document.getElementById('sidebar-name').textContent = state.userName;

  try {
    const [stats, todayPlan] = await Promise.all([
      apiFetch(`/api/user/${state.userId}/stats`),
      apiFetch(`/api/planner/${state.userId}/today`).catch(() => ({ topics: [] }))
    ]);

    document.getElementById('dash-name').textContent = stats.name || state.userName;
    document.getElementById('stat-streak').textContent = stats.streak || 0;
    document.getElementById('stat-sessions').textContent = stats.sessions_completed || 0;
    document.getElementById('stat-total').textContent = stats.total_sessions || 0;

    const focusPct = Math.round((stats.avg_focus_score || 0) * 100);
    document.getElementById('stat-focus').textContent = focusPct + '%';
    document.getElementById('focus-pct-label').textContent = focusPct + '%';
    document.getElementById('focus-bar').style.width = focusPct + '%';
    document.getElementById('focus-msg').textContent =
      focusPct >= 70 ? '🟢 You\'re maintaining great focus!' :
      focusPct >= 40 ? '🟡 Focus is moderate — keep pushing!' :
      '🔴 Complete more sessions to improve';

    if (stats.streak > 0) {
      const sb = document.getElementById('dash-streak-badge');
      sb.style.display = 'inline-flex';
      document.getElementById('dash-streak-val').textContent = stats.streak;
    }

    // Achievements
    setAch('ach-1', stats.sessions_completed >= 1);
    setAch('ach-2', stats.streak >= 3);
    setAch('ach-3', stats.sessions_completed >= 5);
    setAch('ach-4', focusPct >= 80);

    // Today's plan
    renderTodayPlan(todayPlan.topics || []);
  } catch (e) {
    document.getElementById('dash-name').textContent = state.userName;
  }
}

function setAch(id, earned) {
  const el = document.getElementById(id);
  if (earned) el.classList.add('earned'); else el.classList.remove('earned');
}

function renderTodayPlan(topics) {
  const el = document.getElementById('today-plan-list');
  if (!topics.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>No plan for today</h3><p>Generate your study plan first</p><button class="btn btn-primary" style="margin-top:16px" onclick="showPage('planner')">Create Plan →</button></div>`;
    return;
  }
  el.innerHTML = topics.map(t => `
    <div class="topic-item">
      <div><div style="font-weight:700; font-size:15px">${t.topic}</div><div style="font-size:13px; color:var(--text-muted); margin-top:2px">${t.subject}</div></div>
      <div style="display:flex; align-items:center; gap:12px">
        <span style="font-size:13px; color:var(--text-muted); font-family:var(--font-mono)">${t.duration_min} min</span>
        <button class="btn btn-primary" style="padding:8px 16px; font-size:13px" onclick="showPage('session')">Start →</button>
      </div>
    </div>
  `).join('');
}

// ─── Planner ──────────────────────────────────────────────────────────────────
function switchPlanView(view) {
  const fv = document.getElementById('planner-form-view');
  const pv = document.getElementById('planner-plan-view');
  const bf = document.getElementById('btn-form-view');
  const bp = document.getElementById('btn-plan-view');
  if (view === 'form') {
    fv.style.display = ''; pv.style.display = 'none';
    bf.className = 'btn btn-primary'; bp.className = 'btn btn-outline';
  } else {
    fv.style.display = 'none'; pv.style.display = '';
    bf.className = 'btn btn-outline'; bp.className = 'btn btn-primary';
    renderFullPlan();
  }
}

function addSubject() {
  const inp = document.getElementById('subject-input');
  const s = inp.value.trim();
  if (!s || state.subjects.includes(s)) return;
  state.subjects.push(s);
  state.topicMap[s] = [];
  inp.value = '';
  setActiveSubject(s);
  renderSubjectTags();
  renderSyllabusPreview();
}

function removeSubject(s) {
  state.subjects = state.subjects.filter(x => x !== s);
  delete state.topicMap[s];
  if (state.activeSubject === s) setActiveSubject(state.subjects[0] || null);
  renderSubjectTags();
  renderSyllabusPreview();
}

function setActiveSubject(s) {
  state.activeSubject = s;
  document.getElementById('active-subject-label').textContent = s || '—';
  renderTopicTags();
}

function addTopic() {
  const inp = document.getElementById('topic-input');
  const t = inp.value.trim();
  if (!t || !state.activeSubject) return;
  if (!state.topicMap[state.activeSubject].includes(t)) {
    state.topicMap[state.activeSubject].push(t);
  }
  inp.value = '';
  renderTopicTags();
  renderSyllabusPreview();
}

function removeTopic(subject, topic) {
  state.topicMap[subject] = state.topicMap[subject].filter(t => t !== topic);
  renderTopicTags();
  renderSyllabusPreview();
}

function renderSubjectTags() {
  document.getElementById('subjects-tags').innerHTML = state.subjects.map(s =>
    `<div class="tag ${s === state.activeSubject ? 'selected' : ''}" onclick="setActiveSubject('${s}')">
      ${s} <button onclick="event.stopPropagation(); removeSubject('${s}')">×</button>
    </div>`
  ).join('');
}

function renderTopicTags() {
  if (!state.activeSubject) { document.getElementById('topics-tags').innerHTML = ''; return; }
  document.getElementById('topics-tags').innerHTML = (state.topicMap[state.activeSubject] || []).map(t =>
    `<div class="tag" style="cursor:pointer" onclick="setActiveMaterialTopic('${t}')">${t} <button onclick="event.stopPropagation(); removeTopic('${state.activeSubject}', '${t}')">×</button></div>`
  ).join('');
}

function setActiveMaterialTopic(t) {
  state.activeMaterialTopic = t;
  const label = document.getElementById('mat-topic-label');
  const btn = document.getElementById('upload-btn');
  if (label && btn) {
    label.textContent = t || 'none selected';
    btn.textContent = t ? `Upload to ${t}` : 'Upload to Output Topic';
    btn.disabled = !t;
  }
}

async function uploadMaterial() {
  if (!state.userId) { showToast('Please setup first'); return; }
  const topic = state.activeMaterialTopic;
  if (!topic) { showToast('Select a topic to attach material to.'); return; }
  const fileInput = document.getElementById('material-file');
  if (!fileInput.files.length) { showToast('Please select a file.'); return; }
  
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('file', file);
  formData.append('user_id', state.userId);
  formData.append('topic', topic);
  
  const btn = document.getElementById('upload-btn');
  const orgText = btn.textContent;
  btn.textContent = 'Uploading...';
  btn.disabled = true;
  
  try {
    const res = await fetch(API + '/api/materials/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    showToast('✅ Material uploaded successfully!');
    fileInput.value = '';
  } catch (e) {
    showToast('⚠️ Error uploading material.');
  }
  btn.textContent = orgText;
  btn.disabled = false;
}

function renderSyllabusPreview() {
  const el = document.getElementById('syllabus-preview');
  if (!state.subjects.length) {
    el.innerHTML = `<div class="section-title">📋 Syllabus Preview</div><div class="empty-state"><div class="empty-icon">📚</div><h3>No subjects added yet</h3><p>Add subjects on the left</p></div>`;
    return;
  }
  const totalTopics = Object.values(state.topicMap).flat().length;
  const examDate = document.getElementById('exam-date').value;
  const daysLeft = examDate ? Math.max(0, Math.ceil((new Date(examDate) - new Date()) / 86400000)) : null;

  el.innerHTML = `<div class="section-title">📋 Syllabus Preview</div>` +
    state.subjects.map(s => `
      <div style="margin-bottom:20px">
        <div style="font-weight:800; font-size:15px; color:var(--accent); margin-bottom:8px">${s}</div>
        ${(state.topicMap[s] || []).length === 0
          ? `<div style="font-size:13px; color:var(--text-muted); padding-left:12px">No topics yet</div>`
          : (state.topicMap[s] || []).map((t, i) => `
            <div style="padding:8px 12px; background:var(--surface2); border-radius:8px; margin-bottom:6px; font-size:14px; display:flex; gap:8px">
              <span style="color:var(--text-muted); font-family:var(--font-mono); font-size:12px">${String(i+1).padStart(2,'0')}</span>${t}
            </div>`).join('')
        }
      </div>`).join('') +
    `<div style="margin-top:16px; padding:12px 16px; background:var(--surface2); border-radius:10px; font-size:13px">
      <div style="color:var(--text-muted)">Total topics: <strong style="color:var(--text)">${totalTopics}</strong></div>
      ${daysLeft !== null ? `<div style="color:var(--text-muted); margin-top:4px">Days left: <strong style="color:var(--accent2)">${daysLeft}</strong></div>` : ''}
    </div>`;
}

async function generatePlan() {
  const examDate = document.getElementById('exam-date').value;
  if (!state.subjects.length || !examDate) { showToast('Add subjects and set exam date'); return; }
  const totalTopics = Object.values(state.topicMap).flat().length;
  if (!totalTopics) { showToast('Add at least one topic'); return; }

  const dailyHours = parseFloat(document.querySelector('#planner-form-view input[type=range]').value);
  document.getElementById('gen-btn').textContent = '⏳ Generating...';

  try {
    const res = await apiFetch('/api/planner/generate', 'POST', {
      user_id: state.userId,
      subjects: state.subjects,
      topics: state.topicMap,
      exam_date: examDate,
      daily_hours: dailyHours
    });
    state.plan = res.plan;
    switchPlanView('plan');
    showToast('📅 Study plan generated!');
  } catch (e) {
    showToast('Error generating plan. Check backend.');
  }
  document.getElementById('gen-btn').textContent = '⚡ Generate Plan';
}

async function renderFullPlan() {
  if (!state.plan) {
    try {
      const res = await apiFetch(`/api/planner/${state.userId}/full`);
      state.plan = res.plan;
    } catch (e) {
      document.getElementById('plan-days-list').innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>No plan found</h3><p>Go to Edit Plan to generate one</p></div>`;
      return;
    }
  }
  const today = new Date().toISOString().split('T')[0];
  const entries = Object.entries(state.plan).sort(([a],[b]) => a.localeCompare(b));
  if (entries.length === 0) {
    document.getElementById('plan-days-list').innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>No plan generated</h3><p>Go to Edit Plan to generate one</p></div>`;
    return;
  }
  document.getElementById('plan-days-list').innerHTML = entries.map(([date, topics]) => `
    <div class="card" style="margin-bottom:12px; ${date === today ? 'border-color:rgba(124,92,252,0.5); background:rgba(124,92,252,0.05)' : ''}">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px">
        <span style="font-family:var(--font-mono); font-size:13px; color:var(--text-muted)">${date}</span>
        ${date === today ? '<span class="badge badge-easy">TODAY</span>' : ''}
        ${date < today ? '<span style="font-size:12px; color:var(--text-muted)">✓ Past</span>' : ''}
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px">
        ${topics.map(t => `
          <div style="padding:8px 14px; background:var(--surface2); border-radius:8px; font-size:14px; font-weight:600">
            <span style="color:var(--text-muted); margin-right:6px; font-size:12px">${t.subject} ·</span>${t.topic}
            <span style="color:var(--text-muted); margin-left:8px; font-family:var(--font-mono); font-size:12px">${t.duration_min}m</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

// ─── Session ──────────────────────────────────────────────────────────────────
async function loadTodayTopics() {
  try {
    const res = await apiFetch(`/api/planner/${state.userId}/today`);
    const topics = res.topics || [];
    const card = document.getElementById('today-topics-card');
    const list = document.getElementById('today-topics-list');
    if (topics.length) {
      card.style.display = '';
      list.innerHTML = topics.map(t => `
        <div class="topic-item" style="cursor:pointer" onclick="document.getElementById('session-topic').value='${t.topic}'">
          <div><div style="font-weight:700">${t.topic}</div><div style="font-size:12px; color:var(--text-muted)">${t.subject} · ${t.duration_min}min</div></div>
          <span style="font-size:12px; color:var(--accent)">Select →</span>
        </div>`).join('');
    }
  } catch(e) {}
}

function startSession() {
  const topic = document.getElementById('session-topic').value.trim();
  if (!topic) { showToast('Please enter a topic'); return; }
  const duration = parseInt(document.getElementById('dur-range').value);

  const s = state.session;
  s.topic = topic;
  s.duration = duration;
  s.timeLeft = duration * 60;
  s.elapsed = 0;
  s.clickCount = 0;
  s.idleTime = 0;
  s.timeToStart = Math.floor((Date.now() - s.setupTime) / 1000);
  s.focusResult = null;
  s.lastActivity = Date.now();

  document.getElementById('running-topic').textContent = '📖 ' + topic;
  showSessionPhase('running');

  // Track activity
  document.addEventListener('click', trackActivity);
  document.addEventListener('keydown', trackActivity);
  document.addEventListener('mousemove', trackActivity);

  // Idle tracker
  s.idleInterval = setInterval(() => {
    s.idleTime = Math.floor((Date.now() - s.lastActivity) / 1000);
    document.getElementById('live-idle').textContent = s.idleTime + 's';
    document.getElementById('live-idle').style.color = s.idleTime > 60 ? 'var(--accent3)' : 'var(--text)';
  }, 1000);

  // Main timer
  s.timerInterval = setInterval(() => {
    s.timeLeft--;
    s.elapsed++;
    document.getElementById('timer-display').textContent = formatTime(s.timeLeft);
    document.getElementById('live-elapsed').textContent = formatTime(s.elapsed);
    const pct = ((s.duration * 60 - s.timeLeft) / (s.duration * 60)) * 100;
    document.getElementById('session-progress').style.width = pct + '%';
    if (s.timeLeft <= 0) {
      clearTimers();
      goToFeedback();
    }
  }, 1000);

  // Focus check after 30s (demo) then every 60s
  s.focusTimeout = setTimeout(() => {
    checkFocus();
    s.focusInterval = setInterval(checkFocus, 60000);
  }, 30000);
}

function trackActivity() {
  state.session.lastActivity = Date.now();
  state.session.clickCount++;
  document.getElementById('live-clicks').textContent = state.session.clickCount;
}

async function checkFocus() {
  const s = state.session;
  try {
    const res = await apiFetch('/api/session/predict-focus', 'POST', {
      user_id: state.userId, topic: s.topic,
      time_on_page: s.elapsed, idle_time: s.idleTime,
      click_count: s.clickCount, time_to_start: s.timeToStart,
      previous_focus_score: s.prevFocusScore
    });
    s.focusResult = res;
    updateFocusUI(res.focused, res.confidence);
    if (!res.focused) triggerIntervention();
  } catch (e) {
    // Fallback rule
    const focused = s.idleTime < 60 && s.clickCount > 1;
    s.focusResult = { focused, confidence: 0.75 };
    updateFocusUI(focused, 0.75);
    if (!focused) triggerIntervention();
  }
}

function manualFocusCheck() {
  showToast('🔍 Running focus check...');
  checkFocus();
}

function updateFocusUI(focused, confidence) {
  const ring = document.getElementById('focus-ring');
  ring.className = 'focus-ring ' + (focused ? 'focus-focused' : 'focus-distracted');
  ring.textContent = Math.round(confidence * 100) + '%';
  document.getElementById('focus-status-text').textContent = focused ? '✅ Focused' : '⚠️ Distracted';
  document.getElementById('focus-status-sub').textContent = `Confidence: ${Math.round(confidence * 100)}%`;
}

async function triggerIntervention() {
  clearTimers();
  const content = document.getElementById('intervention-content');
  const resumeBtn = document.getElementById('resume-btn');
  resumeBtn.disabled = true;
  
  content.innerHTML = '<div style="text-align:center; padding: 40px"><div class="empty-icon">🤖</div><h3>Generating quiz...</h3><p style="color:var(--text-muted)">The AI is analyzing your materials.</p></div>';
  showSessionPhase('intervention');

  let aiQuestion = null;
  try {
    const res = await apiFetch(`/api/session/question?user_id=${state.userId}&topic=${encodeURIComponent(state.session.topic)}`);
    aiQuestion = res;
  } catch (e) {
    console.log("Fallback to static question");
  }

  const pick = aiQuestion || INTERVENTIONS[Math.floor(Math.random() * INTERVENTIONS.length)];

  if (pick.type === 'mcq') {
    let answered = false;
    content.innerHTML = `
      <div style="font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:16px">Generated MCQ</div>
      <div style="font-size:18px; font-weight:700; margin-bottom:24px; line-height:1.5">${pick.question}</div>
      ${pick.options.map((opt, i) => `
        <button class="mcq-option" id="mcq-opt-${i}" onclick="answerMCQ(${i}, ${pick.answer})">
          <span style="font-family:var(--font-mono); margin-right:10px; opacity:0.5">${String.fromCharCode(65+i)}.</span>${opt}
        </button>`).join('')}
      <div id="mcq-result" class="mcq-result" style="display:none"></div>`;
  } else {
    let flipped = false;
    content.innerHTML = `
      <div style="font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:16px">Generated Flashcard</div>
      <div class="flashcard" id="flashcard" onclick="flipCard('${(pick.back || '').replace(/'/g, "\\'")}')">
        ${pick.front}
      </div>
      <div style="text-align:center; margin-top:12px; font-size:13px; color:var(--text-muted)" id="flip-hint">Click card to reveal answer</div>`;
    setTimeout(() => { resumeBtn.disabled = false; }, 1000);
  }
}

function answerMCQ(chosen, correct) {
  const opts = document.querySelectorAll('.mcq-option');
  opts.forEach((o, i) => {
    o.disabled = true;
    if (i === correct) o.classList.add('correct');
    else if (i === chosen) o.classList.add('wrong');
  });
  const res = document.getElementById('mcq-result');
  res.style.display = '';
  res.textContent = chosen === correct ? '✅ Correct! Great job staying sharp!' : `❌ Correct answer: ${document.querySelectorAll('.mcq-option')[correct].textContent.trim()}`;
  document.getElementById('resume-btn').disabled = false;
}

function flipCard(back) {
  const card = document.getElementById('flashcard');
  card.textContent = back;
  document.getElementById('flip-hint').textContent = '✅ Got it! Ready to resume.';
  document.getElementById('resume-btn').disabled = false;
}

function resumeSession() {
  state.session.lastActivity = Date.now();
  state.session.idleTime = 0;
  showSessionPhase('running');

  const s = state.session;
  s.timerInterval = setInterval(() => {
    s.timeLeft--;
    s.elapsed++;
    document.getElementById('timer-display').textContent = formatTime(s.timeLeft);
    document.getElementById('live-elapsed').textContent = formatTime(s.elapsed);
    const pct = ((s.duration * 60 - s.timeLeft) / (s.duration * 60)) * 100;
    document.getElementById('session-progress').style.width = pct + '%';
    if (s.timeLeft <= 0) { clearTimers(); goToFeedback(); }
  }, 1000);

  s.focusInterval = setInterval(checkFocus, 60000);
}

function endEarly() {
  clearTimers();
  state.session.completed = false;
  goToFeedback();
}

function goToFeedback() {
  clearTimers();
  const s = state.session;
  document.getElementById('fb-topic').textContent = s.topic;
  document.getElementById('fb-time').textContent = formatTime(s.elapsed);
  document.getElementById('fb-focus').textContent = s.focusResult
    ? (s.focusResult.focused ? '✅ Focused' : '⚠️ Distracted') : 'Not checked';
  showSessionPhase('feedback');
}

let fbDifficulty = 'easy';
let fbCompleted = true;

function setDiff(d) {
  fbDifficulty = d;
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.className = b.dataset.d === d ? 'btn btn-primary diff-btn' : 'btn btn-outline diff-btn';
  });
}

function setCompleted(val) {
  fbCompleted = val;
  document.getElementById('comp-yes').className = val ? 'btn btn-success' : 'btn btn-outline';
  document.getElementById('comp-no').className = !val ? 'btn btn-danger' : 'btn btn-outline';
}

async function submitFeedback() {
  const s = state.session;
  const accuracy = parseInt(document.getElementById('acc-range').value) / 100;
  const focusScore = s.focusResult ? (s.focusResult.focused ? s.focusResult.confidence : 1 - s.focusResult.confidence) : 0.5;

  try {
    const res = await apiFetch('/api/session/feedback', 'POST', {
      user_id: state.userId,
      topic: s.topic,
      time_taken: s.elapsed / 60,
      difficulty_rating: fbDifficulty,
      completed: fbCompleted,
      focus_score: focusScore,
      accuracy
    });

    const diff = res.next_difficulty || 'medium';
    const badge = document.getElementById('rec-badge');
    badge.textContent = diff;
    badge.className = 'badge badge-' + diff;
    document.getElementById('rec-msg').textContent =
      diff === 'hard' ? "You're performing well! Push yourself with harder material." :
      diff === 'easy' ? "Take it easy. Consolidate fundamentals before moving on." :
      "You're at a good pace. Keep going with medium difficulty.";

    s.prevFocusScore = focusScore;
    showToast(`🔥 Session logged! Streak: ${res.streak}`);
    showSessionPhase('done');
  } catch (e) {
    showToast('Failed to save session');
  }
}

function resetSession() {
  clearTimers();
  document.removeEventListener('click', trackActivity);
  document.removeEventListener('keydown', trackActivity);
  document.removeEventListener('mousemove', trackActivity);
  state.session.setupTime = Date.now();
  state.session.focusResult = null;
  document.getElementById('session-topic').value = '';
  document.getElementById('dur-range').value = 10;
  document.getElementById('dur-label').textContent = '10 minutes';
  // Reset focus ring
  const ring = document.getElementById('focus-ring');
  ring.className = 'focus-ring focus-waiting';
  ring.textContent = '–';
  document.getElementById('focus-status-text').textContent = '⏳ Awaiting first check';
  document.getElementById('focus-status-sub').textContent = 'ML model checks every 60s';
  showSessionPhase('setup');
}

function showSessionPhase(phase) {
  ['setup','running','intervention','feedback','done'].forEach(p => {
    document.getElementById('session-' + p).style.display = p === phase ? '' : 'none';
  });
}

function clearTimers() {
  const s = state.session;
  clearInterval(s.timerInterval);
  clearInterval(s.idleInterval);
  clearInterval(s.focusInterval);
  clearTimeout(s.focusTimeout);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error('API error ' + res.status);
  return res.json();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.style.display = 'none', 3000);
}
