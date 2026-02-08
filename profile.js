// ── Profile / Preferences Bridge ────────────────────────────────────
// Bridges game.js config with Supabase-stored preferences.
// Falls back to cookies if auth is not available.

// Debounce timer for auto-saving preferences
let _saveDebounce = null;

// Save current config screen state to Supabase (or cookies as fallback)
function savePreferencesToCloud() {
    if (_saveDebounce) clearTimeout(_saveDebounce);
    _saveDebounce = setTimeout(async () => {
        const countSel = document.getElementById('player-count');
        const hardMode = document.getElementById('hard-mode');
        const count = countSel ? parseInt(countSel.value, 10) : 2;
        const names = [];
        for (let i = 1; i <= 8; i++) {
            const inp = document.getElementById(`player-name-${i}`);
            names.push(inp ? inp.value : '');
        }
        const hard = hardMode ? hardMode.checked : false;

        if (typeof savePreferences === 'function' && currentUser) {
            const prefsToSave = {
                default_player_count: count,
                player_names: names,
                hard_mode: hard
            };
            // Include active question set if available
            const qsetSel = document.getElementById('question-set-select');
            if (qsetSel) {
                prefsToSave.active_question_set = qsetSel.value || null;
            }
            await savePreferences(prefsToSave);
        }
        // Always save to cookies too as local fallback
        if (typeof savePlayerConfigToCookies === 'function') {
            savePlayerConfigToCookies();
        }
    }, 600);
}

// Determine the question source based on unlock status, custom set, and hard mode
function getQuestionSource() {
    const hardMode = document.getElementById('hard-mode');
    const isHard = hardMode && hardMode.checked;

    // If user is logged in and NOT unlocked, use guest questions
    if (currentUser && !currentUser.is_unlocked) {
        return { type: 'file', file: 'guest-questions.json' };
    }

    // If a custom question set is active, use it
    if (window._activeQuestionSet) {
        return { type: 'custom', setId: window._activeQuestionSet };
    }

    // Unlocked or no auth — use full question set
    const file = isHard ? 'hard+questions.json' : 'questions.json';
    return { type: 'file', file };
}

// Backward-compatible wrapper (returns filename string)
function getQuestionFile() {
    const source = getQuestionSource();
    if (source.type === 'file') return source.file;
    // Fallback for custom sets — caller should use getQuestionSource() instead
    const hardMode = document.getElementById('hard-mode');
    const isHard = hardMode && hardMode.checked;
    return isHard ? 'hard+questions.json' : 'questions.json';
}

// Check if the current user is a guest (registered but not unlocked)
function isGuestUser() {
    return currentUser && !currentUser.is_unlocked;
}

// Called after a guest exhausts all 25 questions — show unlock screen
function promptUnlock() {
    showScreen('unlock-screen');
}

// Hook into config screen inputs to auto-save on change
function initProfileHooks() {
    const countSel = document.getElementById('player-count');
    const hardMode = document.getElementById('hard-mode');
    const namesContainer = document.getElementById('player-names');
    const qsetSel = document.getElementById('question-set-select');
    const manageBtn = document.getElementById('manage-questions-btn');

    if (countSel) countSel.addEventListener('change', savePreferencesToCloud);
    if (hardMode) hardMode.addEventListener('change', savePreferencesToCloud);
    if (namesContainer) namesContainer.addEventListener('input', savePreferencesToCloud);

    // Question set selector: save preference and toggle hard mode
    if (qsetSel) {
        qsetSel.addEventListener('change', () => {
            window._activeQuestionSet = qsetSel.value || null;
            // Disable Hard Mode when a custom set is selected
            if (hardMode) {
                hardMode.disabled = !!qsetSel.value;
                hardMode.parentElement.style.opacity = qsetSel.value ? '0.5' : '1';
            }
            // Save active set to Supabase immediately
            if (typeof setActiveQuestionSet === 'function' && currentUser) {
                setActiveQuestionSet(qsetSel.value || null);
            }
            savePreferencesToCloud();
        });
    }

    // Manage button: navigate to the questions management screen
    if (manageBtn) {
        manageBtn.addEventListener('click', () => {
            if (typeof showScreen === 'function' && typeof showQuestionSetList === 'function') {
                showScreen('questions-screen');
                showQuestionSetList();
            }
        });
    }
}
