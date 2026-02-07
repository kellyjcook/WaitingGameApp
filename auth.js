// ── Supabase Configuration ──────────────────────────────────────────
// Replace these with your Supabase project values (Settings > API)
const SUPABASE_URL = 'https://cwhiaiiqdkjfchgxxyoj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hkqrBrAlrzEYxawusQE_cw_bB-RipO_';

let supabaseClient = null;
let currentUser = null; // { id, email, display_name, location, is_unlocked }

function initSupabase() {
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        console.error('Supabase SDK not loaded');
        return false;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
}

// ── Auth State ─────────────────────────────────────────────────────

async function checkSession() {
    if (!supabaseClient) return null;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        await loadProfile(session.user.id);
        return currentUser;
    }
    return null;
}

async function loadProfile(userId) {
    const { data, error } = await supabaseClient
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
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { display_name: displayName }
        }
    });
    if (error) return { error: error.message };

    // Check if email confirmation is required
    // Supabase returns identities=[] when email confirmation is pending
    const needsConfirmation = data.user && (!data.user.identities || data.user.identities.length === 0)
        || (data.user && !data.session);

    // Update profile with location (trigger creates the row, we update it)
    if (data.user && data.session) {
        // Only update if we have a session (email confirmed or confirmation disabled)
        await new Promise(r => setTimeout(r, 500));
        await supabaseClient
            .from('profiles')
            .update({ location, display_name: displayName })
            .eq('id', data.user.id);
        await loadProfile(data.user.id);
    }

    return { user: data.user, needsConfirmation };
}

// ── Login ──────────────────────────────────────────────────────────

async function loginUser(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
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
    await supabaseClient.auth.signOut();
    currentUser = null;
}

// ── Unlock Key Redemption ──────────────────────────────────────────

async function redeemUnlockKey(code) {
    if (!currentUser) return { error: 'Not logged in' };

    // Check if key exists and is unredeemed
    const { data: key, error: findErr } = await supabaseClient
        .from('unlock_keys')
        .select('id, redeemed_by')
        .eq('code', code.trim())
        .single();

    if (findErr || !key) return { error: 'Invalid unlock code' };
    if (key.redeemed_by) return { error: 'This code has already been used' };

    // Redeem the key
    const { error: redeemErr } = await supabaseClient
        .from('unlock_keys')
        .update({ redeemed_by: currentUser.id, redeemed_at: new Date().toISOString() })
        .eq('id', key.id);

    if (redeemErr) return { error: 'Failed to redeem code. Please try again.' };

    // Mark user as unlocked
    const { error: unlockErr } = await supabaseClient
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
    const { data } = await supabaseClient
        .from('user_preferences')
        .select('default_player_count, player_names, hard_mode')
        .eq('user_id', currentUser.id)
        .single();
    return data;
}

async function savePreferences(prefs) {
    if (!currentUser) return;
    await supabaseClient
        .from('user_preferences')
        .update({ ...prefs, updated_at: new Date().toISOString() })
        .eq('user_id', currentUser.id);
}

// ── Landing Page ──────────────────────────────────────────────────

function renderLandingScreen() {
    const landing = document.getElementById('landing-screen');
    if (!landing) return;
    landing.innerHTML = `
        <div class="landing-hero">
            <div class="landing-icon">&#x23F3;</div>
            <h1>The Waiting Game</h1>
            <p class="landing-tagline">A party game where timing is everything</p>
            <button id="landing-play-btn" class="landing-cta">Play Now</button>
        </div>

        <div class="landing-content">
            <div class="landing-section">
                <div class="landing-section-icon">&#x1F3AF;</div>
                <h2>How It Works</h2>
                <div class="landing-steps">
                    <div class="landing-step">
                        <div class="step-number">1</div>
                        <div class="step-text">
                            <strong>Read the question</strong>
                            <span>Each question has a numerical answer between 1 and 30</span>
                        </div>
                    </div>
                    <div class="landing-step">
                        <div class="step-number">2</div>
                        <div class="step-text">
                            <strong>Hold your button</strong>
                            <span>All players press and hold their on-screen button at the same time</span>
                        </div>
                    </div>
                    <div class="landing-step">
                        <div class="step-number">3</div>
                        <div class="step-text">
                            <strong>Count in your head</strong>
                            <span>Release after the number of seconds equal to the answer</span>
                        </div>
                    </div>
                    <div class="landing-step">
                        <div class="step-number">4</div>
                        <div class="step-text">
                            <strong>Closest wins!</strong>
                            <span>The player who releases closest to the correct time scores the most points</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="landing-section">
                <div class="landing-section-icon">&#x1F680;</div>
                <h2>Getting Started</h2>
                <div class="landing-info-cards">
                    <div class="info-card">
                        <h3>&#x1F4DD; Create an Account</h3>
                        <p>Register with your name, email, and location. You'll receive a quick confirmation email from The Waiting Game to verify your address.</p>
                    </div>
                    <div class="info-card">
                        <h3>&#x1F3AE; Try It Free</h3>
                        <p>New players get 25 free trivia questions to try the game. Play with up to 8 players on the same device!</p>
                    </div>
                    <div class="info-card">
                        <h3>&#x1F511; Unlock Full Access</h3>
                        <p>Enter your 8-digit unlock code to get unlimited access to hundreds of questions, including Hard Mode.</p>
                    </div>
                </div>
            </div>

            <div class="landing-section landing-features">
                <div class="landing-section-icon">&#x2728;</div>
                <h2>Features</h2>
                <div class="feature-grid">
                    <div class="feature-item">&#x1F465; 1-8 Players</div>
                    <div class="feature-item">&#x1F4F1; Works on Any Device</div>
                    <div class="feature-item">&#x1F9E0; Hundreds of Questions</div>
                    <div class="feature-item">&#x1F525; Hard Mode</div>
                    <div class="feature-item">&#x2601; Cloud-Saved Preferences</div>
                    <div class="feature-item">&#x1F3C6; Points &amp; Standings</div>
                </div>
            </div>

            <div class="landing-bottom-cta">
                <button id="landing-play-btn-bottom" class="landing-cta">Get Started</button>
            </div>
        </div>
    `;

    document.getElementById('landing-play-btn').addEventListener('click', () => {
        showScreen('auth-screen');
    });
    document.getElementById('landing-play-btn-bottom').addEventListener('click', () => {
        showScreen('auth-screen');
    });
}

// ── Auth UI Rendering ──────────────────────────────────────────────

function renderAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    if (!authScreen) return;
    authScreen.innerHTML = `
        <div class="auth-header">
            <button id="auth-back-btn" class="back-btn" title="Back to home">&#x2190;</button>
            <h1>The Waiting Game</h1>
            <p>Sign in or create an account to play</p>
        </div>
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

    // Back button
    document.getElementById('auth-back-btn').addEventListener('click', () => {
        showScreen('landing-screen');
    });

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
            // Friendlier message for unconfirmed email
            if (result.error.toLowerCase().includes('email not confirmed')) {
                showAuthError('Please check your email and click the confirmation link from The Waiting Game before signing in.');
            } else {
                showAuthError(result.error);
            }
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
        } else if (result.needsConfirmation) {
            // Show friendly email confirmation screen
            renderConfirmScreen(email);
            showScreen('confirm-screen');
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

// ── Email Confirmation Screen ─────────────────────────────────────

function renderConfirmScreen(email) {
    const screen = document.getElementById('confirm-screen');
    if (!screen) return;
    const maskedEmail = email || 'your email';
    screen.innerHTML = `
        <div class="confirm-container">
            <div class="confirm-icon">&#x2709;</div>
            <h1>Check Your Email</h1>
            <div class="confirm-card">
                <p class="confirm-lead">
                    We've sent a confirmation link to<br>
                    <strong>${maskedEmail}</strong>
                </p>
                <div class="confirm-steps">
                    <div class="confirm-step">
                        <span class="confirm-step-num">1</span>
                        <span>Open the email from <strong>The Waiting Game</strong></span>
                    </div>
                    <div class="confirm-step">
                        <span class="confirm-step-num">2</span>
                        <span>Click the <strong>Confirm your email</strong> link</span>
                    </div>
                    <div class="confirm-step">
                        <span class="confirm-step-num">3</span>
                        <span>Come back here and <strong>sign in</strong> to play!</span>
                    </div>
                </div>
                <div class="confirm-note">
                    <strong>Don't see it?</strong> Check your spam or junk folder.
                    The email comes from <em>noreply@mail.app.supabase.io</em> on behalf of The Waiting Game.
                </div>
                <button id="confirm-signin-btn">Go to Sign In</button>
            </div>
        </div>
    `;

    document.getElementById('confirm-signin-btn').addEventListener('click', () => {
        showScreen('auth-screen');
    });
}

// ── Unlock UI ──────────────────────────────────────────────────────

function renderUnlockScreen() {
    const unlockScreen = document.getElementById('unlock-screen');
    if (!unlockScreen) return;
    unlockScreen.innerHTML = `
        <div class="unlock-container">
            <div class="confirm-icon">&#x1F512;</div>
            <h1>Trial Complete</h1>
            <div class="auth-card">
                <p class="unlock-lead">You've played all 25 guest questions. Nice work!</p>
                <p class="unlock-info">Enter your 8-digit unlock code to get unlimited access to all questions, including Hard Mode.</p>
                <div id="unlock-error" class="auth-error hidden"></div>
                <form id="unlock-form" class="auth-form">
                    <input type="text" id="unlock-code" placeholder="8-digit unlock code"
                           maxlength="8" pattern="[0-9]{8}" required
                           inputmode="numeric" autocomplete="off"
                           style="text-align:center; font-size:1.5rem; letter-spacing:4px">
                    <button type="submit">Unlock Full Game</button>
                </form>
                <p class="unlock-help">Don't have a code? Contact the person who shared The Waiting Game with you.</p>
            </div>
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
            btn.textContent = 'Unlock Full Game';
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

    // Landing page needs scrolling; game screens need overflow:hidden
    const scrollableScreens = ['landing-screen', 'auth-screen', 'confirm-screen', 'unlock-screen'];
    if (scrollableScreens.includes(id)) {
        document.body.classList.add('allow-scroll');
        window.scrollTo(0, 0);
    } else {
        document.body.classList.remove('allow-scroll');
    }
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
                showScreen('landing-screen');
                badge.classList.add('hidden');
            });
        }
    } else {
        badge.classList.add('hidden');
    }
}

// ── Boot ────────────────────────────────────────────────────────────

async function bootAuth() {
    if (!initSupabase() || !supabaseClient) {
        // SDK failed to load — let the game run without auth
        showScreen('config-screen');
        return;
    }

    renderLandingScreen();
    renderAuthScreen();
    renderUnlockScreen();

    // Check for existing session
    const user = await checkSession();
    if (user) {
        await onAuthSuccess();
    } else {
        showScreen('landing-screen');
    }
}
