// Game state (supports 2–8 players and configurable rounds)
const gameState = {
    players: [], // [{id, name, score, startTime, answerSeconds, elements}]
    currentQuestion: null,
    currentRound: 1,
    totalRounds: 5,
    playerCount: 2,
    countdown: 5,
    countdownInterval: null,
    roundTimeoutId: null,
    questionIndex: 0,
    isCountdownRunning: false,
    questions: []
};

// DOM Elements
const configScreen = document.getElementById('config-screen');
const gameScreen = document.getElementById('game-screen');
const startBtn = document.getElementById('start-btn');
const playerCountSelect = document.getElementById('player-count');

//eliminate rounds and make questions continuous
//const roundCountSelect = document.getElementById('round-count');


const questionElement = document.getElementById('question');
const timerElement = document.getElementById('timer');
const playersContainer = document.getElementById('players-container');
const resultElement = document.getElementById('result');
const resultText = document.getElementById('result-text');
const resultTable = document.getElementById('result-table');
const nextBtn = document.getElementById('next-btn');
const waitingOverlay = document.getElementById('waiting-overlay');
const versionBadge = document.getElementById('version-badge');
const playerNamesContainer = document.getElementById('player-names');
const hardModeCheckbox = document.getElementById('hard-mode');

// Render \n as line breaks in result text
resultText.classList.add('nl-preline');

// ── Global Error Handlers ────────────────────────────────────────
// Capture uncaught errors and unhandled promise rejections
window.addEventListener('error', (e) => {
    if (typeof logError === 'function') {
        logError('window.onerror', e.message || 'Unknown error', {
            filename: e.filename, lineno: e.lineno, colno: e.colno
        }, 'critical');
    }
});
window.addEventListener('unhandledrejection', (e) => {
    if (typeof logError === 'function') {
        logError('unhandledrejection', String(e.reason || 'Unknown rejection'), {}, 'critical');
    }
});

// Cookie utilities
function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
    const cookies = document.cookie.split('; ');
    for (const cookie of cookies) {
        const [key, val] = cookie.split('=');
        if (decodeURIComponent(key) === name) {
            return decodeURIComponent(val);
        }
    }
    return null;
}

function savePlayerConfigToCookies() {
    const count = playerCountSelect ? playerCountSelect.value : '1';
    setCookie('playerCount', count);
    const names = [];
    for (let i = 1; i <= 8; i++) {
        const inp = document.getElementById(`player-name-${i}`);
        names.push(inp ? inp.value : '');
    }
    setCookie('playerNames', JSON.stringify(names));
}

function loadPlayerConfigFromCookies() {
    const count = getCookie('playerCount');
    if (count && playerCountSelect) {
        playerCountSelect.value = count;
    }
    const namesJson = getCookie('playerNames');
    if (namesJson) {
        try {
            const names = JSON.parse(namesJson);
            if (Array.isArray(names)) {
                // Store for use after inputs are rendered
                window._savedPlayerNames = names;
            }
        } catch (_) {}
    }
}

// Utilities
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Load and render version badge from version.json (latest commit timestamp)
async function loadVersionBadge() {
    if (!versionBadge) return;
    try {
        const res = await fetch('version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        // Expecting { timestamp: "ISO-8601" }
        const ts = data && (data.timestamp || data.ts || data.date);
        if (ts) {
            versionBadge.textContent = ts;
            // Apply cache-busting to styles.css using this timestamp
            const link = document.querySelector('link[rel="stylesheet"][href$="styles.css"]');
            if (link) {
                const base = 'styles.css';
                const newHref = `${base}?v=${encodeURIComponent(ts)}`;
                // Only update if different to avoid unnecessary reloads
                if (!link.href.endsWith(newHref)) {
                    link.href = newHref;
                }
            }
        }
    } catch (err) {
        // Badge will remain empty if not available (e.g., local dev)
        if (typeof logError === 'function') logError('game.js:loadVersionBadge', err.message, {}, 'warn');
    }
}

// Questions are embedded in gameState.questions

// Bright distinct colors for up to 8 players
const PLAYER_COLORS = [
'#e90600',  // red
'#F27622',  // orange
'#131541',  // dark blue
'#46A1D9',  //light blue
'#FBE348',  //yellow
'#1A626A',  //green
'#8e24aa',  // purple
'#7cb342'   // lime
];

function idealTextColor(bgHex) {
    // Compute YIQ contrast
    const hex = bgHex.replace('#','');
    const r = parseInt(hex.substring(0,2),16);
    const g = parseInt(hex.substring(2,4),16);
    const b = parseInt(hex.substring(4,6),16);
    const yiq = ((r*299)+(g*587)+(b*114))/1000;
    return yiq >= 160 ? '#202124' : '#ffffff';
}

function resetPlayersRuntimeState() {
    gameState.players.forEach(p => {
        p.startTime = null;
        p.answerSeconds = null;
        if (p.elements) {
            p.elements.button.classList.remove('active', 'correct', 'incorrect');
        }
    });
}

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function setPlayerPositionFromClient(p, clientX, clientY) {
    const rect = playersContainer.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const nx = rect.width > 0 ? (x / rect.width) : 0.5;
    const ny = rect.height > 0 ? (y / rect.height) : 0.5;
    p.customPos = { x: clamp(nx, 0, 1), y: clamp(ny, 0, 1) };
    layoutPlayers();
}

// Initialize game with config
async function initGameFromConfig() {
    gameState.playerCount = parseInt(playerCountSelect.value, 10);
    //gameState.totalRounds = parseInt(roundCountSelect.value, 10);
    gameState.totalRounds = 1000;
    gameState.currentRound = 1;
    gameState.questionIndex = 0;
    gameState.players = [];

    // Prepare questions — respects unlock status, custom sets, and hard mode
    let questionsLoaded = false;

    // Try the new getQuestionSource() first, fall back to getQuestionFile()
    if (typeof getQuestionSource === 'function') {
        const source = getQuestionSource();
        if (source.type === 'custom' && source.setId && typeof loadQuestionSetItems === 'function') {
            try {
                const { data: items, error } = await loadQuestionSetItems(source.setId);
                if (!error && items && items.length > 0) {
                    gameState.questions = items.map(item => ({
                        question: item.question,
                        answer: item.answer
                    }));
                    questionsLoaded = true;
                }
            } catch (e) {
                console.warn('Failed to load custom questions, falling back to built-in', e);
            }
        }
        if (!questionsLoaded && source.type === 'db' && typeof loadGameQuestions === 'function') {
            try {
                const { data, error } = await loadGameQuestions(source.category);
                if (!error && data && data.length > 0) {
                    gameState.questions = data;
                    questionsLoaded = true;
                }
            } catch (e) {
                console.warn('Failed to load DB questions, falling back to file', e);
            }
        }
        if (!questionsLoaded && source.type === 'file') {
            try {
                const res = await fetch(source.file, { cache: 'no-store' });
                if (!res.ok) {
                    if (typeof logError === 'function') logError('game.js:initGameFromConfig:fetchFile', `HTTP ${res.status} for ${source.file}`);
                    gameState.questions = [];
                } else {
                    const data = await res.json();
                    gameState.questions = Array.isArray(data) ? data : [];
                    questionsLoaded = true;
                }
            } catch (e) {
                if (typeof logError === 'function') logError('game.js:initGameFromConfig:fetchFile', e.message, { file: source.file });
                gameState.questions = [];
            }
        }
    }

    // Final fallback: use getQuestionFile() or default
    if (!questionsLoaded) {
        const questionsFile = (typeof getQuestionFile === 'function') ? getQuestionFile() :
            ((hardModeCheckbox && hardModeCheckbox.checked) ? 'hard+questions.json' : 'questions.json');
        try {
            const res = await fetch(questionsFile, { cache: 'no-store' });
            if (!res.ok) {
                if (typeof logError === 'function') logError('game.js:initGameFromConfig:fetchFallback', `HTTP ${res.status} for ${questionsFile}`);
                gameState.questions = [];
            } else {
                const data = await res.json();
                gameState.questions = Array.isArray(data) ? data : [];
            }
        } catch (e) {
            if (typeof logError === 'function') logError('game.js:initGameFromConfig:fetchFallback', e.message, { file: questionsFile });
            gameState.questions = [];
        }
    }
    gameState.questions = shuffleArray([...gameState.questions]);

    // Insert mandatory tutorial question at the start
    const tutorialQuestion = {
        question: "Put your finger on your button and let go 3 seconds after WAITING appears. Closest to 3 seconds wins the round!",
        answer: 3
    };
    gameState.questions.unshift(tutorialQuestion);

    // Render players dynamically
    playersContainer.innerHTML = '';
    for (let i = 1; i <= gameState.playerCount; i++) {
        // Resolve player name from config inputs (max 25 chars), fallback to default
        let resolvedName = `Player ${i}`;
        if (playerNamesContainer) {
            const input = document.getElementById(`player-name-${i}`);
            if (input) {
                const v = (input.value || '').trim().slice(0, 25);
                if (v.length > 0) resolvedName = v;
            }
        }
        const player = {
            id: i,
            name: resolvedName,
            score: 0,
            startTime: null,
            answerSeconds: null,
            elements: {}
        };

        const playerEl = document.createElement('div');
        playerEl.className = 'player';
        playerEl.id = `player${i}`;

        const buttonEl = document.createElement('div');
        buttonEl.className = 'player-button';
        buttonEl.id = `player${i}-btn`;
        buttonEl.innerHTML = `<span>${player.name}</span><div class="hold-feedback">Hold Here</div>`;
        // Assign unique bright color
        const bg = PLAYER_COLORS[(i-1) % PLAYER_COLORS.length];
        buttonEl.style.backgroundColor = bg;
        buttonEl.style.color = idealTextColor(bg);

        //Removed score from player button
        //const scoreEl = document.createElement('div');
        //scoreEl.className = 'score';
        //scoreEl.innerHTML = `Score: <span>0</span>`;

        playerEl.appendChild(buttonEl);
        //playerEl.appendChild(scoreEl);
        playersContainer.appendChild(playerEl);


        //player.elements = { root: playerEl, button: buttonEl, scoreValue: scoreEl.querySelector('span') };
        player.elements = { root: playerEl, button: buttonEl };

        gameState.players.push(player);
    }

    updateScores();
    layoutPlayers();
    showQuestion();
}

// Show a question for the current round
function showQuestion() {
    if (gameState.currentRound > gameState.totalRounds) {
        endGame();
        return;
    }

    // Guest users: after exhausting all guest questions, prompt for unlock
    if (typeof isGuestUser === 'function' && isGuestUser() &&
        gameState.questionIndex >= gameState.questions.length) {
        promptUnlock();
        return;
    }

    if (gameState.questionIndex >= gameState.questions.length) {
        // Reshuffle or reset questions if we run out
        gameState.questions = shuffleArray([...gameState.questions]);
        gameState.questionIndex = 0;
    }

    gameState.currentQuestion = gameState.questions[gameState.questionIndex];
    //questionElement.textContent = `Round ${gameState.currentRound} of ${gameState.totalRounds}: ${gameState.currentQuestion.question}`;
    questionElement.textContent = `${gameState.currentQuestion.question}`;

    // Reset player states and UI
    resultElement.classList.add('hidden');
    resetPlayersRuntimeState();
    // Ensure player buttons are visible for the new round
    playersContainer.classList.remove('hidden');

    // Require all players to be holding before countdown starts
    beginHoldToStart();
}

function startCountdown() {
    if (gameState.isCountdownRunning) return;
    gameState.isCountdownRunning = true;
    gameState.countdown = 3;
    timerElement.textContent = gameState.countdown;
    timerElement.style.display = 'block';

    // Keep buttons interactive so we can detect releases during countdown

    if (gameState.countdownInterval) clearInterval(gameState.countdownInterval);
    gameState.countdownInterval = setInterval(() => {
        gameState.countdown--;
        if (gameState.countdown <= 0) {
            clearInterval(gameState.countdownInterval);
            timerElement.style.display = 'none';
            // Clean up any ready/hold listeners before starting the round
            cleanupReadyListeners();
            gameState.isCountdownRunning = false;
            startRound();
            return;
        }
        timerElement.textContent = gameState.countdown;
    }, 1000);
}

// Block multi-touch gestures during hold phase
function onGestureStart(e) {
    if (e.cancelable) e.preventDefault();
}
function onMultiTouchMove(e) {
    if (e.touches && e.touches.length > 1 && e.cancelable) {
        e.preventDefault();
    }
}

// Pre-round: wait until all players are actively holding their buttons
function beginHoldToStart() {
    // Block multi-touch gestures while holding/moving buttons
    document.addEventListener('gesturestart', onGestureStart, { passive: false });
    document.addEventListener('touchmove', onMultiTouchMove, { passive: false });

    // Initialize per-player ready state and attach listeners
    gameState.players.forEach(p => {
        p.isHolding = false;
        const btn = p.elements.button;
        btn.style.pointerEvents = 'auto';

        const onReadyPointerDown = (e) => {
            if (e.cancelable) e.preventDefault();
            p.isHolding = true;
            btn.classList.add('active');
            p._holdingPointerId = e.pointerId;
            try { btn.setPointerCapture(e.pointerId); } catch (_) {}
            setPlayerPositionFromClient(p, e.clientX, e.clientY);
            checkAllHoldingAndMaybeStart();
        };

        const onReadyPointerMove = (e) => {
            if (!p.isHolding) return;
            if (p._holdingPointerId !== e.pointerId) return;
            if (e.cancelable) e.preventDefault();
            setPlayerPositionFromClient(p, e.clientX, e.clientY);
        };

        const onReadyPointerUp = (e) => {
            if (p._holdingPointerId !== e.pointerId) return;
            if (e.cancelable) e.preventDefault();
            p.isHolding = false;
            btn.classList.remove('active');
            p._holdingPointerId = null;
            if (gameState.isCountdownRunning) {
                cancelCountdownAndResumeHold();
            }
        };

        const onReadyPointerCancel = (e) => {
            if (p._holdingPointerId !== e.pointerId) return;
            if (e.cancelable) e.preventDefault();
            p.isHolding = false;
            btn.classList.remove('active');
            p._holdingPointerId = null;
            if (gameState.isCountdownRunning) {
                cancelCountdownAndResumeHold();
            }
        };

        p._readyListeners = { onReadyPointerDown, onReadyPointerMove, onReadyPointerUp, onReadyPointerCancel };

        btn.addEventListener('pointerdown', onReadyPointerDown, { passive: false });
        btn.addEventListener('pointermove', onReadyPointerMove, { passive: false });
        btn.addEventListener('pointerup', onReadyPointerUp, { passive: false });
        btn.addEventListener('pointercancel', onReadyPointerCancel, { passive: false });
    });
}

function cleanupReadyListeners() {
    // Remove multi-touch gesture blockers
    document.removeEventListener('gesturestart', onGestureStart);
    document.removeEventListener('touchmove', onMultiTouchMove);

    gameState.players.forEach(p => {
        const btn = p.elements.button;
        if (p._readyListeners) {
            const { onReadyPointerDown, onReadyPointerMove, onReadyPointerUp, onReadyPointerCancel } = p._readyListeners;
            btn.removeEventListener('pointerdown', onReadyPointerDown);
            btn.removeEventListener('pointermove', onReadyPointerMove);
            btn.removeEventListener('pointerup', onReadyPointerUp);
            btn.removeEventListener('pointercancel', onReadyPointerCancel);
            delete p._readyListeners;
        }
    });
}

function cancelCountdownAndResumeHold() {
    if (!gameState.isCountdownRunning) return;
    if (gameState.countdownInterval) {
        clearInterval(gameState.countdownInterval);
        gameState.countdownInterval = null;
    }
    gameState.isCountdownRunning = false;
    timerElement.style.display = 'none';
    // Continue waiting; listeners remain so once all are holding, countdown restarts
}

function cleanupRoundListeners() {
    gameState.players.forEach(p => {
        const btn = p.elements.button;
        if (p._listeners) {
            const { onEnd } = p._listeners;
            btn.removeEventListener('touchend', onEnd);
            btn.removeEventListener('touchcancel', onEnd);
            btn.removeEventListener('mouseup', onEnd);
            delete p._listeners;
        }
    });
}

function checkAllHoldingAndMaybeStart() {
    const allHolding = gameState.players.every(p => p.isHolding === true);
    if (allHolding) {
        startCountdown();
    }
}

function startRound() {
    // Show waiting overlay and invert colors during the round timing phase
    gameScreen.classList.add('invert-colors');
    waitingOverlay.classList.remove('hidden');
    // Enable buttons and attach handlers
    gameState.players.forEach(p => {
        const btn = p.elements.button;
        btn.style.pointerEvents = 'auto';
        btn.classList.add('active');
        p.startTime = Date.now();

        const onEnd = (e) => {
            if (e.cancelable) e.preventDefault();
            if (p.startTime) {
                const endTime = Date.now();
                const duration = (endTime - p.startTime) / 1000;
                // record to 0.01s precision but we will compare against integer answers
                p.answerSeconds = Math.round(duration * 100) / 100;
                maybeFinishRound();
            }
            btn.classList.remove('active');
        };

        // Store listeners so we can remove if needed
        p._listeners = { onEnd };

        btn.addEventListener('touchend', onEnd, { passive: false, once: true });
        btn.addEventListener('touchcancel', onEnd, { passive: false, once: true });
        btn.addEventListener('mouseup', onEnd, { once: true });
    });

    // Safety timeout to ensure round ends even if someone doesn't release
    if (gameState.roundTimeoutId) clearTimeout(gameState.roundTimeoutId);
    gameState.roundTimeoutId = setTimeout(() => {
        maybeFinishRound(true);
    }, 35000); // 35 seconds max per round
}

function maybeFinishRound(force = false) {
    const allAnswered = gameState.players.every(p => p.answerSeconds !== null);
    if (!allAnswered && !force) return;

    if (gameState.roundTimeoutId) {
        clearTimeout(gameState.roundTimeoutId);
        gameState.roundTimeoutId = null;
    }
    // Ensure no stale event listeners linger into the next phase
    cleanupRoundListeners();
    // Hide waiting overlay and restore colors now that round is ending
    gameScreen.classList.remove('invert-colors');
    waitingOverlay.classList.add('hidden');
    // Hide player buttons until the next question is displayed
    playersContainer.classList.add('hidden');
    evaluateRound();
}

function evaluateRound() {
    const correct = gameState.currentQuestion.answer; // integer <= 30
    const EPS = 1e-6;

    // Collect results with diffs for players who answered
    const answered = gameState.players
        .filter(p => p.answerSeconds !== null)
        .map(p => ({
            player: p,
            time: p.answerSeconds,
            diff: Math.abs(p.answerSeconds - correct)
        }))
        .sort((a, b) => a.diff - b.diff);

    // Group by equal diff (ties) in sorted order
    let firstGroup = [];
    let secondGroup = [];
    const groups = [];
    if (answered.length > 0) {
        let currentGroup = [answered[0]];
        for (let i = 1; i < answered.length; i++) {
            if (Math.abs(answered[i].diff - answered[i - 1].diff) < EPS) {
                currentGroup.push(answered[i]);
            } else {
                groups.push(currentGroup);
                currentGroup = [answered[i]];
            }
        }
        groups.push(currentGroup);
        firstGroup = groups[0] || [];
        secondGroup = groups[1] || [];
    }

    // Scoring: descending points to all who answered.
    // Top group gets N points (N = number of answered), next gets N - groupSize(previous), etc.
    const N = answered.length;
    // Track per-player round points
    const roundPoints = new Map();
    gameState.players.forEach(p => roundPoints.set(p, 0));
    let rankIndex = 0; // counts how many players are ahead (used to compute points)
    groups.forEach(group => {
        const points = Math.max(0, N - rankIndex);
        group.forEach(r => {
            r.player.score += points;
            roundPoints.set(r.player, (roundPoints.get(r.player) || 0) + points);
        });
        rankIndex += group.length;
    });

    // Button highlighting: mark first place as correct; others as incorrect
    gameState.players.forEach(p => p.elements.button.classList.remove('correct', 'incorrect'));
    firstGroup.forEach(r => r.player.elements.button.classList.add('correct'));
    gameState.players.forEach(p => {
        if (!firstGroup.some(r => r.player === p)) {
            p.elements.button.classList.add('incorrect');
        }
    });

    // Results message: show all players' round points and cumulative totals
    const firstNames = firstGroup.map(r => r.player.name);
    const secondNames = secondGroup.map(r => r.player.name);
    let header;
    if (firstGroup.length === 0) {
        header = `Correct answer: ${correct}\nNo valid answers.`;
    } else if (secondGroup.length === 0) {
        const firstPts = N; // top group points
        header = `Correct answer: ${correct}\n${firstNames.join(', ')} win${firstNames.length > 1 ? '' : 's'} this round!`;
    } else {
        const firstPts = N;
        const secondPts = Math.max(0, N - firstGroup.length);
        header = `Correct answer: ${correct}\n${firstNames.join(', ')} win${firstNames.length > 1 ? '' : 's'} this round!`;
    }

    // Order: answering players by rank, then non-answers (0 pts)
    /*
    const answeredPlayersInOrder = answered.map(r => r.player);
    const nonAnsweredPlayers = gameState.players.filter(p => !answeredPlayersInOrder.includes(p));
    const displayOrder = [...answeredPlayersInOrder, ...nonAnsweredPlayers];
    const lines = displayOrder.map(p => `${p.name}: +${roundPoints.get(p)} (Total ${p.score % 1 === 0 ? p.score : p.score.toFixed(1)})`);
    const msg = `${header}\n\nRound points and totals:\n` + lines.join('\n');
    resultText.textContent = msg;
    */
    resultText.textContent = header;
    // Update scoreboard
    updateScores();

    // Populate compact results table (overall standings) with per-round details
    if (resultTable) {
        // Build a player -> diff map for this round (seconds off)
        const diffMap = new Map();
        answered.forEach(r => diffMap.set(r.player, r.diff));

        const header = `<tr><th></th><th>Player</th><th style="text-align:center">Points</th><th style="text-align:right">Time</th></tr>`;
        const standings = [...gameState.players].sort((a, b) => (roundPoints.get(b) || 0) - (roundPoints.get(a) || 0));
        const rows = standings
            .map((p, idx) => {
                const round = (roundPoints.get(p) || 0);
                const heldTime = p.answerSeconds !== null ? p.answerSeconds.toFixed(2) : '-';
                const playerColor = PLAYER_COLORS[(p.id - 1) % PLAYER_COLORS.length];
                //const total = p.score % 1 === 0 ? p.score : p.score.toFixed(1);
                return `<tr><td><div style="width:16px;height:16px;border-radius:3px;background:${playerColor}"></div></td><td>${p.name}</td><td style="text-align:center">${round}</td><td style="text-align:right">${heldTime}</td></tr>`;
            })
            .join('');
        resultTable.innerHTML = header + rows;
    }

    // Disable buttons till next
    gameState.players.forEach(p => { p.elements.button.style.pointerEvents = 'none'; });

    // Show results and next button
    resultElement.classList.remove('hidden');

    // Prepare for next round
    nextBtn.textContent = (gameState.currentRound >= gameState.totalRounds) ? 'See Results' : 'Next Question';
}

function updateScores() {
    gameState.players.forEach(p => {
        //p.elements.scoreValue.textContent = `${p.score % 1 === 0 ? p.score : p.score.toFixed(1)}`;
    });
}

function nextQuestion() {
    // Advance round and question index
    gameState.currentRound++;
    gameState.questionIndex++;
    showQuestion();
}

function endGame() {
    // Determine winners by score
    const topScore = Math.max(...gameState.players.map(p => p.score));
    const champs = gameState.players.filter(p => Math.abs(p.score - topScore) < 1e-6);
    let summary = 'Game Over!\n\n';
    if (champs.length === 1) {
        summary += `${champs[0].name} wins with ${champs[0].score % 1 === 0 ? champs[0].score : champs[0].score.toFixed(1)} points!`;
    } else {
        summary += `Tie between ${champs.map(c => c.name).join(', ')} with ${topScore % 1 === 0 ? topScore : topScore.toFixed(1)} points!`;
    }
    summary += '\n\nFinal Scores:\n' + gameState.players.map(p => `${p.name}: ${p.score % 1 === 0 ? p.score : p.score.toFixed(1)}`).join('\n');

    questionElement.textContent = summary;
    resultElement.classList.add('hidden');

    nextBtn.textContent = 'Play Again';
    nextBtn.onclick = () => {
        // Return to config screen (use showScreen if available from auth.js)
        if (typeof showScreen === 'function') {
            showScreen('config-screen');
        } else {
            gameScreen.classList.add('hidden');
            configScreen.classList.remove('hidden');
        }
    };
    resultElement.classList.remove('hidden');
}

// Event Listeners
startBtn.addEventListener('click', async () => {
    try {
        configScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        await initGameFromConfig();
    } catch (err) {
        if (typeof logError === 'function') logError('game.js:startBtn:click', err.message, { stack: err.stack }, 'critical');
        // Fallback: return to config screen
        gameScreen.classList.add('hidden');
        configScreen.classList.remove('hidden');
    }
});

nextBtn.addEventListener('click', () => {
    if (gameState.currentRound >= gameState.totalRounds) {
        endGame();
    } else {
        nextQuestion();
    }
});

// Prevent context menu on long press
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
});

// Prevent scrolling on iOS during gameplay
document.body.addEventListener('touchmove', (e) => {
    // If a round is active (buttons enabled), prevent scroll
    const anyActive = gameState.players.some(p => p.startTime !== null && p.answerSeconds === null);
    if (anyActive && e.cancelable) e.preventDefault();
}, { passive: false });

// Layout players around the edge of the screen
function layoutPlayers() {
    const rect = playersContainer.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const buttonSize = Math.min(rect.width, rect.height) < 700 ? 110 : 120;
    // Base radius on the longest dimension so spacing uses as much perimeter as possible
    // Keep buttons within ~0.5 inches of the edge using CSS 96px/inch
    const INCH_PX = 96;
    const edgeInsetPx = Math.round(0.25 * INCH_PX);
    const buttonRadius = buttonSize / 2;
    const radius = Math.max(0, Math.max(cx, cy) - buttonRadius - edgeInsetPx);
    const n = gameState.players.length;
    if (n === 0) return;

    gameState.players.forEach((p, idx) => {
        let x;
        let y;
        if (p.customPos && typeof p.customPos.x === 'number' && typeof p.customPos.y === 'number') {
            x = rect.width * p.customPos.x;
            y = rect.height * p.customPos.y;
        } else {
            const angle = (idx / n) * Math.PI * 2 - Math.PI / 2; // start at top
            x = cx + radius * Math.cos(angle);
            y = cy + radius * Math.sin(angle);
        }

        // Clamp to keep fully inside the visible playersContainer
        const minX = buttonRadius + edgeInsetPx;
        const maxX = rect.width - buttonRadius - edgeInsetPx;
        const minY = buttonRadius + edgeInsetPx;
        const maxY = rect.height - buttonRadius - edgeInsetPx;
        if (x < minX) x = minX;
        if (x > maxX) x = maxX;
        if (y < minY) y = minY;
        if (y > maxY) y = maxY;

        if (p.customPos && rect.width > 0 && rect.height > 0) {
            p.customPos.x = clamp(x / rect.width, 0, 1);
            p.customPos.y = clamp(y / rect.height, 0, 1);
        }

        p.elements.root.style.left = `${x}px`;
        p.elements.root.style.top = `${y}px`;
    });
}

window.addEventListener('resize', () => {
    layoutPlayers();
});

// Kick off version badge load on startup
loadVersionBadge();

// Boot auth flow (shows auth screen first, then config on success)
if (typeof bootAuth === 'function') {
    bootAuth();
}

// Hook profile auto-save into config inputs
if (typeof initProfileHooks === 'function') {
    initProfileHooks();
}

// Render player name inputs according to selected player count
function renderPlayerNameInputs() {
    if (!playerNamesContainer) return;
    const count = parseInt(playerCountSelect.value, 10) || 0;
    // Preserve existing values when re-rendering
    const existing = new Map();
    Array.from(playerNamesContainer.querySelectorAll('input[type="text"]')).forEach(inp => {
        existing.set(inp.id, inp.value);
    });
    playerNamesContainer.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        // Create wrapper for color box + input
        const wrapper = document.createElement('div');
        wrapper.className = 'player-name-wrapper';

        // Create color indicator box
        const colorBox = document.createElement('div');
        colorBox.className = 'player-color-box';
        const bg = PLAYER_COLORS[(i - 1) % PLAYER_COLORS.length];
        colorBox.style.backgroundColor = bg;
        colorBox.style.outlineColor = bg;

        const inp = document.createElement('input');
        inp.type = 'text';
        inp.id = `player-name-${i}`;
        inp.maxLength = 25;
        inp.placeholder = `Player ${i}`;
        inp.style.borderColor = bg;
        if (existing.has(inp.id)) inp.value = existing.get(inp.id);

        wrapper.appendChild(colorBox);
        wrapper.appendChild(inp);
        playerNamesContainer.appendChild(wrapper);
    }
}

// Update inputs when player count changes
if (playerCountSelect) {
    playerCountSelect.addEventListener('change', () => {
        renderPlayerNameInputs();
        savePlayerConfigToCookies();
    });
}

// Load saved config from cookies on startup
loadPlayerConfigFromCookies();

// Initial render on load
renderPlayerNameInputs();

// Apply saved names after inputs are rendered
if (window._savedPlayerNames) {
    window._savedPlayerNames.forEach((name, idx) => {
        const inp = document.getElementById(`player-name-${idx + 1}`);
        if (inp && name) inp.value = name;
    });
    delete window._savedPlayerNames;
}

// Save names on input change
if (playerNamesContainer) {
    playerNamesContainer.addEventListener('input', savePlayerConfigToCookies);
}
