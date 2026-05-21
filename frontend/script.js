const API = 'http://127.0.0.1:8000';
let authToken = null;
let currentUser = null;
let fairnessDataFilePath = null;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    setupLogin();
    setupUpload();
    setupTags();
    setupAuditForm();
    setupFairnessDataUpload();
    setupModelUpload();
    setupLogout();
    setupMobileMenu();
    checkAPIStatus();
});

// ========== TOAST NOTIFICATIONS ==========
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };

    toast.innerHTML = `
        <i data-lucide="${iconMap[type] || 'info'}" class="toast-icon"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

// ========== API STATUS CHECK ==========
async function checkAPIStatus() {
    const pill = document.getElementById('status-pill');
    if (!pill) return;
    try {
        const res = await fetch(`${API}/`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            pill.className = 'status-pill online';
            pill.innerHTML = '<span class="dot"></span> API Online';
        } else {
            throw new Error();
        }
    } catch {
        pill.className = 'status-pill offline';
        pill.innerHTML = '<span class="dot" style="background:var(--danger);box-shadow:0 0 10px var(--danger)"></span> API Offline';
    }
}

// ========== MOBILE MENU ==========
function setupMobileMenu() {
    const toggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('sidebar');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar on nav click (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
}

// ========== AUTH ==========
function setupLogin() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-user').value;
        const password = document.getElementById('login-pass').value;
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';

        try {
            const res = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!res.ok) throw new Error('Invalid credentials');
            const data = await res.json();
            authToken = data.token;
            currentUser = data;
            enterApp();
        } catch (err) {
            errorEl.textContent = err.message;
            showToast('Login failed. Check your credentials.', 'error');
        }
    });
}

function enterApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    document.getElementById('user-name').textContent = currentUser.full_name;
    document.getElementById('user-role').textContent = currentUser.role.replace('_', ' ');

    buildNavMenu();
    switchView('dashboard');
    loadDashboard();
    lucide.createIcons();
    showToast(`Welcome back, ${currentUser.full_name}!`, 'success');
}

function buildNavMenu() {
    const nav = document.getElementById('nav-menu');
    const items = [
        { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard', roles: ['admin', 'compliance_officer', 'ai_developer'] },
        { id: 'upload', icon: 'file-up', label: 'Regulations', roles: ['admin', 'compliance_officer'] },
        { id: 'config', icon: 'settings', label: 'Audit Config', roles: ['admin', 'compliance_officer', 'ai_developer'] },
        { id: 'results', icon: 'bar-chart-3', label: 'Results', roles: ['admin', 'compliance_officer', 'ai_developer'] },
        { id: 'admin', icon: 'shield', label: 'Administration', roles: ['admin'] },
    ];

    nav.innerHTML = items
        .filter(i => i.roles.includes(currentUser.role))
        .map(i => `<button class="nav-btn" data-view="${i.id}"><i data-lucide="${i.icon}"></i><span>${i.label}</span></button>`)
        .join('');

    nav.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
            // Close mobile sidebar
            document.getElementById('sidebar')?.classList.remove('open');
        });
    });
    lucide.createIcons();
}

function setupLogout() {
    document.getElementById('logout-btn').addEventListener('click', () => {
        authToken = null;
        currentUser = null;
        document.getElementById('app').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('login-user').value = '';
        document.getElementById('login-pass').value = '';
        showToast('Signed out successfully.', 'info');
    });
}

// ========== VIEWS ==========
function switchView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${id}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-view="${id}"]`)?.classList.add('active');

    if (id === 'dashboard') loadDashboard();
    if (id === 'admin') loadAdmin();
}

// ========== ANIMATED COUNTER ==========
function animateCounter(element, targetValue, duration = 800) {
    const start = parseFloat(element.textContent) || 0;
    const target = parseFloat(targetValue);
    if (isNaN(target)) {
        element.textContent = targetValue;
        return;
    }

    const startTime = performance.now();
    const isFloat = String(targetValue).includes('.');

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // EaseOutExpo
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = start + (target - start) * eased;

        element.textContent = isFloat ? current.toFixed(1) : Math.round(current);

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ========== DASHBOARD ==========
async function loadDashboard() {
    checkAPIStatus();
    try {
        const history = await fetch(`${API}/audit-history`).then(r => r.json());
        animateCounter(document.getElementById('stat-audits'), history.length);

        if (history.length > 0) {
            const last = history[history.length - 1];
            animateCounter(document.getElementById('stat-fairness'), last.avg_fairness);
            const totalViolations = history.reduce((s, a) => s + (a.policy_violations || 0), 0);
            animateCounter(document.getElementById('stat-violations'), totalViolations);
        }

        // Render history
        const listEl = document.getElementById('audit-history-list');
        if (history.length === 0) {
            listEl.innerHTML = '<p class="muted">No audits yet. Upload regulations and run your first audit.</p>';
        } else {
            listEl.innerHTML = history.slice(-5).reverse().map(a => `
                <div class="history-row">
                    <div class="history-meta">
                        <strong>${escapeHtml(a.model_description.substring(0, 50))}${a.model_description.length > 50 ? '...' : ''}</strong>
                        <br><span class="muted">${new Date(a.timestamp).toLocaleString()} Â· ${a.test_count} tests</span>
                    </div>
                    <div class="history-scores">
                        <span class="mini-score" style="color:var(--accent)">F: ${a.avg_fairness}</span>
                        <span class="mini-score" style="color:var(--primary)">C: ${a.avg_compliance}</span>
                        <span class="mini-score" style="color:var(--warning)">A: ${a.avg_accuracy}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error(e);
    }
}

// ========== UPLOAD ==========
let selectedFiles = [];

function setupUpload() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const uploadBtn = document.getElementById('upload-btn');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.classList.remove('drag-over'); addFiles(e.dataTransfer.files); });
    fileInput.addEventListener('change', e => addFiles(e.target.files));

    function addFiles(files) {
        for (const f of files) {
            if (f.type === 'application/pdf') {
                selectedFiles.push(f);
                const li = document.createElement('li');
                li.innerHTML = `<i data-lucide="file-text"></i> ${escapeHtml(f.name)}`;
                fileList.appendChild(li);
            }
        }
        lucide.createIcons();
        uploadBtn.disabled = selectedFiles.length === 0;
    }

    uploadBtn.addEventListener('click', async () => {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0"></div> Indexing...';
        const formData = new FormData();
        selectedFiles.forEach(f => formData.append('files', f));

        try {
            const res = await fetch(`${API}/upload-regulations`, { method: 'POST', body: formData });
            const data = await res.json();
            document.getElementById('upload-status').innerHTML = `<p style="color:var(--accent);margin-top:1rem">âœ“ ${data.message} (${data.total_chunks} chunks indexed)</p>`;
            animateCounter(document.getElementById('stat-indexed'), data.total_chunks);
            selectedFiles = [];
            fileList.innerHTML = '';
            uploadBtn.innerHTML = '<i data-lucide="database"></i> Index Regulations';
            uploadBtn.disabled = true;
            lucide.createIcons();
            showToast(`Successfully indexed ${data.total_chunks} chunks!`, 'success');
        } catch (err) {
            uploadBtn.innerHTML = '<i data-lucide="database"></i> Index Regulations';
            uploadBtn.disabled = false;
            lucide.createIcons();
            showToast('Upload failed. Is the backend running?', 'error');
        }
    });
}

// ========== TAGS ==========
function setupTags() {
    const input = document.getElementById('tag-input');
    const container = document.getElementById('tags-container');

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && input.value.trim()) {
            e.preventDefault();
            addTag(input.value.trim());
            input.value = '';
        }
    });

    document.querySelectorAll('.preset').forEach(el => {
        el.addEventListener('click', () => {
            addTag(el.dataset.tag);
            el.remove();
        });
    });

    function addTag(text) {
        const existing = container.querySelectorAll('.tag');
        for (const t of existing) { if (t.dataset.value === text) return; }

        const span = document.createElement('span');
        span.className = 'tag';
        span.dataset.value = text;
        span.innerHTML = `${escapeHtml(text)} <span class="remove"><i data-lucide="x"></i></span>`;
        container.insertBefore(span, input);
        span.querySelector('.remove').addEventListener('click', () => span.remove());
        lucide.createIcons();
    }
}

function setupFairnessDataUpload() {
    const modeSel = document.getElementById('fairness-data-mode');
    const wrap = document.getElementById('fairness-upload-wrap');
    const uploadBtn = document.getElementById('fairness-upload-btn');
    const fileInput = document.getElementById('fairness-file-input');
    const status = document.getElementById('fairness-file-status');
    if (!modeSel || !wrap || !uploadBtn || !fileInput || !status) return;

    const refreshVisibility = () => {
        const uploadMode = modeSel.value === 'upload';
        wrap.style.display = uploadMode ? 'block' : 'none';
        if (!uploadMode) {
            fairnessDataFilePath = null;
            status.textContent = 'Required columns: true_label, prediction, sensitive_feature';
        }
    };
    modeSel.addEventListener('change', refreshVisibility);
    refreshVisibility();

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        try {
            showToast('Uploading fairness dataset...', 'info');
            const res = await fetch(`${API}/upload-fairness-data`, { method: 'POST', body: formData });
            if (!res.ok) throw new Error(await res.text());
            const payload = await res.json();
            fairnessDataFilePath = payload.file_path;
            status.textContent = `Uploaded: ${file.name}`;
            showToast('Fairness dataset uploaded.', 'success');
        } catch (err) {
            fairnessDataFilePath = null;
            status.textContent = 'Upload failed. Please check the dataset format.';
            showToast(`Fairness data upload failed: ${err.message}`, 'error');
        } finally {
            fileInput.value = '';
        }
    });
}

// ========== AUDIT FORM ==========
function setupAuditForm() {
    document.getElementById('audit-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const desc = document.getElementById('model-desc').value;
        const tags = Array.from(document.querySelectorAll('#tags-container .tag')).map(t => t.dataset.value);
        const connType = document.querySelector('input[name="conn"]:checked').value;

        if (!desc) { showToast('Please describe the model.', 'warning'); return; }
        if (tags.length === 0) { showToast('Please add at least one variance factor.', 'warning'); return; }

        const manualFeaturesStr = document.getElementById('manual-features').value;
        const manualFeaturesList = manualFeaturesStr ? manualFeaturesStr.split(',').map(f => f.trim()).filter(f => f) : null;

        const config = {
            model_description: desc,
            variance_factors: tags,
            n_test_cases: parseInt(document.getElementById('test-count')?.value || '6', 10) || 6,
            model_type: document.getElementById('model-type')?.value || 'auto',
            connection_type: connType,
            api_mode: document.getElementById('api-mode')?.value || 'prompt',
            api_url: document.getElementById('api-url').value || null,
            api_key: document.getElementById('api-key').value || null,
            api_model_name: document.getElementById('api-model-name')?.value || null,
            local_file_path: uploadedModelName,
            custom_feature_names: manualFeaturesList,
            fairness_data_mode: document.getElementById('fairness-data-mode')?.value || 'dummy',
            fairness_data_file: fairnessDataFilePath
        };

        // Step 1: Configure
        await fetch(`${API}/configure-audit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        // Step 2: Switch to results & show loader
        switchView('results');
        const loading = document.getElementById('audit-loading');
        loading.classList.remove('hidden');
        document.getElementById('audit-summary').classList.add('hidden');
        document.getElementById('audit-results-list').innerHTML = '';

        // Animate progress steps
        animateProgressSteps();

        try {
            showToast('Audit started. This may take a minute...', 'info', 6000);
            const res = await fetch(`${API}/run-audit`, { method: 'POST' });
            const data = await res.json();
            loading.classList.add('hidden');

            if (data.error) {
                loading.classList.add('hidden');
                document.getElementById('audit-results-list').innerHTML = `
                    <div class="panel glass">
                        <p style="color:var(--danger); font-weight: 600;">Error: ${escapeHtml(data.error)}</p>
                        <p style="font-size: 0.9rem; margin-top: 0.5rem;">${escapeHtml(data.message || 'No additional details provided.')}</p>
                        <details style="margin-top: 1rem;">
                            <summary style="font-size: 0.75rem; color: var(--text-muted); cursor: pointer;">View Technical Traceback</summary>
                            <pre style="font-size:0.75rem; color:var(--text-muted); overflow-x:auto; margin-top: 0.5rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">${escapeHtml(data.traceback || data.raw || 'No traceback available.')}</pre>
                        </details>
                    </div>
                `;
                showToast('Audit failed. See results for details.', 'error');
                return;
            }

            renderResults(data);
            showToast('Governance audit completed successfully!', 'success');
        } catch (err) {
            loading.classList.add('hidden');
            document.getElementById('audit-results-list').innerHTML = `<div class="panel glass"><p style="color:var(--danger)">Audit failed: ${escapeHtml(err.message)}</p></div>`;
            showToast(`Audit failed: ${err.message}`, 'error');
        }
    });
}

// ========== MODEL UPLOAD & INSPECTION ==========
let uploadedModelName = null;
let currentModelProfile = null;

async function loadModelProfile(modelId) {
    const res = await fetch(`${API}/model-profile/${encodeURIComponent(modelId)}`);
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to load model profile');
    }
    return res.json();
}

function renderModelProfile(profile) {
    currentModelProfile = profile;
    const tbody = document.querySelector('#profile-table tbody');
    if (!tbody) return;

    const rows = (profile.features || []).map(f => `
        <tr data-name="${encodeURIComponent(f.name)}">
            <td><input type="checkbox" class="profile-use" ${f.use ? 'checked' : ''}></td>
            <td><span class="muted" style="font-size:0.9rem">${escapeHtml(f.name)}</span></td>
            <td>
                <select class="profile-dtype">
                    ${['float', 'int', 'bool', 'category', 'string'].map(t => `<option value="${t}" ${f.dtype === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </td>
            <td><input type="checkbox" class="profile-required" ${f.required ? 'checked' : ''}></td>
            <td><input type="text" class="profile-default" value="${escapeHtml(f.default ?? '')}" placeholder="0"></td>
            <td><input type="checkbox" class="profile-id" ${f.id_column ? 'checked' : ''}></td>
        </tr>
    `).join('');

    tbody.innerHTML = rows || `<tr><td colspan="6" class="muted">No features detected for this model.</td></tr>`;
    lucide.createIcons();
}

function readModelProfileFromUI(modelId) {
    const tbody = document.querySelector('#profile-table tbody');
    const rows = tbody ? Array.from(tbody.querySelectorAll('tr[data-name]')) : [];

    const features = rows.map(r => {
        const name = decodeURIComponent(r.getAttribute('data-name') || '');
        const use = r.querySelector('.profile-use')?.checked ?? true;
        const dtype = r.querySelector('.profile-dtype')?.value ?? 'float';
        const required = r.querySelector('.profile-required')?.checked ?? false;
        const id_column = r.querySelector('.profile-id')?.checked ?? false;
        const defaultRaw = r.querySelector('.profile-default')?.value ?? '';

        let def = defaultRaw === '' ? null : defaultRaw;
        if (def !== null) {
            if (dtype === 'float') def = Number(def);
            if (dtype === 'int') def = parseInt(def, 10);
            if (dtype === 'bool') def = String(def).toLowerCase() === 'true' || def === '1';
        }

        return { name, use, dtype, required, default: def, id_column };
    });

    return { version: 1, model_id: modelId, features };
}

async function refreshProfileUI() {
    if (!uploadedModelName) {
        showToast('Upload a model first.', 'warning');
        return;
    }
    try {
        const profile = await loadModelProfile(uploadedModelName);
        renderModelProfile(profile);
        showToast('Feature mapping loaded.', 'success');
    } catch (e) {
        showToast(`Profile load failed: ${e.message}`, 'error');
    }
}

async function saveProfileUI() {
    if (!uploadedModelName) {
        showToast('Upload a model first.', 'warning');
        return;
    }
    try {
        const profile = readModelProfileFromUI(uploadedModelName);
        const res = await fetch(`${API}/model-profile/${encodeURIComponent(uploadedModelName)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });
        if (!res.ok) throw new Error(await res.text());
        const saved = await res.json();
        renderModelProfile(saved);
        showToast('Feature mapping saved.', 'success');
    } catch (e) {
        showToast(`Profile save failed: ${e.message}`, 'error');
    }
}

async function uploadPreprocessor(file) {
    if (!uploadedModelName) {
        showToast('Upload a model first.', 'warning');
        return;
    }
    const fd = new FormData();
    fd.append('file', file);

    try {
        showToast('Uploading preprocessor...', 'info');
        const res = await fetch(`${API}/upload-preprocessor/${encodeURIComponent(uploadedModelName)}`, {
            method: 'POST',
            body: fd
        });
        if (!res.ok) throw new Error(await res.text());
        showToast('Preprocessor uploaded.', 'success');
    } catch (e) {
        showToast(`Preprocessor upload failed: ${e.message}`, 'error');
    }
}

function setupModelUpload() {
    const section = document.getElementById('upload-model-section');
    const apiFields = document.getElementById('api-fields');
    const radios = document.querySelectorAll('input[name="conn"]');
    const dropzone = document.getElementById('model-dropzone');
    const fileInput = document.getElementById('model-file-input');
    const mlflowBtn = document.getElementById('mlflow-import-btn');
    const mlflowInput = document.getElementById('mlflow-zip-input');

    radios.forEach(r => {
        r.addEventListener('change', () => {
            if (r.value === 'upload') {
                section.classList.remove('hidden');
                apiFields.classList.add('hidden');
            } else {
                section.classList.add('hidden');
                apiFields.classList.remove('hidden');
            }
        });
    });

    if (dropzone) {
        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length === 0) return;
            const file = e.target.files[0];

            const formData = new FormData();
            formData.append('file', file);

            try {
                showToast('Uploading model...', 'info');
                const res = await fetch(`${API}/upload-model`, { method: 'POST', body: formData });
                const data = await res.json();
                uploadedModelName = data.filename;

                // Inspect
                const info = await fetch(`${API}/inspect-model/${uploadedModelName}`).then(r => r.json());

                // Show info
                document.getElementById('model-inspect-area').classList.remove('hidden');
                const list = document.getElementById('model-features-list');
                if (info.feature_names && info.feature_names.length > 0) {
                    list.innerHTML = info.feature_names.map(f => `<span class="feature-pill">${escapeHtml(f)}</span>`).join('');
                } else {
                    list.innerHTML = `<span class="muted">No feature names found in model metadata.</span>`;
                }

                // Wire profile controls (idempotent)
                const loadBtn = document.getElementById('profile-load-btn');
                const saveBtn = document.getElementById('profile-save-btn');
                const upBtn = document.getElementById('upload-preprocessor-btn');
                const preInput = document.getElementById('preprocessor-file-input');
                if (loadBtn) loadBtn.onclick = refreshProfileUI;
                if (saveBtn) saveBtn.onclick = saveProfileUI;
                if (upBtn && preInput) {
                    upBtn.onclick = () => preInput.click();
                    preInput.onchange = async () => {
                        if (!preInput.files || preInput.files.length === 0) return;
                        await uploadPreprocessor(preInput.files[0]);
                        preInput.value = '';
                    };
                }

                // Load profile into table
                await refreshProfileUI();

                showToast('Model uploaded and inspected!', 'success');
            } catch (err) {
                showToast('Model upload failed', 'error');
            }
        });
    }

    if (mlflowBtn && mlflowInput) {
        mlflowBtn.addEventListener('click', () => mlflowInput.click());
        mlflowInput.addEventListener('change', async (e) => {
            if (!e.target.files || e.target.files.length === 0) return;
            const file = e.target.files[0];

            const formData = new FormData();
            formData.append('file', file);

            try {
                showToast('Importing MLflow bundle...', 'info');
                const res = await fetch(`${API}/upload-mlflow-model`, { method: 'POST', body: formData });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();

                uploadedModelName = data.model_id;

                const info = await fetch(`${API}/inspect-model/${encodeURIComponent(uploadedModelName)}`).then(r => r.json());

                document.getElementById('model-inspect-area').classList.remove('hidden');
                const list = document.getElementById('model-features-list');
                if (info.feature_names && info.feature_names.length > 0) {
                    list.innerHTML = info.feature_names.map(f => `<span class="feature-pill">${escapeHtml(f)}</span>`).join('');
                } else {
                    list.innerHTML = `<span class="muted">No feature names found in model metadata.</span>`;
                }

                // Wire profile controls and load profile.
                const loadBtn = document.getElementById('profile-load-btn');
                const saveBtn = document.getElementById('profile-save-btn');
                const upBtn = document.getElementById('upload-preprocessor-btn');
                const preInput = document.getElementById('preprocessor-file-input');
                if (loadBtn) loadBtn.onclick = refreshProfileUI;
                if (saveBtn) saveBtn.onclick = saveProfileUI;
                if (upBtn && preInput) {
                    upBtn.onclick = () => preInput.click();
                    preInput.onchange = async () => {
                        if (!preInput.files || preInput.files.length === 0) return;
                        await uploadPreprocessor(preInput.files[0]);
                        preInput.value = '';
                    };
                }

                await refreshProfileUI();

                showToast('MLflow model imported and inspected!', 'success');
            } catch (err) {
                showToast(`MLflow import failed: ${err.message}`, 'error');
            } finally {
                mlflowInput.value = '';
            }
        });
    }
}

// ========== PROGRESS STEPS ANIMATION ==========
function animateProgressSteps() {
    const steps = ['step-rag', 'step-gen', 'step-exec', 'step-grade'];
    let current = 0;

    function advance() {
        if (current > 0) {
            const prev = document.getElementById(steps[current - 1]);
            if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
        }
        if (current < steps.length) {
            const el = document.getElementById(steps[current]);
            if (el) el.classList.add('active');
            current++;
            setTimeout(advance, 3000 + Math.random() * 2000);
        }
    }

    // Reset
    steps.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('active', 'done'); }
    });
    advance();
}

// ========== RADIAL GAUGE SVG ==========
function createGauge(score, label, isOverall = false) {
    if (score === null || score === undefined || Number.isNaN(Number(score))) {
        return `
            <div class="score-item ${isOverall ? 'overall' : ''}">
                <div class="gauge-container">
                    <svg class="gauge-svg" viewBox="0 0 100 100">
                        <circle class="gauge-bg" cx="50" cy="50" r="42"></circle>
                    </svg>
                    <div class="gauge-text">
                        <div class="gauge-value" style="color:var(--text-muted)">N/A</div>
                        <div class="gauge-sub"></div>
                    </div>
                </div>
                <div class="score-label">${label}</div>
                <div class="score-rating" style="color:var(--text-muted)">Not Executed</div>
            </div>
        `;
    }

    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const numericScore = Number(score);
    const pct = Math.min(numericScore / 10, 1);
    const offset = circumference * (1 - pct);

    const getClass = (v) => v >= 7 ? 'good' : v >= 4 ? 'warning' : 'bad';
    const getRating = (v) => v >= 8 ? 'Excellent' : v >= 7 ? 'Good' : v >= 5 ? 'Fair' : v >= 3 ? 'Poor' : 'Critical';
    const colorClass = isOverall ? 'primary' : getClass(numericScore);

    return `
        <div class="score-item ${isOverall ? 'overall' : ''}">
            <div class="gauge-container">
                <svg class="gauge-svg" viewBox="0 0 100 100">
                    <circle class="gauge-bg" cx="50" cy="50" r="${radius}"></circle>
                    <circle class="gauge-fill ${colorClass}" cx="50" cy="50" r="${radius}"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${circumference}"
                        data-target-offset="${offset}">
                    </circle>
                </svg>
                <div class="gauge-text">
                    <div class="gauge-value ${colorClass}" data-target="${numericScore}">0</div>
                    <div class="gauge-sub">/10</div>
                </div>
            </div>
            <div class="score-label">${label}</div>
            <div class="score-rating ${colorClass}">${getRating(numericScore)}</div>
        </div>
    `;
}

function animateGauges() {
    // Animate SVG stroke
    document.querySelectorAll('.gauge-fill[data-target-offset]').forEach(circle => {
        const target = parseFloat(circle.getAttribute('data-target-offset'));
        // Start from full offset
        const circumference = parseFloat(circle.getAttribute('stroke-dasharray'));
        circle.style.strokeDashoffset = circumference;

        requestAnimationFrame(() => {
            setTimeout(() => {
                circle.style.strokeDashoffset = target;
            }, 100);
        });
    });

    // Animate score values
    document.querySelectorAll('.gauge-value[data-target]').forEach(el => {
        const target = parseFloat(el.getAttribute('data-target'));
        const duration = 1200;
        const startTime = performance.now();

        function update(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(2, -10 * progress);
            el.textContent = (target * eased).toFixed(1);
            if (progress < 1) requestAnimationFrame(update);
            else el.textContent = target.toFixed ? target.toFixed(1) : target;
        }
        requestAnimationFrame(update);
    });
}

// ========== RENDER RESULTS ==========
function renderResults(data) {
    const summary = data.summary;
    const hybrid = data.hybrid_validation || {};
    const metrics = hybrid.fairness_metrics || {};
    const matrices = hybrid.fairness_matrices || {};
    const rules = hybrid.rule_results || [];
    const dataset = data.deterministic_dataset || {};

    const behavioralRan = !!summary.behavioral_phase_executed;
    const avg_f = behavioralRan ? Number(summary.avg_fairness) : null;
    const avg_c = behavioralRan ? Number(summary.avg_compliance) : null;
    const avg_a = behavioralRan ? Number(summary.avg_accuracy) : null;
    const overall = behavioralRan ? ((avg_f + avg_c + avg_a) / 3).toFixed(1) : null;
    const fmt = (v, d = 4) => (v === null || v === undefined || Number.isNaN(Number(v)) ? 'N/A' : Number(v).toFixed(d));

    document.getElementById('audit-summary').classList.remove('hidden');
    document.getElementById('audit-summary').innerHTML = `
        <div class="panel glass">
            <h2><i data-lucide="award"></i> Fairness Scorecard</h2>
            <p class="muted">${escapeHtml(summary.model_description)} · ${summary.test_count} behavioral tests · ${new Date(summary.timestamp).toLocaleString()}</p>
            <p class="muted">Model type: <strong>${escapeHtml(summary.model_type_resolved || 'auto')}</strong> · Assurance: <strong>${escapeHtml(summary.assurance_level || 'N/A')}</strong> · Ingestion: <strong>${escapeHtml(summary.ml_ingestion_level || 'N/A')}</strong></p>
            ${behavioralRan && data.policy_violations > 0
                ? `<p style="color:var(--danger);margin-top:0.5rem">Warning: ${data.policy_violations} policy violation(s) detected</p>`
                : behavioralRan
                    ? `<p style="color:var(--accent);margin-top:0.5rem">OK: No policy violations detected</p>`
                    : `<p class="muted" style="margin-top:0.5rem">Behavioral scoring was not executed in this run.</p>`
            }
            <div class="scorecard">
                ${createGauge(behavioralRan ? parseFloat(overall) : null, 'Overall', true)}
                ${createGauge(avg_f, 'Fairness')}
                ${createGauge(avg_c, 'Compliance')}
                ${createGauge(avg_a, 'Accuracy')}
            </div>
            <p class="muted">Factors tested: ${summary.variance_factors.map(f => escapeHtml(f)).join(', ')}</p>
        </div>

        <div class="results-actions">
            <button class="btn-accent" id="download-report-btn"><i data-lucide="file-down"></i> Download PDF Report</button>
            <button class="btn-secondary" onclick="switchView('config')"><i data-lucide="rotate-ccw"></i> Run Another Audit</button>
        </div>

        <div class="panel glass">
            <h2><i data-lucide="scale"></i> Deterministic Fairness Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-item"><label>Hybrid Status</label><strong>${escapeHtml(hybrid.overall_status || 'N/A')}</strong></div>
                <div class="metric-item"><label>Disparate Impact Ratio</label><strong>${fmt(metrics.disparate_impact_ratio, 4)}</strong></div>
                <div class="metric-item"><label>Demographic Parity Difference</label><strong>${fmt(metrics.demographic_parity_difference, 4)}</strong></div>
                <div class="metric-item"><label>Selection Rate (Min)</label><strong>${fmt(metrics.selection_rate_min, 4)}</strong></div>
                <div class="metric-item"><label>Selection Rate (Max)</label><strong>${fmt(metrics.selection_rate_max, 4)}</strong></div>
                <div class="metric-item"><label>Rows Evaluated</label><strong>${escapeHtml(metrics.row_count ?? 0)}</strong></div>
            </div>
            ${data.deterministic_warning ? `<p style="color:var(--warning);margin-top:0.8rem">${escapeHtml(data.deterministic_warning)}</p>` : ''}
        </div>

        <div class="panel glass">
            <h2><i data-lucide="clipboard-list"></i> Rule Validation</h2>
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Metric</th><th>Operator</th><th>Threshold</th><th>Actual</th><th>Severity</th><th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rules.length ? rules.map(r => `
                            <tr>
                                <td>${escapeHtml(r.metric_name || '')}</td>
                                <td>${escapeHtml(r.operator || '')}</td>
                                <td>${escapeHtml(r.operator === 'between' ? `${r.threshold_min} to ${r.threshold_max}` : `${r.threshold_min}`)}</td>
                                <td>${escapeHtml(r.actual_value ?? 'N/A')}</td>
                                <td>${escapeHtml(r.severity || 'N/A')}</td>
                                <td><strong style="color:${r.status === 'PASS' ? 'var(--accent)' : 'var(--danger)'}">${escapeHtml(r.status || 'N/A')}</strong></td>
                            </tr>
                        `).join('') : `<tr><td colspan="6" class="muted">No rules available.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="panel glass">
            <h2><i data-lucide="grid-2x2"></i> Confusion Matrices</h2>
            <p class="muted">Matrix format: [[TN, FP], [FN, TP]]</p>
            <div class="table-wrap">
                <table class="data-table compact">
                    <thead><tr><th>Scope</th><th>Matrix</th><th>TPR</th><th>FPR</th><th>Precision</th><th>Accuracy</th></tr></thead>
                    <tbody>
                        <tr>
                            <td>Overall</td>
                            <td>${escapeHtml(matrices.overall_confusion_matrix ? JSON.stringify(matrices.overall_confusion_matrix) : 'N/A')}</td>
                            <td>${fmt(matrices.overall_rates?.tpr, 4)}</td>
                            <td>${fmt(matrices.overall_rates?.fpr, 4)}</td>
                            <td>${fmt(matrices.overall_rates?.precision, 4)}</td>
                            <td>${fmt(matrices.overall_rates?.accuracy, 4)}</td>
                        </tr>
                        ${Object.entries(matrices.by_group || {}).map(([g, v]) => `
                            <tr>
                                <td>${escapeHtml(g)}</td>
                                <td>${escapeHtml(JSON.stringify(v.confusion_matrix || 'N/A'))}</td>
                                <td>${fmt(v.rates?.tpr, 4)}</td>
                                <td>${fmt(v.rates?.fpr, 4)}</td>
                                <td>${fmt(v.rates?.precision, 4)}</td>
                                <td>${fmt(v.rates?.accuracy, 4)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="panel glass">
            <h2><i data-lucide="table"></i> Full Deterministic Dataset Used</h2>
            <p class="muted">Rows: ${escapeHtml(dataset.row_count ?? 0)} · Source: ${escapeHtml(dataset.source_mode || 'N/A')}${dataset.truncated ? ' · showing first 10 rows' : ''}</p>
            <div class="table-wrap">
                <table class="data-table compact">
                    <thead><tr><th>#</th><th>true_label</th><th>prediction</th><th>sensitive_feature</th></tr></thead>
                    <tbody>
                        ${(Array.isArray(dataset.rows) && dataset.rows.length) ? dataset.rows.map((row, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${escapeHtml(row.true_label)}</td>
                                <td>${escapeHtml(row.prediction)}</td>
                                <td>${escapeHtml(row.sensitive_feature)}</td>
                            </tr>
                        `).join('') : `<tr><td colspan="4" class="muted">No deterministic dataset rows available.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    lucide.createIcons();
    setTimeout(animateGauges, 200);
    document.getElementById('download-report-btn')?.addEventListener('click', downloadReport);

    const listEl = document.getElementById('audit-results-list');
    listEl.innerHTML = '<h2 style="margin-bottom:1rem;font-family:Outfit,sans-serif">Detailed Behavioral Test Results</h2>';
    if (!Array.isArray(data.results) || data.results.length === 0) {
        listEl.innerHTML += '<div class="panel glass"><p class="muted">No behavioral test cases were executed in this run.</p></div>';
        return;
    }

    data.results.forEach((r, i) => {
        const g = r.audit_grade || {};
        const card = document.createElement('div');
        card.className = 'result-card glass collapsed';
        card.innerHTML = `
            <div class="result-header expandable">
                <div class="test-info">
                    <span class="test-number">${i + 1}</span>
                    <div>
                        <strong>${escapeHtml(String(r.test_case.prompt || 'Test').substring(0, 70))}${String(r.test_case.prompt || '').length > 70 ? '...' : ''}</strong>
                        <div class="result-scores" style="margin-top:0.35rem">
                            <span class="mini-score" style="color:${scoreColor(g.fairness)}">F: ${g.fairness ?? '?'}</span>
                            <span class="mini-score" style="color:${scoreColor(g.compliance)}">C: ${g.compliance ?? '?'}</span>
                            <span class="mini-score" style="color:${scoreColor(g.accuracy)}">A: ${g.accuracy ?? '?'}</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:0.75rem">
                    <span class="risk-badge">${escapeHtml(r.test_case.risk_area || 'General')}</span>
                    <i data-lucide="chevron-down" class="expand-icon" style="width:18px;height:18px"></i>
                </div>
            </div>
            <div class="result-detail">
                <div class="result-section"><label>Test Scenario</label><p>${escapeHtml(String(r.test_case.prompt || 'N/A'))}</p></div>
                <div class="result-section"><label>Expected Behavior</label><p style="color:var(--accent)">${escapeHtml(String(r.test_case.expected_behavior || 'N/A'))}</p></div>
                <div class="result-section"><label>Actual Response</label><p>${escapeHtml(String(r.actual_response || 'N/A'))}</p></div>
                <div class="result-section">
                    <label>Audit Grade</label>
                    <div class="mini-scores">
                        <span class="mini-score">Fairness: ${g.fairness ?? '?'}/10</span>
                        <span class="mini-score">Compliance: ${g.compliance ?? '?'}/10</span>
                        <span class="mini-score">Accuracy: ${g.accuracy ?? '?'}/10</span>
                    </div>
                    ${g.reasoning ? `<p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted)">${escapeHtml(String(g.reasoning))}</p>` : ''}
                </div>
            </div>
        `;
        card.querySelector('.result-header').addEventListener('click', () => {
            card.classList.toggle('collapsed');
        });
        listEl.appendChild(card);
    });
    lucide.createIcons();
}

function scoreColor(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 'var(--text-muted)';
    if (n >= 7) return 'var(--accent)';
    if (n >= 4) return 'var(--warning)';
    return 'var(--danger)';
}
// ========== PDF REPORT DOWNLOAD ==========
async function downloadReport() {
    const btn = document.getElementById('download-report-btn');
    if (!btn) return;

    // Disable button and show loading state
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0"></div> Generating...';

    try {
        console.log('Fetching PDF report from:', `${API}/generate-report`);

        // Call the backend endpoint to generate PDF
        const res = await fetch(`${API}/generate-report`, {
            method: 'POST',
            headers: {
                'Accept': 'application/pdf'
            }
        });

        console.log('Response status:', res.status, 'Content-Type:', res.headers.get('content-type'));

        // Check if request was successful
        if (!res.ok) {
            let errorMessage = `Server error: ${res.status}`;
            try {
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await res.json();
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                } else {
                    const text = await res.text();
                    errorMessage = text || errorMessage;
                }
            } catch (e) {
                console.error('Error parsing error response:', e);
            }
            throw new Error(errorMessage);
        }

        // Convert response to blob (binary data)
        const blob = await res.blob();
        console.log('Blob size:', blob.size, 'Blob type:', blob.type);

        // Validate that we got actual PDF data
        if (blob.size === 0) {
            throw new Error('Generated PDF is empty');
        }

        // Verify it's a PDF
        if (!blob.type.includes('application/pdf')) {
            console.warn('Warning: Expected PDF, got', blob.type);
        }

        // Create a temporary URL for the blob
        const url = URL.createObjectURL(blob);

        // Create a temporary anchor element to trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `AI_Governance_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

        // Add to DOM, click to download, then clean up
        document.body.appendChild(a);
        a.click();
        a.remove();

        // Clean up the temporary URL
        URL.revokeObjectURL(url);

        showToast('PDF report downloaded successfully!', 'success');

    } catch (err) {
        console.error('Report download error:', err);
        showToast(`Report error: ${err.message}`, 'error');
    } finally {
        // Always restore button state
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="file-down"></i> Download PDF Report';
        lucide.createIcons();
    }
}


// ========== ADMIN ==========
async function loadAdmin() {
    if (!authToken) return;

    // Load users
    try {
        const users = await fetch(`${API}/admin/users`, { headers: { Authorization: authToken } }).then(r => r.json());
        document.getElementById('user-list').innerHTML = users.map(u => `
            <div class="user-row">
                <div><strong>${escapeHtml(u.full_name)}</strong> <span class="muted">(${escapeHtml(u.username)})</span></div>
                <span class="role-badge ${u.role}">${u.role.replace('_', ' ')}</span>
            </div>
        `).join('');
    } catch (e) { console.error(e); }

    // Load policies
    try {
        const policies = await fetch(`${API}/admin/policies`, { headers: { Authorization: authToken } }).then(r => r.json());
        const pl = document.getElementById('policy-list');
        if (policies.length === 0) {
            pl.innerHTML = '<p class="muted">No policies defined yet.</p>';
        } else {
            pl.innerHTML = policies.map(p => `
                <div class="policy-row">
                    <h4>${escapeHtml(p.name)}</h4>
                    <p>${escapeHtml(p.description)}</p>
                    <div class="policy-thresholds">
                        <span class="mini-score">Min Fairness: ${p.min_fairness_score}</span>
                        <span class="mini-score">Min Compliance: ${p.min_compliance_score}</span>
                        <span class="mini-score">Min Accuracy: ${p.min_accuracy_score}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) { console.error(e); }

    // Create user form
    document.getElementById('create-user-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API}/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: authToken },
                body: JSON.stringify({
                    username: document.getElementById('new-username').value,
                    password: document.getElementById('new-password').value,
                    role: document.getElementById('new-role').value,
                    full_name: document.getElementById('new-fullname').value
                })
            });
            if (res.ok) {
                loadAdmin();
                e.target.reset();
                showToast('User created successfully!', 'success');
            } else {
                showToast('Failed to create user.', 'error');
            }
        } catch (err) { showToast('Failed to create user.', 'error'); }
    };

    // Create policy form
    document.getElementById('create-policy-form').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API}/admin/policies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: authToken },
                body: JSON.stringify({
                    name: document.getElementById('policy-name').value,
                    description: document.getElementById('policy-desc').value,
                    min_fairness_score: parseFloat(document.getElementById('policy-fairness').value),
                    min_compliance_score: parseFloat(document.getElementById('policy-compliance').value),
                    min_accuracy_score: parseFloat(document.getElementById('policy-accuracy').value)
                })
            });
            if (res.ok) {
                loadAdmin();
                e.target.reset();
                showToast('Policy added successfully!', 'success');
            } else {
                showToast('Failed to create policy.', 'error');
            }
        } catch (err) { showToast('Failed to create policy.', 'error'); }
    };
}

// ========== UTILITY ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}
