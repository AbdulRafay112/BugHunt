// ---------- Tabs ----------
  const tabs = document.querySelectorAll('.tab');
  function showScreen(id) {
    tabs.forEach(x => x.setAttribute('aria-selected', String(x.getAttribute('aria-controls') === id)));
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    document.body.classList.toggle('game', id !== 's-login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  tabs.forEach(t => t.addEventListener('click', () => showScreen(t.getAttribute('aria-controls'))));

  // ---------- Login: team name and code only ----------
  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const err = document.getElementById('loginErr');
    err.textContent = '';
    const team = document.getElementById('teamName').value.trim();
    if (!team) return err.textContent = 'Enter your team name.';
    if (!document.getElementById('teamCode').value.trim()) return err.textContent = 'Enter your team code.';
    showScreen('s-arena');
  });

  // ---------- Timer and oxygen ----------
  let remaining = 60 * 60;
  const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  const timerEls = [document.getElementById('timer'), document.getElementById('boardTimer')];
  setInterval(() => {
    if (remaining > 0) remaining--;
    timerEls.forEach(el => { el.textContent = fmt(remaining); el.classList.toggle('low', remaining <= 300); });
  }, 1000);
  let oxy = 100;
  setInterval(() => {
    oxy = Math.max(0, oxy - 0.05);
    document.getElementById('oxyBar').style.width = oxy + '%';
    document.getElementById('oxyVal').textContent = Math.round(oxy) + '%';
  }, 1000);
  // ---------- Question bank ----------
  const BUGGY = `def average(nums):
    total = 0
    for i in range(1, len(nums)):
        total += nums[i]
    return total / len(nums)

# Expected: average([2, 4, 6]) == 4.0`;

  const QUESTIONS = Array.from({ length: 25 }, (_, i) => i === 0
    ? { id: 'q1', ready: true, title: 'Find the bug', prompt: 'This function should return the average of a list. It does not. Fix the smallest thing you can.',
        code: BUGGY, check: c => /range\(\s*len\(nums\)\s*\)/.test(c) && !/range\(\s*1\s*,/.test(c) }
    : { id: 'q' + (i + 1), ready: false, title: 'Question ' + (i + 1), prompt: 'Coming soon. This question is still being written.',
        code: '# Question ' + (i + 1) + ' is not ready yet.' });
  const QMAP = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

  // Five levels, five questions each. Colour per room.
  const LEVEL_DEFS = [
    { name: 'Oxygen bay', x: 50,  y: 150, color: '#5fd4ff' },
    { name: 'Hull',       x: 110, y: 150, color: '#b388ff' },
    { name: 'Engine core',x: 165, y: 95,  color: '#ffd166' },
    { name: 'Navigation', x: 225, y: 95,  color: '#ff7aa8' },
    { name: 'Bridge',     x: 275, y: 150, color: '#7cf0b5' }
  ];
  const LEVELS = LEVEL_DEFS.map((d, li) => ({ ...d, qs: QUESTIONS.slice(li * 5, li * 5 + 5).map(q => q.id) }));

  const S = { level: 0, qIdx: 0, solved: new Set(), cleared: new Set(), drafts: {}, wrong: 0 };
  const levelQs = li => LEVELS[li].qs.map(id => QMAP[id]);
  const maxUnlocked = () => { let m = 0; while (m < LEVELS.length - 1 && S.cleared.has(m)) m++; return m; };
  const currentQ = () => levelQs(S.level)[S.qIdx];

  // ---------- Helpers ----------
  const codeEl = document.getElementById('code');
  const gutter = document.getElementById('gutter');
  function paintLines() {
    const n = codeEl.value.split('\n').length;
    gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
  }
  function setNotice(t) { document.getElementById('notice').textContent = t; }
  function setMascot(text, mood) {
    document.getElementById('bubble').textContent = text;
    const m = document.getElementById('mascot');
    m.classList.remove('cheer'); void m.offsetWidth;
    if (mood === 'cheer') m.classList.add('cheer');
  }
  function confetti() {
    const colors = ['#b388ff', '#e2c8ff', '#7cf0b5', '#ffd166', '#ff7aa8'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('span');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
      c.style.animationDelay = Math.random() * 0.4 + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3600);
    }
  }

  // ---------- Astronaut jump (arc) between rooms ----------
  let astroPos = null, astroTarget = null;
  function moveAstro(toX, toY) {
    const el = document.getElementById('astroBadge');
    if (astroTarget && astroTarget.x === toX && astroTarget.y === toY) return;
    astroTarget = { x: toX, y: toY };
    if (!astroPos) { astroPos = { x: toX, y: toY }; el.style.transform = `translate(${toX}px, ${toY}px)`; return; }
    const from = { ...astroPos }, t0 = performance.now(), dur = 900;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const x = from.x + (toX - from.x) * e;
      const y = from.y + (toY - from.y) * e - Math.sin(Math.PI * p) * 46;
      el.style.transform = `translate(${x}px, ${y}px)`;
      if (p < 1) requestAnimationFrame(step); else astroPos = { x: toX, y: toY };
    };
    requestAnimationFrame(step);
  }

  // ---------- Rendering ----------
  function renderQuestion() {
    const q = currentQ();
    const solved = S.solved.has(q.id);
    document.getElementById('qTitle').textContent = q.title;
    document.getElementById('qPrompt').textContent = q.prompt;
    codeEl.value = S.drafts[q.id] ?? q.code;
    codeEl.readOnly = !q.ready;
    document.getElementById('submitBtn').disabled = !q.ready || solved;
    paintLines();

    const list = levelQs(S.level);
    document.getElementById('qCount').textContent = `Question ${S.qIdx + 1} of ${list.length}`;
    document.getElementById('prevQ').disabled = S.qIdx === 0;
    document.getElementById('nextQ').disabled = S.qIdx === list.length - 1;
    document.getElementById('roundLabel').textContent = `Round 01 · Level ${S.level + 1} of 5 · ${LEVELS[S.level].name}`;

    document.getElementById('chips').innerHTML = list.map((q, i) => {
      const cls = ['chip', i === S.qIdx ? 'on' : '', S.solved.has(q.id) ? 'solved' : ''].join(' ');
      return `<button class="${cls}" data-q="${i}" type="button">${S.solved.has(q.id) ? '✓ ' : ''}Q${i + 1}</button>`;
    }).join('');
    document.querySelectorAll('#chips .chip').forEach(b => b.addEventListener('click', () => { S.qIdx = +b.dataset.q; renderQuestion(); }));

    const results = document.getElementById('results');
    results.innerHTML = solved
      ? `<div class="test pass"><span>Solved. All checks passed for this question.</span><span class="tag">PASS</span></div>`
      : `<div class="test"><span>Test 1 · average([2, 4, 6])</span><span class="tag">Not run yet</span></div>
         <div class="test"><span>Test 2</span><span class="tag">Hidden</span></div>
         <div class="test"><span>Test 3</span><span class="tag">Hidden</span></div>`;
    setNotice(q.ready ? '' : 'This question is not ready yet. The next one will unlock when it is written.');
    renderBank();
    renderMap();
  }

  let bankOpen = false;
  function renderBank() {
    const toggle = document.getElementById('bankToggle');
    const panel = document.getElementById('bankPanel');
    toggle.textContent = `Question bank · ${QUESTIONS.length} questions ${bankOpen ? '▴' : '▾'}`;
    toggle.setAttribute('aria-expanded', String(bankOpen));
    panel.hidden = !bankOpen;
    panel.innerHTML = LEVELS.map((lvl, li) => {
      const isCur = li === S.level;
      const tag = S.cleared.has(li) ? 'cleared' : isCur ? 'current' : 'locked';
      const btns = lvl.qs.map((id, j) => {
        const n = li * 5 + j + 1;
        const solved = S.solved.has(id);
        const cls = ['qbtn', isCur && j === S.qIdx ? 'on' : '', solved ? 'solved' : ''].join(' ');
        return `<button class="${cls}" data-j="${j}" type="button" ${isCur ? '' : 'disabled'} aria-label="Question ${n}">${solved ? '✓ ' : ''}${n}</button>`;
      }).join('');
      return `<div class="bank-level"><div class="bank-title"><span>Level ${li + 1} · ${lvl.name}</span><span>${tag}</span></div><div class="bank-grid">${btns}</div></div>`;
    }).join('');
    panel.querySelectorAll('.qbtn:not([disabled])').forEach(b => b.addEventListener('click', () => { S.qIdx = +b.dataset.j; renderQuestion(); }));
  }

  function renderMap() {
    const unlocked = maxUnlocked();
    LEVELS.forEach((lvl, i) => {
      const g = document.getElementById('n' + (i + 1));
      const room = g.querySelector('.room');
      const txt = g.querySelector('.rtxt');
      const done = S.cleared.has(i), now = i === S.level, open = i <= unlocked;
      room.setAttribute('fill', lvl.color);
      room.setAttribute('stroke', lvl.color);
      if (done) {
        room.setAttribute('fill-opacity', '1');
        txt.textContent = '✓'; txt.setAttribute('fill', '#120a22');
      } else if (now) {
        room.setAttribute('fill-opacity', '.5');
        txt.textContent = String(i + 1); txt.setAttribute('fill', '#f3eefe');
      } else if (open) {
        room.setAttribute('fill-opacity', '.25');
        txt.textContent = String(i + 1); txt.setAttribute('fill', lvl.color);
      } else {
        room.setAttribute('fill-opacity', '.1');
        txt.textContent = '×'; txt.setAttribute('fill', lvl.color);
      }
      g.style.opacity = open ? '1' : '.45';
    });
    const cur = LEVELS[S.level];
    moveAstro(cur.x, cur.y - 32);
    const ring = document.getElementById('ring');
    ring.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
    ring.querySelector('circle').setAttribute('stroke', cur.color);
    document.getElementById('progress').textContent = `${S.cleared.size} of 5 levels cleared`;

    document.getElementById('levelList').innerHTML = LEVELS.map((l, i) => {
      const st = S.cleared.has(i) ? 'Cleared' : i === S.level ? 'Current' : i <= unlocked ? 'Open' : 'Locked';
      return `<button class="level ${i > unlocked ? 'locked' : ''}" data-lvl="${i}" type="button"><span><span class="sw" style="background:${l.color}"></span>${i + 1}. ${l.name}</span><span class="s">${st}</span></button>`;
    }).join('');
    document.querySelectorAll('#levelList .level').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.lvl;
      if (i > maxUnlocked()) return;
      S.level = i; S.qIdx = 0; renderQuestion();
    }));
  }

  // ---------- Navigation (only inside the current level) ----------
  document.getElementById('prevQ').addEventListener('click', () => { if (S.qIdx > 0) { S.qIdx--; renderQuestion(); } });
  document.getElementById('nextQ').addEventListener('click', () => { if (S.qIdx < levelQs(S.level).length - 1) { S.qIdx++; renderQuestion(); } });
  document.getElementById('bankToggle').addEventListener('click', () => { bankOpen = !bankOpen; renderBank(); });

  // ---------- Editor ----------
  codeEl.addEventListener('input', () => { S.drafts[currentQ().id] = codeEl.value; paintLines(); });
  codeEl.addEventListener('scroll', () => { gutter.scrollTop = codeEl.scrollTop; });
  document.getElementById('resetBtn').addEventListener('click', () => {
    const q = currentQ(); S.drafts[q.id] = q.code; codeEl.value = q.code; paintLines();
  });

  // ---------- Submit ----------
  const editorCard = document.getElementById('editorCard');
  document.getElementById('submitBtn').addEventListener('click', () => {
    const q = currentQ();
    if (!q.ready) return setNotice('This question is not ready yet.');
    if (q.check(codeEl.value)) {
      S.solved.add(q.id);
      document.getElementById('results').innerHTML = `<div class="test pass"><span>Test 1 · average([2, 4, 6])</span><span class="tag">PASS</span></div>
        <div class="test"><span>Test 2</span><span class="tag">Hidden · checked on server</span></div>
        <div class="test"><span>Test 3</span><span class="tag">Hidden · checked on server</span></div>`;
      setMascot('Nice fix! That room is humming again.', 'cheer');
      setNotice('Question solved.');
      checkLevelCleared();
      renderQuestion();
    } else {
      S.wrong++;
      document.getElementById('wrongCount').textContent = S.wrong;
      document.getElementById('results').innerHTML = `<div class="test fail"><span>Test 1 · average([2, 4, 6])</span><span class="tag">FAIL</span></div>
        <div class="test"><span>Test 2</span><span class="tag">Hidden</span></div>
        <div class="test"><span>Test 3</span><span class="tag">Hidden</span></div>`;
      setNotice('Wrong submission recorded. Penalty: TBA.');
      setMascot('Almost! Look closely at where the loop starts.', 'warn');
      editorCard.classList.remove('shake'); void editorCard.offsetWidth; editorCard.classList.add('shake');
    }
  });

  function checkLevelCleared() {
    const li = S.level;
    if (S.cleared.has(li)) return;
    const ready = levelQs(li).filter(q => q.ready);
    if (ready.length === 0 || !ready.every(q => S.solved.has(q.id))) return;
    S.cleared.add(li);
    confetti();
    if (li + 1 < LEVELS.length) {
      S.level = li + 1; S.qIdx = 0;
      setMascot(`Level cleared! Next stop: ${LEVELS[li + 1].name}.`, 'cheer');
    } else {
      setMascot('Ship repaired. Extraction in progress!', 'cheer');
    }
  }

  // ---------- Leaderboard (sample data) ----------
  const teams = [
    { name: 'Falcon Crew', r1: 42, r2: 30, time: '01:12:40' },
    { name: 'Nebula Nine', r1: 42, r2: 26, time: '01:08:15' },
    { name: 'Orbit Engineers', r1: 36, r2: 24, time: '01:02:03' },
    { name: 'Kepler Squad', r1: 30, r2: 18, time: '00:58:50' },
    { name: 'Apollo Byte', r1: 24, r2: 12, time: '00:49:21' }
  ].map(t => ({ ...t, total: t.r1 + t.r2 })).sort((a, b) => b.total - a.total || a.time.localeCompare(b.time));
  document.getElementById('lbBody').innerHTML = teams.map((t, i) => {
    const r = i + 1, cls = r <= 3 ? `r${r}` : '';
    return `<tr class="${cls}${t.name === 'Falcon Crew' ? ' me' : ''}">
      <td><span class="rank ${cls}">${r}</span>${r === 1 ? '<span class="crown">TOP</span>' : ''}</td>
      <td>${t.name}</td><td class="num">${t.r1}</td><td class="num">${t.r2}</td>
      <td class="num"><strong>${t.total}</strong></td><td class="num">${t.time}</td></tr>`;
  }).join('');

  // ---------- Start ----------
  renderQuestion();
