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
        .select('default_player_count, player_names, hard_mode, active_question_set')
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

// ── Custom Question Sets ──────────────────────────────────────────

function generateRandomCode(length = 8) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function loadQuestionSets() {
    if (!currentUser) return { data: [], error: 'Not logged in' };
    const { data, error } = await supabaseClient
        .from('question_sets')
        .select('id, name, share_code, question_count, created_at')
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: false });
    return { data: data || [], error: error ? error.message : null };
}

async function createQuestionSet(name) {
    if (!currentUser) return { error: 'Not logged in' };
    const { data, error } = await supabaseClient
        .from('question_sets')
        .insert({ owner_id: currentUser.id, name })
        .select()
        .single();
    return { data, error: error ? error.message : null };
}

async function deleteQuestionSet(setId) {
    if (!currentUser) return { error: 'Not logged in' };
    // Clear active_question_set if it points to the deleted set
    const sel = document.getElementById('question-set-select');
    if (sel && sel.value === setId) {
        await setActiveQuestionSet(null);
    }
    const { error } = await supabaseClient
        .from('question_sets')
        .delete()
        .eq('id', setId)
        .eq('owner_id', currentUser.id);
    return { error: error ? error.message : null };
}

async function renameQuestionSet(setId, newName) {
    if (!currentUser) return { error: 'Not logged in' };
    const { error } = await supabaseClient
        .from('question_sets')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', setId)
        .eq('owner_id', currentUser.id);
    return { error: error ? error.message : null };
}

async function loadQuestionSetItems(setId) {
    const { data, error } = await supabaseClient
        .from('question_set_items')
        .select('id, question, answer, sort_order')
        .eq('set_id', setId)
        .order('sort_order', { ascending: true });
    return { data: data || [], error: error ? error.message : null };
}

async function addQuestionToSet(setId, questionText, answer) {
    if (!currentUser) return { error: 'Not logged in' };
    // Get current max sort_order
    const { data: existing } = await supabaseClient
        .from('question_set_items')
        .select('sort_order')
        .eq('set_id', setId)
        .order('sort_order', { ascending: false })
        .limit(1);
    const nextOrder = (existing && existing.length > 0) ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabaseClient
        .from('question_set_items')
        .insert({ set_id: setId, question: questionText, answer, sort_order: nextOrder })
        .select()
        .single();

    if (!error) {
        // Update question count on the set
        await supabaseClient.rpc('', {}).catch(() => {}); // no-op, update count manually
        const { data: countData } = await supabaseClient
            .from('question_set_items')
            .select('id', { count: 'exact', head: true })
            .eq('set_id', setId);
        // Use the count from the response headers if available
        await supabaseClient
            .from('question_sets')
            .update({ question_count: nextOrder + 1, updated_at: new Date().toISOString() })
            .eq('id', setId);
    }

    return { data, error: error ? error.message : null };
}

async function updateQuestionInSet(itemId, questionText, answer) {
    if (!currentUser) return { error: 'Not logged in' };
    const { error } = await supabaseClient
        .from('question_set_items')
        .update({ question: questionText, answer })
        .eq('id', itemId);
    return { error: error ? error.message : null };
}

async function deleteQuestionFromSet(itemId, setId) {
    if (!currentUser) return { error: 'Not logged in' };
    const { error } = await supabaseClient
        .from('question_set_items')
        .delete()
        .eq('id', itemId);

    if (!error && setId) {
        // Update question count
        const { data: items } = await supabaseClient
            .from('question_set_items')
            .select('id')
            .eq('set_id', setId);
        await supabaseClient
            .from('question_sets')
            .update({ question_count: items ? items.length : 0, updated_at: new Date().toISOString() })
            .eq('id', setId);
    }

    return { error: error ? error.message : null };
}

async function generateShareCode(setId) {
    if (!currentUser) return { error: 'Not logged in' };
    const code = generateRandomCode(8);
    const { error } = await supabaseClient
        .from('question_sets')
        .update({ share_code: code })
        .eq('id', setId)
        .eq('owner_id', currentUser.id);
    if (error) {
        // Retry once in case of unique constraint collision
        const code2 = generateRandomCode(8);
        const { error: err2 } = await supabaseClient
            .from('question_sets')
            .update({ share_code: code2 })
            .eq('id', setId)
            .eq('owner_id', currentUser.id);
        if (err2) return { error: err2.message };
        return { code: code2 };
    }
    return { code };
}

async function revokeShareCode(setId) {
    if (!currentUser) return { error: 'Not logged in' };
    const { error } = await supabaseClient
        .from('question_sets')
        .update({ share_code: null })
        .eq('id', setId)
        .eq('owner_id', currentUser.id);
    return { error: error ? error.message : null };
}

async function importQuestionSet(shareCode) {
    if (!currentUser) return { error: 'Not logged in' };

    // Find the shared set
    const { data: sets, error: findErr } = await supabaseClient
        .from('question_sets')
        .select('id, name, question_count')
        .eq('share_code', shareCode.trim().toUpperCase())
        .limit(1);

    if (findErr || !sets || sets.length === 0) return { error: 'No question set found with that code' };
    const sourceSet = sets[0];

    // Load all questions from the shared set
    const { data: items, error: itemsErr } = await supabaseClient
        .from('question_set_items')
        .select('question, answer, sort_order')
        .eq('set_id', sourceSet.id)
        .order('sort_order', { ascending: true });

    if (itemsErr) return { error: 'Failed to load questions from shared set' };
    if (!items || items.length === 0) return { error: 'The shared set has no questions' };

    // Create a new set owned by the current user
    const importName = `Imported: ${sourceSet.name}`.substring(0, 60);
    const { data: newSet, error: createErr } = await supabaseClient
        .from('question_sets')
        .insert({ owner_id: currentUser.id, name: importName, question_count: items.length })
        .select()
        .single();

    if (createErr || !newSet) return { error: 'Failed to create imported set' };

    // Bulk insert all questions
    const newItems = items.map(item => ({
        set_id: newSet.id,
        question: item.question,
        answer: item.answer,
        sort_order: item.sort_order
    }));
    const { error: insertErr } = await supabaseClient
        .from('question_set_items')
        .insert(newItems);

    if (insertErr) return { error: 'Set created but failed to copy some questions' };

    return { data: { newSetId: newSet.id, name: importName, questionCount: items.length } };
}

async function setActiveQuestionSet(setId) {
    if (!currentUser) return { error: 'Not logged in' };
    const { error } = await supabaseClient
        .from('user_preferences')
        .update({ active_question_set: setId, updated_at: new Date().toISOString() })
        .eq('user_id', currentUser.id);
    window._activeQuestionSet = setId || null;
    return { error: error ? error.message : null };
}

// ── Custom Questions UI ──────────────────────────────────────────

function renderQuestionsScreen() {
    const screen = document.getElementById('questions-screen');
    if (!screen) return;
    // Initial render: will be populated by showQuestionSetList()
    screen.innerHTML = '<div class="questions-loading">Loading...</div>';
}

async function showQuestionSetList() {
    const screen = document.getElementById('questions-screen');
    if (!screen) return;

    const { data: sets } = await loadQuestionSets();

    let setsHtml = '';
    if (sets.length === 0) {
        setsHtml = `<div class="qset-empty-state">
            <p>You haven't created any question sets yet.</p>
            <p>Create your own trivia questions or import a set from a friend!</p>
        </div>`;
    } else {
        setsHtml = `<div class="qset-list">${sets.map(s => `
            <div class="qset-card" data-set-id="${s.id}">
                <div class="qset-card-info">
                    <div class="qset-card-name">${escapeHtml(s.name)}</div>
                    <div class="qset-card-meta">${s.question_count} question${s.question_count !== 1 ? 's' : ''}${s.share_code ? ' &middot; Shared' : ''}</div>
                </div>
                <div class="qset-card-actions">
                    <button class="qset-edit-btn" data-set-id="${s.id}">Edit</button>
                    <button class="qset-delete-btn delete-btn" data-set-id="${s.id}" data-set-name="${escapeHtml(s.name)}">&#x2715;</button>
                </div>
            </div>
        `).join('')}</div>`;
    }

    screen.innerHTML = `
        <div class="questions-header">
            <button id="questions-back-btn" class="back-btn" title="Back to game setup">&#x2190;</button>
            <h1>My Questions</h1>
        </div>
        <div class="qset-actions-bar">
            <button id="qset-create-btn">Create New Set</button>
            <button id="qset-import-btn" class="btn-secondary">Import Set</button>
        </div>
        <div id="qset-inline-form" class="hidden"></div>
        <div id="qset-message" class="hidden"></div>
        ${setsHtml}
    `;

    // Back button
    document.getElementById('questions-back-btn').addEventListener('click', () => {
        showScreen('config-screen');
        populateQuestionSetSelector();
    });

    // Create button
    document.getElementById('qset-create-btn').addEventListener('click', () => {
        const form = document.getElementById('qset-inline-form');
        form.classList.remove('hidden');
        form.innerHTML = `
            <div class="auth-card" style="margin-top:0">
                <form id="qset-create-form" class="auth-form">
                    <input type="text" id="qset-new-name" placeholder="Set name (e.g. Geography)" maxlength="60" required>
                    <div style="display:flex;gap:8px">
                        <button type="submit" style="flex:1;margin:0">Create</button>
                        <button type="button" id="qset-create-cancel" class="btn-secondary" style="flex:0;margin:0">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('qset-new-name').focus();
        document.getElementById('qset-create-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('qset-new-name').value.trim();
            if (!name) return;
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Creating...';
            const result = await createQuestionSet(name);
            if (result.error) {
                showQsetMessage(result.error, 'error');
                btn.disabled = false;
                btn.textContent = 'Create';
            } else {
                await showQuestionSetList();
            }
        });
        document.getElementById('qset-create-cancel').addEventListener('click', () => {
            form.classList.add('hidden');
            form.innerHTML = '';
        });
    });

    // Import button
    document.getElementById('qset-import-btn').addEventListener('click', () => {
        const form = document.getElementById('qset-inline-form');
        form.classList.remove('hidden');
        form.innerHTML = `
            <div class="auth-card" style="margin-top:0">
                <form id="qset-import-form" class="auth-form">
                    <input type="text" id="qset-import-code" placeholder="8-character share code"
                           maxlength="8" required autocomplete="off"
                           style="text-align:center; font-size:1.3rem; letter-spacing:3px; text-transform:uppercase">
                    <div style="display:flex;gap:8px">
                        <button type="submit" style="flex:1;margin:0">Import</button>
                        <button type="button" id="qset-import-cancel" class="btn-secondary" style="flex:0;margin:0">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('qset-import-code').focus();
        document.getElementById('qset-import-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('qset-import-code').value.trim();
            if (!code) return;
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Importing...';
            const result = await importQuestionSet(code);
            if (result.error) {
                showQsetMessage(result.error, 'error');
                btn.disabled = false;
                btn.textContent = 'Import';
            } else {
                showQsetMessage(`Imported "${result.data.name}" with ${result.data.questionCount} questions!`, 'success');
                await showQuestionSetList();
            }
        });
        document.getElementById('qset-import-cancel').addEventListener('click', () => {
            form.classList.add('hidden');
            form.innerHTML = '';
        });
    });

    // Edit buttons
    screen.querySelectorAll('.qset-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => renderSetEditor(btn.dataset.setId));
    });

    // Delete buttons
    screen.querySelectorAll('.qset-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = btn.dataset.setName;
            if (!confirm(`Delete "${name}" and all its questions? This cannot be undone.`)) return;
            btn.disabled = true;
            const result = await deleteQuestionSet(btn.dataset.setId);
            if (result.error) {
                showQsetMessage(result.error, 'error');
                btn.disabled = false;
            } else {
                await showQuestionSetList();
            }
        });
    });
}

async function renderSetEditor(setId) {
    const screen = document.getElementById('questions-screen');
    if (!screen) return;

    // Load set info and items
    const { data: sets } = await supabaseClient
        .from('question_sets')
        .select('id, name, share_code, question_count')
        .eq('id', setId)
        .single();

    if (!sets) {
        showQsetMessage('Question set not found', 'error');
        await showQuestionSetList();
        return;
    }

    const setInfo = sets;
    const { data: items } = await loadQuestionSetItems(setId);

    let itemsHtml = '';
    if (items.length === 0) {
        itemsHtml = '<div class="qset-empty-state"><p>No questions yet. Add your first question below!</p></div>';
    } else {
        itemsHtml = items.map((item, idx) => `
            <div class="question-item" data-item-id="${item.id}">
                <span class="question-item-num">${idx + 1}</span>
                <span class="question-item-text">${escapeHtml(item.question)}</span>
                <span class="question-item-answer">${item.answer}s</span>
                <div class="question-item-actions">
                    <button class="qi-edit-btn" data-item-id="${item.id}" data-q="${escapeAttr(item.question)}" data-a="${item.answer}">Edit</button>
                    <button class="qi-delete-btn delete-btn" data-item-id="${item.id}">&#x2715;</button>
                </div>
            </div>
        `).join('');
    }

    // Share section
    let shareHtml = '';
    if (setInfo.share_code) {
        shareHtml = `
            <div class="share-section">
                <div class="share-code-display">${setInfo.share_code}</div>
                <p style="font-size:0.85rem;color:#5f6368;margin:0 0 8px">Share this code with others to let them import your questions</p>
                <button id="copy-share-code" class="btn-secondary" style="margin:0 4px 0 0">Copy Code</button>
                <button id="revoke-share-code" class="btn-danger" style="margin:0">Stop Sharing</button>
            </div>
        `;
    } else {
        shareHtml = `<button id="generate-share-code" class="btn-secondary">Share This Set</button>`;
    }

    screen.innerHTML = `
        <div class="questions-header">
            <button id="set-editor-back-btn" class="back-btn" title="Back to set list">&#x2190;</button>
            <h1>${escapeHtml(setInfo.name)}</h1>
        </div>
        <div class="set-editor-meta">${items.length} question${items.length !== 1 ? 's' : ''}</div>

        <div class="auth-card set-editor-add" style="max-width:600px">
            <h3 style="margin-bottom:12px;color:#1a73e8;font-size:1rem">Add Question</h3>
            <form id="add-question-form" class="auth-form">
                <input type="text" id="new-question-text" placeholder="Question text" maxlength="500" required>
                <div style="display:flex;gap:8px;align-items:center">
                    <label style="font-weight:600;color:#202124;white-space:nowrap">Answer (1-30):</label>
                    <input type="number" id="new-question-answer" min="1" max="30" required
                           style="width:80px;padding:10px 12px;border:2px solid #dadce0;border-radius:8px;font-size:1rem;text-align:center">
                    <button type="submit" style="margin:0;flex:1">Add</button>
                </div>
            </form>
        </div>

        <div id="qset-message" class="hidden"></div>
        <div id="qset-items-list" style="width:100%;max-width:600px">
            ${itemsHtml}
        </div>

        <div class="auth-card" style="max-width:600px;margin-top:20px">
            <h3 style="margin-bottom:12px;color:#1a73e8;font-size:1rem">Sharing</h3>
            ${shareHtml}
        </div>

        <div style="max-width:600px;width:100%;margin-top:16px;text-align:center">
            <button id="delete-set-btn" class="btn-danger">Delete This Set</button>
        </div>
    `;

    // Back button
    document.getElementById('set-editor-back-btn').addEventListener('click', () => showQuestionSetList());

    // Add question form
    document.getElementById('add-question-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('new-question-text').value.trim();
        const answer = parseInt(document.getElementById('new-question-answer').value, 10);
        if (!text || isNaN(answer) || answer < 1 || answer > 30) return;
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Adding...';
        const result = await addQuestionToSet(setId, text, answer);
        if (result.error) {
            showQsetMessage(result.error, 'error');
            btn.disabled = false;
            btn.textContent = 'Add';
        } else {
            await renderSetEditor(setId);
        }
    });

    // Edit/delete question buttons
    screen.querySelectorAll('.qi-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemId = btn.dataset.itemId;
            const q = btn.dataset.q;
            const a = btn.dataset.a;
            const row = btn.closest('.question-item');
            row.innerHTML = `
                <form class="qi-edit-form" style="display:flex;gap:6px;align-items:center;flex:1">
                    <input type="text" class="qi-edit-text" value="${escapeAttr(q)}" maxlength="500" required style="flex:1;padding:8px 10px;border:2px solid #1a73e8;border-radius:6px;font-size:0.9rem">
                    <input type="number" class="qi-edit-answer" value="${a}" min="1" max="30" required style="width:60px;padding:8px;border:2px solid #1a73e8;border-radius:6px;font-size:0.9rem;text-align:center">
                    <button type="submit" style="margin:0;padding:6px 12px;font-size:0.85rem">Save</button>
                    <button type="button" class="qi-edit-cancel btn-secondary" style="margin:0;padding:6px 10px;font-size:0.85rem">&#x2715;</button>
                </form>
            `;
            row.querySelector('.qi-edit-form').addEventListener('submit', async (e2) => {
                e2.preventDefault();
                const newText = row.querySelector('.qi-edit-text').value.trim();
                const newAnswer = parseInt(row.querySelector('.qi-edit-answer').value, 10);
                if (!newText || isNaN(newAnswer) || newAnswer < 1 || newAnswer > 30) return;
                const result = await updateQuestionInSet(itemId, newText, newAnswer);
                if (result.error) {
                    showQsetMessage(result.error, 'error');
                } else {
                    await renderSetEditor(setId);
                }
            });
            row.querySelector('.qi-edit-cancel').addEventListener('click', () => renderSetEditor(setId));
        });
    });

    screen.querySelectorAll('.qi-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const result = await deleteQuestionFromSet(btn.dataset.itemId, setId);
            if (result.error) {
                showQsetMessage(result.error, 'error');
                btn.disabled = false;
            } else {
                await renderSetEditor(setId);
            }
        });
    });

    // Share controls
    const genBtn = document.getElementById('generate-share-code');
    if (genBtn) {
        genBtn.addEventListener('click', async () => {
            genBtn.disabled = true;
            genBtn.textContent = 'Generating...';
            const result = await generateShareCode(setId);
            if (result.error) {
                showQsetMessage(result.error, 'error');
                genBtn.disabled = false;
                genBtn.textContent = 'Share This Set';
            } else {
                await renderSetEditor(setId);
            }
        });
    }

    const copyBtn = document.getElementById('copy-share-code');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(setInfo.share_code).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy Code'; }, 2000);
            }).catch(() => {
                copyBtn.textContent = 'Copy failed';
            });
        });
    }

    const revokeBtn = document.getElementById('revoke-share-code');
    if (revokeBtn) {
        revokeBtn.addEventListener('click', async () => {
            revokeBtn.disabled = true;
            const result = await revokeShareCode(setId);
            if (result.error) {
                showQsetMessage(result.error, 'error');
                revokeBtn.disabled = false;
            } else {
                await renderSetEditor(setId);
            }
        });
    }

    // Delete set
    document.getElementById('delete-set-btn').addEventListener('click', async () => {
        if (!confirm(`Delete "${setInfo.name}" and all its questions? This cannot be undone.`)) return;
        const result = await deleteQuestionSet(setId);
        if (result.error) {
            showQsetMessage(result.error, 'error');
        } else {
            await showQuestionSetList();
        }
    });
}

async function populateQuestionSetSelector() {
    const row = document.getElementById('question-set-row');
    const sel = document.getElementById('question-set-select');
    const hardMode = document.getElementById('hard-mode');
    if (!row || !sel) return;

    // Only show for unlocked users
    if (!currentUser || !currentUser.is_unlocked) {
        row.style.display = 'none';
        return;
    }
    row.style.display = '';

    const { data: sets } = await loadQuestionSets();
    const currentActive = window._activeQuestionSet || '';

    // Preserve built-in option, rebuild the rest
    sel.innerHTML = '<option value="">Built-in Questions</option>';
    sets.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.question_count})`;
        if (s.id === currentActive) opt.selected = true;
        sel.appendChild(opt);
    });

    // Toggle hard mode availability
    if (hardMode) {
        hardMode.disabled = !!sel.value;
        if (sel.value) hardMode.parentElement.style.opacity = '0.5';
        else hardMode.parentElement.style.opacity = '1';
    }
}

function showQsetMessage(msg, type) {
    const el = document.getElementById('qset-message');
    if (!el) return;
    el.textContent = msg;
    el.className = type === 'error' ? 'qset-message qset-message-error' : 'qset-message qset-message-success';
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    const scrollableScreens = ['landing-screen', 'auth-screen', 'confirm-screen', 'unlock-screen', 'questions-screen'];
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
    // Populate the question set dropdown for unlocked users
    await populateQuestionSetSelector();
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
    // Set active question set global (used by getQuestionSource in profile.js)
    window._activeQuestionSet = prefs.active_question_set || null;
    // Show/hide the question set row based on unlock status
    const qsetRow = document.getElementById('question-set-row');
    if (qsetRow) {
        qsetRow.style.display = (currentUser && currentUser.is_unlocked) ? '' : 'none';
    }
    // Set the selector value if a custom set is active
    const sel = document.getElementById('question-set-select');
    if (sel && prefs.active_question_set) {
        sel.value = prefs.active_question_set;
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
    renderQuestionsScreen();

    // Check for existing session
    const user = await checkSession();
    if (user) {
        await onAuthSuccess();
    } else {
        showScreen('landing-screen');
    }
}
