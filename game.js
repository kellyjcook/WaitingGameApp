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
    questions: [
        { question: "How many sides does a triangle have?", answer: 3 },
        { question: "How many colors are in a standard traffic light?", answer: 3 },
        { question: "How many continents are there in the world?", answer: 7 },
        { question: "How many days are there in a week?", answer: 7 },
        { question: "How many legs does a spider have?", answer: 8 },
        { question: "How many players on a basketball team on the court?", answer: 5 },
        { question: "How many strings does a standard guitar have?", answer: 6 },
        { question: "How many years are in a decade?", answer: 10 },
        { question: "How many sides does a hexagon have?", answer: 6 },
        { question: "How many planets are recognized in our solar system?", answer: 8 },
        { question: "How many months have 28 days?", answer: 12 },
        { question: "How many hours are in a day?", answer: 24 },
        { question: "How many vowels are in the English alphabet?", answer: 5 },
        { question: "How many letters are in the word 'cat'?", answer: 3 },
        { question: "How many seasons are there in a year?", answer: 4 },

        // Easy (33)
        { question: "How many fingers on one hand?", answer: 5 },
        { question: "How many toes on one foot?", answer: 5 },
        { question: "How many sides does a square have?", answer: 4 },
        { question: "How many corners does a rectangle have?", answer: 4 },
        { question: "How many wheels are on a tricycle?", answer: 3 },
        { question: "How many months are in a year?", answer: 12 },
        { question: "How many days are in a weekend?", answer: 2 },
        { question: "How many letters are in the word 'dog'?", answer: 3 },
        { question: "How many primary colors are in light (RGB)?", answer: 3 },
        { question: "How many primary colors are in paint (RYB)?", answer: 3 },
        { question: "How many points does a triangle have?", answer: 3 },
        { question: "How many sides does a rectangle have?", answer: 4 },
        { question: "How many even numbers are between 1 and 5 (exclusive)?", answer: 2 },
        { question: "How many eyes does a typical human have?", answer: 2 },
        { question: "How many ears does a typical human have?", answer: 2 },
        { question: "How many primary compass directions are there?", answer: 4 },
        { question: "How many quarters make a dollar?", answer: 4 },
        { question: "How many seasons are in 'The Four Seasons'?", answer: 4 },
        { question: "How many legs does a cat have?", answer: 4 },
        { question: "How many letters are in the word 'sun'?", answer: 3 },
        { question: "How many letters are in the word 'moon'?", answer: 4 },
        { question: "How many days are in February in a non-leap year?", answer: 28 },
        { question: "How many days are in February in a leap year?", answer: 29 },
        { question: "How many corners does a triangle have?", answer: 3 },
        { question: "How many sides does a pentagon have?", answer: 5 },
        { question: "How many sides does an octagon have?", answer: 8 },
        { question: "How many colors are in a rainbow?", answer: 7 },
        { question: "How many letters are in the word 'apple'?", answer: 5 },
        { question: "How many letters are in the word 'hello'?", answer: 5 },
        { question: "How many minutes are in half an hour?", answer: 30 },
        { question: "How many lines are in a haiku?", answer: 3 },
        { question: "How many strikes make an out in baseball?", answer: 3 },
        { question: "How many points is a field goal worth in American football?", answer: 3 },

        // Moderate (33)
        { question: "How many Great Lakes are there?", answer: 5 },
        { question: "How many players are on a soccer team on the field?", answer: 11 },
        { question: "How many players are on a baseball team on the field?", answer: 9 },
        { question: "How many months have 30 days?", answer: 4 },
        { question: "How many prime numbers are less than 20?", answer: 8 },
        { question: "How many letters are in the Greek alphabet?", answer: 24 },
        { question: "How many edges does a cube have?", answer: 12 },
        { question: "How many faces does a cube have?", answer: 6 },
        { question: "How many vertices does a cube have?", answer: 8 },
        { question: "How many sides does a dodecagon have?", answer: 12 },
        { question: "How many zodiac signs are there?", answer: 12 },
        { question: "How many hours are on a standard analog clock face?", answer: 12 },
        { question: "How many pawns does each player have in chess?", answer: 8 },
        { question: "How many squares are on one side of a chessboard?", answer: 8 },
        { question: "How many provinces are in Canada?", answer: 10 },
        { question: "How many amendments are in the U.S. Bill of Rights?", answer: 10 },
        { question: "How many gas giant planets are in our solar system?", answer: 4 },
        { question: "How many strings does a violin have?", answer: 4 },
        { question: "How many symphonies did Beethoven compose?", answer: 9 },
        { question: "How many keys are in a musical octave (Western)?", answer: 12 },
        { question: "How many cranial nerves are there?", answer: 12 },
        { question: "How many carpal bones are in one human wrist?", answer: 8 },
        { question: "How many colors are on the flag of the United States?", answer: 3 },
        { question: "How many stripes are on the flag of the United States?", answer: 13 },
        { question: "How many original American colonies were there?", answer: 13 },
        { question: "How many amendments does the U.S. Constitution have?", answer: 27 },
        { question: "How many member countries are in the European Union (2024)?", answer: 27 },
        { question: "How many letters are in the English alphabet?", answer: 26 },
        { question: "How many Olympic rings are there?", answer: 5 },
        { question: "How many continents border the Atlantic Ocean?", answer: 4 },
        { question: "How many bones are in the human middle and inner ear (ossicles)?", answer: 6 },
        { question: "How many sides does a heptagon have?", answer: 7 },
        { question: "How many protons are in a carbon atom?", answer: 6 },

        // Difficult (34)
        { question: "How many SI base units are there?", answer: 7 },
        { question: "How many Wonders of the Ancient World were there?", answer: 7 },
        { question: "How many traditional lunar phases are named?", answer: 8 },
        { question: "How many players are on a rugby union team on the field?", answer: 15 },
        { question: "How many lines are in a Shakespearean sonnet?", answer: 14 },
        { question: "How many Nobel Prize categories are awarded each year?", answer: 6 },
        { question: "How many official languages does the United Nations have?", answer: 6 },
        { question: "How many cervical vertebrae are in the human neck?", answer: 7 },
        { question: "How many planets were known to ancient astronomers?", answer: 5 },
        { question: "How many Pandava brothers are in the Mahabharata?", answer: 5 },
        { question: "How many books are in the Pentateuch?", answer: 5 },
        { question: "How many Gospels are in the New Testament?", answer: 4 },
        { question: "How many letters are in the Hebrew alphabet?", answer: 22 },
        { question: "How many letters are in the Arabic alphabet?", answer: 28 },
        { question: "How many major scales are there in Western music?", answer: 12 },
        { question: "How many teams are in a FIFA World Cup group?", answer: 4 },
        { question: "How many players are on a volleyball team on the court?", answer: 6 },
        { question: "How many squares are on a 4x4 grid?", answer: 16 },
        { question: "How many justices sit on the U.S. Supreme Court?", answer: 9 },
        { question: "How many apostles did Jesus have?", answer: 12 },
        { question: "How many labors did Hercules complete?", answer: 12 },
        { question: "How many animals are in the Chinese zodiac?", answer: 12 },
        { question: "How many events are in the Olympic decathlon?", answer: 10 },
        { question: "How many players are in a basketball starting lineup (one team)?", answer: 5 },
        { question: "How many cards are in a single suit in a standard deck?", answer: 13 },
        { question: "How many face cards are in a standard deck of cards?", answer: 12 },
        { question: "How many days are in September?", answer: 30 },
        { question: "How many minutes are in a quarter hour?", answer: 15 },
        { question: "How many semitones are in a perfect fifth?", answer: 7 },
        { question: "How many bones form the human thoracic vertebrae?", answer: 12 },
        { question: "How many edges does a regular tetrahedron have?", answer: 6 },
        { question: "How many faces does a regular octahedron have?", answer: 8 },
        { question: "How many corners (vertices) does a regular dodecahedron have?", answer: 20 },
        { question: "How many sides does a nonagon have?", answer: 9 },

    ]
};

// DOM Elements
const configScreen = document.getElementById('config-screen');
const gameScreen = document.getElementById('game-screen');
const startBtn = document.getElementById('start-btn');
const playerCountSelect = document.getElementById('player-count');
const roundCountSelect = document.getElementById('round-count');
const questionElement = document.getElementById('question');
const timerElement = document.getElementById('timer');
const playersContainer = document.getElementById('players-container');
const resultElement = document.getElementById('result');
const resultText = document.getElementById('result-text');
const resultTable = document.getElementById('result-table');
const nextBtn = document.getElementById('next-btn');
const waitingOverlay = document.getElementById('waiting-overlay');

// Render \n as line breaks in result text
resultText.classList.add('nl-preline');

// Utilities
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Questions are embedded in gameState.questions

// Bright distinct colors for up to 8 players
const PLAYER_COLORS = [
    '#e53935', // red
    '#1e88e5', // blue
    '#43a047', // green
    '#fdd835', // yellow
    '#8e24aa', // purple
    '#fb8c00', // orange
    '#00acc1', // cyan
    '#7cb342'  // lime
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

// Initialize game with config
function initGameFromConfig() {
    gameState.playerCount = parseInt(playerCountSelect.value, 10);
    gameState.totalRounds = parseInt(roundCountSelect.value, 10);
    gameState.currentRound = 1;
    gameState.questionIndex = 0;
    gameState.players = [];

    // Prepare questions
    gameState.questions = shuffleArray([...gameState.questions]);

    // Render players dynamically
    playersContainer.innerHTML = '';
    for (let i = 1; i <= gameState.playerCount; i++) {
        const player = {
            id: i,
            name: `Player ${i}`,
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

        const scoreEl = document.createElement('div');
        scoreEl.className = 'score';
        scoreEl.innerHTML = `Score: <span>0</span>`;

        playerEl.appendChild(buttonEl);
        playerEl.appendChild(scoreEl);
        playersContainer.appendChild(playerEl);

        player.elements = { root: playerEl, button: buttonEl, scoreValue: scoreEl.querySelector('span') };
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

    if (gameState.questionIndex >= gameState.questions.length) {
        // Reshuffle or reset questions if we run out
        gameState.questions = shuffleArray([...gameState.questions]);
        gameState.questionIndex = 0;
    }

    gameState.currentQuestion = gameState.questions[gameState.questionIndex];
    questionElement.textContent = `Round ${gameState.currentRound} of ${gameState.totalRounds}: ${gameState.currentQuestion.question}`;

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

// Pre-round: wait until all players are actively holding their buttons
function beginHoldToStart() {
    // Initialize per-player ready state and attach listeners
    gameState.players.forEach(p => {
        p.isHolding = false;
        const btn = p.elements.button;
        btn.style.pointerEvents = 'auto';

        const onReadyStart = (e) => {
            if (e.cancelable) e.preventDefault();
            p.isHolding = true;
            btn.classList.add('active');
            checkAllHoldingAndMaybeStart();
        };
        const onReadyEnd = (e) => {
            if (e.cancelable) e.preventDefault();
            p.isHolding = false;
            btn.classList.remove('active');
            // If someone lets go during countdown, cancel and wait again
            if (gameState.isCountdownRunning) {
                cancelCountdownAndResumeHold();
            }
        };

        // store so we can remove later
        p._readyListeners = { onReadyStart, onReadyEnd };

        btn.addEventListener('touchstart', onReadyStart, { passive: false });
        btn.addEventListener('touchend', onReadyEnd, { passive: false });
        btn.addEventListener('mousedown', onReadyStart);
        btn.addEventListener('mouseup', onReadyEnd);
        btn.addEventListener('mouseleave', onReadyEnd);
    });
}

function cleanupReadyListeners() {
    gameState.players.forEach(p => {
        const btn = p.elements.button;
        if (p._readyListeners) {
            const { onReadyStart, onReadyEnd } = p._readyListeners;
            btn.removeEventListener('touchstart', onReadyStart);
            btn.removeEventListener('touchend', onReadyEnd);
            btn.removeEventListener('mousedown', onReadyStart);
            btn.removeEventListener('mouseup', onReadyEnd);
            btn.removeEventListener('mouseleave', onReadyEnd);
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
                // record to 0.1s precision but we will compare against integer answers
                p.answerSeconds = Math.round(duration * 10) / 10;
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
        header = `Correct answer: ${correct}\n${firstNames.join(', ')} win${firstNames.length > 1 ? '' : 's'} this round! (${firstPts} pts)`;
    } else {
        const firstPts = N;
        const secondPts = Math.max(0, N - firstGroup.length);
        header = `Correct answer: ${correct}\n${firstNames.join(', ')} win${firstNames.length > 1 ? '' : 's'} this round! (${firstPts} pts)\nSecond: ${secondNames.join(', ')} (${secondPts} pts)`;
    }

    // Order: answering players by rank, then non-answers (0 pts)
    const answeredPlayersInOrder = answered.map(r => r.player);
    const nonAnsweredPlayers = gameState.players.filter(p => !answeredPlayersInOrder.includes(p));
    const displayOrder = [...answeredPlayersInOrder, ...nonAnsweredPlayers];
    const lines = displayOrder.map(p => `${p.name}: +${roundPoints.get(p)} (Total ${p.score % 1 === 0 ? p.score : p.score.toFixed(1)})`);
    const msg = `${header}\n\nRound points and totals:\n` + lines.join('\n');
    resultText.textContent = msg;

    // Update scoreboard
    updateScores();

    // Populate compact results table (only first and second groups)
    if (resultTable) {
        const header = `<tr><th>Rank</th><th>Player</th><th>Score</th></tr>`;
        const standings = [...gameState.players].sort((a, b) => b.score - a.score);
        const rows = standings
            .map((p, idx) => `<tr><td>${idx + 1}</td><td>${p.name}</td><td>${p.score % 1 === 0 ? p.score : p.score.toFixed(1)}</td></tr>`)
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
        p.elements.scoreValue.textContent = `${p.score % 1 === 0 ? p.score : p.score.toFixed(1)}`;
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
        // Return to config screen
        gameScreen.classList.add('hidden');
        configScreen.classList.remove('hidden');
    };
    resultElement.classList.remove('hidden');
}

// Event Listeners
startBtn.addEventListener('click', () => {
    configScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initGameFromConfig();
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
    const edgeInsetPx = Math.round(0.5 * INCH_PX);
    const buttonRadius = buttonSize / 2;
    const radius = Math.max(0, Math.max(cx, cy) - buttonRadius - edgeInsetPx);
    const n = gameState.players.length;
    if (n === 0) return;

    gameState.players.forEach((p, idx) => {
        const angle = (idx / n) * Math.PI * 2 - Math.PI / 2; // start at top
        let x = cx + radius * Math.cos(angle);
        let y = cy + radius * Math.sin(angle);

        // Clamp to keep fully inside the visible playersContainer
        const minX = buttonRadius + edgeInsetPx;
        const maxX = rect.width - buttonRadius - edgeInsetPx;
        const minY = buttonRadius + edgeInsetPx;
        const maxY = rect.height - buttonRadius - edgeInsetPx;
        if (x < minX) x = minX;
        if (x > maxX) x = maxX;
        if (y < minY) y = minY;
        if (y > maxY) y = maxY;

        p.elements.root.style.left = `${x}px`;
        p.elements.root.style.top = `${y}px`;
    });
}

window.addEventListener('resize', () => {
    layoutPlayers();
});
