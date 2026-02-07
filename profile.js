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
            await savePreferences({
                default_player_count: count,
                player_names: names,
                hard_mode: hard
            });
        }
        // Always save to cookies too as local fallback
        if (typeof savePlayerConfigToCookies === 'function') {
            savePlayerConfigToCookies();
        }
    }, 600);
}

// Determine which question file to load based on unlock status and hard mode
function getQuestionFile() {
    const hardMode = document.getElementById('hard-mode');
    const isHard = hardMode && hardMode.checked;

    // If user is logged in and NOT unlocked, use guest questions
    if (currentUser && !currentUser.is_unlocked) {
        return 'guest-questions.json';
    }

    // Unlocked or no auth — use full question set
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

    if (countSel) countSel.addEventListener('change', savePreferencesToCloud);
    if (hardMode) hardMode.addEventListener('change', savePreferencesToCloud);
    if (namesContainer) namesContainer.addEventListener('input', savePreferencesToCloud);
}
