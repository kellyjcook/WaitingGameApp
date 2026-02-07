// ── Supabase Configuration ──────────────────────────────────────────
// Replace these with your Supabase project values (Settings > API)
const SUPABASE_URL = 'https://cwhiaiiqdkjfchgxxyoj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hkqrBrAlrzEYxawusQE_cw_bB-RipO_';

let supabase = null;
let currentUser = null; // { id, email, display_name, location, is_unlocked }

function initSupabase() {
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        console.error('Supabase SDK not loaded');
        return false;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
}

// ── Auth State ─────────────────────────────────────────────────────

async function checkSession() {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        await loadProfile(session.user.id);
        return currentUser;
    }
    return null;
}

async function loadProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, location, is_unlocked')
        .eq('id', userId)
        .single();
    if (data) {
        currentUser = data;
    }
    return data;
}

// ── Registration ───────────────────────────────────────────────────

async function registerUser(email, password, displayName, location) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { display_name: displayName }
        }
    });
    if (error) return { error: error.message };

    // Update profile with location (trigger creates the row, we update it)
    if (data.user) {
        // Small delay to let the trigger fire
        await new Promise(r => setTimeout(r, 500));
        await supabase
            .from('profiles')
            .update({ location, display_name: displayName })
            .eq('id', data.user.id);
        await loadProfile(data.user.id);
    }
    return { user: data.user };
}

// ── Login ──────────────────────────────────────────────────────────

async function loginUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (error) return { error: error.message };
    if (data.user) {
        await loadProfile(data.user.id);
    }
    return { user: data.user };
}

// ── Logout ─────────────────────────────────────────────────────────

async function logoutUser() {
    await supabase.auth.signOut();
    currentUser = null;
}

// ── Unlock Key Redemption ──────────────────────────────────────────

async function redeemUnlockKey(code) {
    if (!currentUser) return { error: 'Not logged in' };

    // Check if key exists and is unredeemed
    const { data: key, error: findErr } = await supabase
        .from('unlock_keys')
        .select('id, redeemed_by')
        .eq('code', code.trim())
        .single();

    if (findErr || !key) return { error: 'Invalid unlock code' };
    if (key.redeemed_by) return { error: 'This code has already been used' };

    // Redeem the key
    const { error: redeemErr } = await supabase
        .from('unlock_keys')
        .update({ redeemed_by: currentUser.id, redeemed_at: new Date().toISOString() })
        .eq('id', key.id);

    if (redeemErr) return { error: 'Failed to redeem code. Please try again.' };

    // Mark user as unlocked
    const { error: unlockErr } = await supabase
        .from('profiles')
        .update({ is_unlocked: true })
        .eq('id', currentUser.id);

    if (unlockErr) return { error: 'Code redeemed but failed to unlock account. Contact support.' };

    currentUser.is_unlocked = true;
    return { success: true };
}

// ── Preferences ────────────────────────────────────────────────────

async function loadPreferences() {
    if (!currentUser) return null;
    const { data } = await supabase
        .from('user_preferences')
        .select('default_player_count, player_names, hard_mode')
        .eq('user_id', currentUser.id)
        .single();
    return data;
}

async function savePreferences(prefs) {
    if (!currentUser) return;
    await supabase
        .from('user_preferences')
        .update({ ...prefs, updated_at: new Date().toISOString() })
        .eq('user_id', currentUser.id);
}

// ── Auth UI Rendering ──────────────────────────────────────────────

function renderAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    if (!authScreen) return;
    authScreen.innerHTML = `
        <h1>Welcome to The Waiting Game</h1>
        <p>Sign in or create an account to play</p>
        <div class="auth-card">
            <div class="auth-tabs">
                <button class="auth-tab active" data-tab="login">Sign In</button>
                <button class="auth-tab" data-tab="register">Register</button>
            </div>
            <div id="auth-error" class="auth-error hidden"></div>

            <form id="login-form" class="auth-form">
                <input type="email" id="login-email" placeholder="Email" required autocomplete="email">
                <input type="password" id="login-password" placeholder="Password" required autocomplete="current-password">
                <button type="submit">Sign In</button>
            </form>

            <form id="register-form" class="auth-form hidden">
                <input type="text" id="register-name" placeholder="Display Name" maxlength="25" required autocomplete="name">
                <input type="email" id="register-email" placeholder="Email" required autocomplete="email">
                <input type="text" id="register-location" placeholder="Location (city, state, country, etc.)" maxlength="100" autocomplete="address-level2">
                <input type="password" id="register-password" placeholder="Password (min 6 characters)" minlength="6" required autocomplete="new-password">
                <button type="submit">Create Account</button>
            </form>
        </div>
    `;

    // Tab switching
    authScreen.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            authScreen.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
            document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
            clearAuthError();
        });
    });

    // Login handler
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Signing in...';
        clearAuthError();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const result = await loginUser(email, password);

        if (result.error) {
            showAuthError(result.error);
            btn.disabled = false;
            btn.textContent = 'Sign In';
        } else {
            onAuthSuccess();
        }
    });

    // Register handler
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Creating account...';
        clearAuthError();

        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const location = document.getElementById('register-location').value.trim();
        const password = document.getElementById('register-password').value;

        if (!name) {
            showAuthError('Display name is required');
            btn.disabled = false;
            btn.textContent = 'Create Account';
            return;
        }

        const result = await registerUser(email, password, name, location);

        if (result.error) {
            showAuthError(result.error);
            btn.disabled = false;
            btn.textContent = 'Create Account';
        } else {
            onAuthSuccess();
        }
    });
}

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    if (el) {
        el.textContent = msg;
        el.classList.remove('hidden');
    }
}

function clearAuthError() {
    const el = document.getElementById('auth-error');
    if (el) el.classList.add('hidden');
}

// ── Unlock UI ──────────────────────────────────────────────────────

function renderUnlockScreen() {
    const unlockScreen = document.getElementById('unlock-screen');
    if (!unlockScreen) return;
    unlockScreen.innerHTML = `
        <h1>Trial Complete</h1>
        <p>You've played all 25 guest questions.</p>
        <p>Enter an unlock code to get unlimited access to all questions.</p>
        <div class="auth-card">
            <div id="unlock-error" class="auth-error hidden"></div>
            <form id="unlock-form" class="auth-form">
                <input type="text" id="unlock-code" placeholder="8-digit unlock code"
                       maxlength="8" pattern="[0-9]{8}" required
                       inputmode="numeric" autocomplete="off"
                       style="text-align:center; font-size:1.5rem; letter-spacing:4px">
                <button type="submit">Unlock</button>
            </form>
        </div>
    `;

    document.getElementById('unlock-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Validating...';
        const errEl = document.getElementById('unlock-error');
        errEl.classList.add('hidden');

        const code = document.getElementById('unlock-code').value.trim();
        const result = await redeemUnlockKey(code);

        if (result.error) {
            errEl.textContent = result.error;
            errEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Unlock';
        } else {
            // Success — transition to config screen with full questions
            showScreen('config-screen');
        }
    });
}

// ── Screen Management ──────────────────────────────────────────────

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
}

async function onAuthSuccess() {
    // Load user preferences into config form
    const prefs = await loadPreferences();
    if (prefs) {
        applyPreferencesToConfig(prefs);
    }
    showScreen('config-screen');
    renderUserBadge();
}

function applyPreferencesToConfig(prefs) {
    const countSel = document.getElementById('player-count');
    if (countSel && prefs.default_player_count) {
        countSel.value = prefs.default_player_count;
        // Trigger change to re-render name inputs
        countSel.dispatchEvent(new Event('change'));
    }
    if (prefs.player_names && Array.isArray(prefs.player_names)) {
        // Delay slightly to let renderPlayerNameInputs finish
        setTimeout(() => {
            prefs.player_names.forEach((name, idx) => {
                const inp = document.getElementById(`player-name-${idx + 1}`);
                if (inp && name) inp.value = name;
            });
        }, 50);
    }
    const hardMode = document.getElementById('hard-mode');
    if (hardMode && typeof prefs.hard_mode === 'boolean') {
        hardMode.checked = prefs.hard_mode;
    }
}

function renderUserBadge() {
    let badge = document.getElementById('user-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'user-badge';
        document.body.appendChild(badge);
    }
    if (currentUser) {
        const lockIcon = currentUser.is_unlocked ? '&#x1f513;' : '&#x1f512;';
        badge.innerHTML = `${lockIcon} ${currentUser.display_name} <button id="logout-btn" title="Sign out">&#x2715;</button>`;
        badge.classList.remove('hidden');
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await logoutUser();
                showScreen('auth-screen');
                badge.classList.add('hidden');
            });
        }
    } else {
        badge.classList.add('hidden');
    }
}

// ── Boot ────────────────────────────────────────────────────────────

async function bootAuth() {
    if (!initSupabase()) {
        // SDK failed to load — let the game run without auth
        showScreen('config-screen');
        return;
    }

    renderAuthScreen();
    renderUnlockScreen();

    // Check for existing session
    const user = await checkSession();
    if (user) {
        await onAuthSuccess();
    } else {
        showScreen('auth-screen');
    }
}
