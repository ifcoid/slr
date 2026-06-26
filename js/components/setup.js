// js/components/setup.js
import { API, getBaseURL, setBaseURL } from '../api.js';
import { openModal, closeModal, showToast, setButtonLoading } from '../ui.js';

export function initSetup() {
    const btnSettings = document.getElementById('btn-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const inputBaseUrl = document.getElementById('input-base-url');
    const formLlmConfig = document.getElementById('form-llm-config');
    const btnFetchModels = document.getElementById('btn-fetch-models');
    const btnTestModel = document.getElementById('btn-test-model');
    const selectModel = document.getElementById('llm-model');

    // Lacak "ada perubahan belum disimpan" agar Pre-flight (yang menguji config TERSIMPAN)
    // bisa memperingatkan user kalau ia baru mengedit tapi belum klik Simpan.
    let dirtyConfig = false; // form Konfigurasi Provider (API key / model / base URL)
    let dirtyRoles = false;  // form Model Routing (peran -> provider)
    const markConfigDirty = () => { dirtyConfig = true; };
    const markRolesDirty = () => { dirtyRoles = true; };
    // Diekspos global agar health.js (Pre-flight) bisa membacanya lintas-modul.
    window.hasUnsavedLLMConfig = () => {
        const parts = [];
        if (dirtyConfig) parts.push('Konfigurasi Provider (API Key / Model / Base URL)');
        if (dirtyRoles) parts.push('Model Routing (peran → provider)');
        return { dirty: parts.length > 0, parts };
    };
    ['input-api-key', 'llm-base-url'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', markConfigDirty);
    });
    if (selectModel) selectModel.addEventListener('change', markConfigDirty);

    // Load initial Base URL to input
    if (inputBaseUrl) {
        inputBaseUrl.value = getBaseURL();
        inputBaseUrl.addEventListener('change', (e) => {
            setBaseURL(e.target.value);
            showToast('Base URL API berhasil diperbarui!');
            
            if (btnSettings) {
                btnSettings.style.color = '#10b981';
                btnSettings.innerHTML = '⚙️ Configured';
            }
        });
    }

    // Provider-specific base URL defaults
    const PROVIDER_BASE_URLS = {
        'rprompt':    'http://localhost:8080/v1',
        'rprompt1':   'http://localhost:8080/v1',
        'rprompt2':   'http://localhost:8080/v1',
        'rprompt3':   'http://localhost:8080/v1',
        'rprompt4':   'http://localhost:8080/v1',
        'openrouter': 'https://openrouter.ai/api/v1',
        'xiaomi':     'https://token-plan-sgp.xiaomimimo.com/v1',
        'nvidia':     'https://integrate.api.nvidia.com/v1',
        'mistral':    'https://api.mistral.ai/v1',
        'unimodel':   'https://unimodel.ai/v1',
        'aerolink':   'https://capi.aerolink.lat',
    };
    // Provider yang field base URL-nya wajib/berguna ditampilkan
    const PROVIDERS_WITH_BASE_URL = new Set(Object.keys(PROVIDER_BASE_URLS));

    const selectProviderEl = document.getElementById('select-provider');
    const groupBaseUrl = document.getElementById('group-base-url');
    const llmBaseUrlInput = document.getElementById('llm-base-url');

    // providerInfo[provider] = { default_model, has_key, base_url }. Sumber tunggal untuk:
    // (a) label "provider · model" di Model Routing, (b) prefill form config, (c) rekap.
    let providerInfo = {};
    const loadLLMConfigs = async () => {
        try {
            const cfg = await API.getLLMConfigs();
            providerInfo = {};
            (cfg.configs || []).forEach((c) => { providerInfo[c.provider] = c; });
        } catch (e) {
            console.warn('Gagal memuat daftar LLM config:', e.message);
        }
    };

    // healthMap[provider] = { status, message }. Dipakai agar di modal Pengaturan langsung
    // terlihat provider mana yang BERMASALAH (merah/kuning) — penyebab error — tanpa pindah
    // ke tab Health Check terpisah. Status: ALIVE | UNAUTHORIZED | QUOTA_EXCEEDED | ERROR.
    let healthMap = {};
    const loadHealth = async () => {
        try {
            const res = await API.checkLLMHealth();
            healthMap = {};
            (res.health || []).forEach((h) => { healthMap[h.provider] = h; });
        } catch (e) {
            console.warn('Gagal memuat health LLM:', e.message);
        }
    };
    const healthDot = (provider) => {
        const h = healthMap[provider];
        if (!h) return '';
        switch (h.status) {
            case 'ALIVE': return ' <span title="Sehat" style="color:#4ade80;">🟢</span>';
            case 'UNAUTHORIZED': return ' <span title="API key invalid" style="color:#f87171;">🔴 key invalid</span>';
            case 'QUOTA_EXCEEDED': return ' <span title="Kuota habis" style="color:#facc15;">🟡 kuota habis</span>';
            default: return ' <span title="Error/timeout" style="color:#cbd5e1;">⚪ error</span>';
        }
    };

    const updateBaseUrlVisibility = () => {
        const prov = selectProviderEl ? selectProviderEl.value : '';
        if (!groupBaseUrl) return;
        if (PROVIDERS_WITH_BASE_URL.has(prov)) {
            groupBaseUrl.classList.remove('hidden');
            // SELALU set default provider INI saat ganti — jangan biarkan URL provider
            // sebelumnya nyangkut (mis. agentrouter mewarisi openrouter). prefillConfigForm
            // akan menimpa dgn base_url TERSIMPAN bila provider ini sudah dikonfigurasi.
            if (llmBaseUrlInput) llmBaseUrlInput.value = PROVIDER_BASE_URLS[prov] || '';
        } else {
            groupBaseUrl.classList.add('hidden');
            if (llmBaseUrlInput) llmBaseUrlInput.value = '';
        }
    };

    // #3/#5: prefill form config dari config tersimpan saat provider dipilih, agar user
    // bisa lihat/edit model & base_url tanpa ketik ulang API key (key dipertahankan backend
    // bila dikosongkan).
    const prefillConfigForm = () => {
        const prov = selectProviderEl ? selectProviderEl.value : '';
        const info = providerInfo[prov];
        const keyInput = document.getElementById('input-api-key');
        const hint = document.getElementById('apikey-hint');
        const modelSel = document.getElementById('llm-model');
        const status = document.getElementById('llm-config-status');
        if (status) status.textContent = '';
        // API Key spesifik per-provider — SELALU bersihkan saat ganti agar key provider lain
        // (mis. nvidia) tidak nyangkut terbawa ke aerolink/unimodel/agentrouter.
        if (keyInput) keyInput.value = '';
        if (info && info.has_key) {
            if (keyInput) keyInput.placeholder = '(API Key tersimpan — kosongkan = tetap)';
            if (hint) hint.innerHTML = '✓ Provider ini sudah dikonfigurasi. Kosongkan API Key untuk mempertahankan yang lama.';
            if (modelSel) modelSel.innerHTML = info.default_model
                ? `<option value="${info.default_model}">${info.default_model} (tersimpan)</option>`
                : '<option value="">Klik 🔄 Muat Model</option>';
            if (info.base_url && llmBaseUrlInput) llmBaseUrlInput.value = info.base_url;
        } else {
            if (keyInput) keyInput.placeholder = 'Masukkan API Key...';
            if (hint) hint.textContent = 'Provider ini belum dikonfigurasi.';
            if (modelSel) modelSel.innerHTML = '<option value="">Masukkan API Key & Muat Model...</option>';
        }
    };

    if (selectProviderEl) {
        selectProviderEl.addEventListener('change', () => { updateBaseUrlVisibility(); prefillConfigForm(); });
        updateBaseUrlVisibility(); // set initial state
    }

    // ===== Model Routing (peran -> provider) =====
    const ROLE_IDS = ['reviewer1', 'reviewer1_fallback', 'reviewer2', 'reviewer2_fallback', 'supervisor', 'supervisor_fallback', 'brain', 'brain_fallback', 'auditor', 'auditor_fallback'];
    const PROVIDERS = ['gemini', 'groq', 'zhipu', 'claude', 'openrouter', 'nvidia', 'mistral', 'cohere', 'xiaomi', 'unimodel', 'aerolink', 'rprompt1', 'rprompt2', 'rprompt3', 'rprompt4'];

    const formatProviderName = (p) => {
        if (p.startsWith('rprompt')) {
            return p.replace('rprompt', 'LLMy');
        }
        return p;
    };

    const roleOptionLabel = (p) => {
        const base = formatProviderName(p);
        const info = providerInfo[p];
        if (!info || !info.has_key) return `${base} — belum dikonfigurasi`;
        return info.default_model ? `${base} · ${info.default_model}` : `${base} · (model default)`;
    };

    // savedRoles = pemetaan peran->provider TERSIMPAN dari server (sumber kebenaran saat membuka
    // modal). Dipertahankan lintas-buka agar blip jaringan tak menghapus pilihan yang benar.
    let savedRoles = {};

    // ensureOption menjamin sebuah <option> dengan value tertentu ADA di select. Nilai tersimpan
    // yang tak ada di daftar PROVIDERS (mis. data lama / provider dihapus dari daftar) kalau tak
    // disuntik akan diam-diam jatuh ke opsi pertama ('gemini') -> pilihan user "hilang".
    const ensureOption = (sel, value) => {
        if (!value) return;
        if (!Array.from(sel.options).some((o) => o.value === value)) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = `${formatProviderName(value)} (tersimpan)`;
            sel.appendChild(opt);
        }
    };

    const populateRoleSelects = () => {
        ROLE_IDS.forEach((id) => {
            const sel = document.getElementById('role-' + id);
            if (!sel) return;
            const prev = sel.value;
            sel.innerHTML = PROVIDERS.map((p) => `<option value="${p}">${roleOptionLabel(p)}</option>`).join('');
            // Pertahankan pilihan saat re-render label; suntik opsi bila prev di luar PROVIDERS
            // agar tak diam-diam jatuh ke opsi pertama.
            if (prev) { ensureOption(sel, prev); sel.value = prev; }
        });
    };

    // applyRolesToSelects MEMAKSA nilai tersimpan ke tiap select (otoritatif saat membuka modal).
    const applyRolesToSelects = (roles) => {
        if (!roles) return;
        ROLE_IDS.forEach((id) => {
            const sel = document.getElementById('role-' + id);
            if (!sel || !roles[id]) return;
            ensureOption(sel, roles[id]);
            sel.value = roles[id];
        });
    };

    // Ambil roles dengan retry kecil: blip/timeout jaringan TIDAK boleh mengosongkan pilihan
    // jadi default (penyebab "kadang pilihan LLM tidak terload saat buka Pengaturan").
    const fetchRolesWithRetry = async (attempts = 3) => {
        let lastErr;
        for (let i = 0; i < attempts; i++) {
            try { return await API.getRoles(); }
            catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 400)); }
        }
        throw lastErr;
    };

    // #1: rekap ringkas peran -> provider · model yang aktif sekarang, agar user yakin
    // konfigurasinya. Diperbarui saat load, saat ganti dropdown, dan setelah simpan.
    const ROLE_LABELS = {
        reviewer1: 'Reviewer 1', reviewer1_fallback: 'R1 fallback',
        reviewer2: 'Reviewer 2', reviewer2_fallback: 'R2 fallback',
        supervisor: 'Supervisor', supervisor_fallback: 'Supervisor fallback',
        brain: 'Brain', brain_fallback: 'Brain fallback',
        auditor: 'Auditor', auditor_fallback: 'Auditor fallback',
    };
    const renderRoutingSummary = () => {
        const box = document.getElementById('routing-summary');
        if (!box) return;
        const rows = ROLE_IDS.map((id) => {
            const sel = document.getElementById('role-' + id);
            const prov = sel ? sel.value : '';
            const info = providerInfo[prov];
            const model = info && info.has_key
                ? (info.default_model || '(model default)')
                : '<span style="color:#fca5a5;">belum dikonfigurasi</span>';
            const fb = id.endsWith('_fallback');
            return `<tr style="${fb ? 'opacity:.7;' : ''}"><td style="padding:2px 8px 2px 0; color:#9ca3af;">${ROLE_LABELS[id]}</td><td style="padding:2px 0;"><strong>${formatProviderName(prov)}</strong> · ${model}${healthDot(prov)}</td></tr>`;
        }).join('');
        box.innerHTML = `<div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px;"><strong style="color:#6ee7b7; font-size:0.85em;">Rangkuman aktif (peran → provider · model · status):</strong><table style="margin-top:6px; border-collapse:collapse;">${rows}</table></div>`;
    };

    // Banner di puncak modal: daftar provider BERMASALAH yang dipakai role (penyebab error).
    // Hijau-semua -> banner hijau ringkas. Diisi setelah loadHealth().
    const renderHealthAlert = () => {
        const box = document.getElementById('llm-health-alert');
        if (!box) return;
        const usedProviders = new Set();
        ROLE_IDS.forEach((id) => {
            const sel = document.getElementById('role-' + id);
            if (sel && sel.value) usedProviders.add(sel.value);
        });
        const problems = [];
        usedProviders.forEach((p) => {
            const h = healthMap[p];
            if (h && h.status !== 'ALIVE') {
                const tag = h.status === 'UNAUTHORIZED' ? 'API key invalid'
                    : h.status === 'QUOTA_EXCEEDED' ? 'kuota habis' : 'error/timeout';
                problems.push(`<strong>${formatProviderName(p)}</strong> — ${tag}`);
            }
        });
        if (Object.keys(healthMap).length === 0) { box.innerHTML = ''; return; }
        if (problems.length === 0) {
            box.innerHTML = `<div style="background:rgba(16,185,129,0.1); border-left:3px solid #10b981; padding:8px 10px; border-radius:6px; font-size:0.85em; color:#6ee7b7;">🟢 Semua provider yang dipakai sehat.</div>`;
            return;
        }
        box.innerHTML = `<div style="background:rgba(239,68,68,0.1); border-left:3px solid #ef4444; padding:10px; border-radius:6px; font-size:0.85em; color:#fca5a5;">⚠ <strong>${problems.length} provider bermasalah</strong> (kemungkinan penyebab error pipeline):<ul style="margin:6px 0 0 0; padding-left:18px;">${problems.map((p) => `<li>${p}</li>`).join('')}</ul><div style="margin-top:6px; color:#cbd5e1;">Perbaiki API Key / ganti provider di bawah, atau pindah role ke provider yang sehat.</div></div>`;
    };

    // Muat health (panggilan jaringan, bisa beberapa detik) lalu segarkan badge + banner.
    const refreshHealth = async () => {
        await loadHealth();
        renderRoutingSummary();
        renderHealthAlert();
    };

    const loadRolesIntoForm = async () => {
        // Ambil daftar provider terkonfigurasi + model-nya DULU agar label dropdown
        // menampilkan "provider · model" (bukan cuma provider).
        await loadLLMConfigs();
        prefillConfigForm();
        // Ambil roles tersimpan (dengan retry) lalu PAKSA terapkan, agar pilihan langsung benar
        // dan tak diam-diam jatuh ke default saat satu request gagal.
        try {
            savedRoles = await fetchRolesWithRetry();
        } catch (e) {
            console.warn('Gagal memuat roles (setelah retry):', e.message);
            // Pertahankan savedRoles terakhir (jangan kosongkan). Beri tahu user agar buka ulang.
            showToast('Gagal memuat pilihan model dari server (jaringan). Buka Pengaturan lagi untuk memuat ulang.', 'error');
        }
        populateRoleSelects();           // bangun opsi (preserve prev)
        applyRolesToSelects(savedRoles); // PAKSA nilai tersimpan (otoritatif saat buka)
        renderRoutingSummary();
        // Pasang listener SEKALI per select (hindari akumulasi handler tiap kali modal dibuka).
        ROLE_IDS.forEach((id) => {
            const sel = document.getElementById('role-' + id);
            if (sel && !sel.dataset.listenersBound) {
                sel.addEventListener('change', renderRoutingSummary);
                sel.addEventListener('change', markRolesDirty);
                sel.dataset.listenersBound = '1';
            }
        });
    };

    const formRoles = document.getElementById('form-llm-roles');
    if (formRoles) {
        formRoles.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {};
            ROLE_IDS.forEach((id) => {
                const sel = document.getElementById('role-' + id);
                if (sel) payload[id] = sel.value;
            });
            const btn = e.target.querySelector('button[type="submit"]');
            setButtonLoading(btn, true);
            try {
                await API.updateRoles(payload);
                dirtyRoles = false; // tersimpan
                const r1 = providerInfo[payload.reviewer1];
                const r1m = r1 && r1.has_key ? (r1.default_model || formatProviderName(payload.reviewer1)) : formatProviderName(payload.reviewer1);
                showToast(`✅ Routing tersimpan. Reviewer 1 = ${r1m}. Lihat rekap lengkap di bawah form.`);
                renderRoutingSummary();
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                setButtonLoading(btn, false, 'Simpan Model Routing');
            }
        });
    }

    // ===== GitHub Pages config (publikasi figur Modul 8) =====
    const loadGitHubConfig = async () => {
        try {
            const res = await API.getGitHubConfig();
            const c = res.config || {};
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
            document.getElementById('gh-enabled').checked = !!c.enabled;
            set('gh-owner', c.owner); set('gh-repo', c.repo);
            set('gh-branch', c.branch); set('gh-basepath', c.base_path); set('gh-pages', c.pages_url);
            const tok = document.getElementById('gh-token');
            if (tok) tok.placeholder = res.token_set ? '(token tersimpan — kosongkan = tetap)' : '(belum ada token)';
        } catch (e) { console.warn('Gagal memuat GitHub config:', e.message); }
    };

    // ===== Embed Config =====
    const loadEmbedConfig = async () => {
        try {
            const res = await API.getEmbedConfig();
            const c = res.config || {};
            const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
            set('embed-cfg-endpoint', c.endpoint);
            set('embed-cfg-model', c.model);
            const keyEl = document.getElementById('embed-cfg-key');
            if (keyEl) keyEl.placeholder = res.key_set ? '(key tersimpan — kosongkan = tetap)' : 'API Key';
        } catch (e) { console.warn('Gagal memuat Embed config:', e.message); }
    };

    const formEmbed = document.getElementById('form-embed-config');
    if (formEmbed) {
        formEmbed.addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = (id) => (document.getElementById(id) || {}).value || '';
            const payload = {
                endpoint: val('embed-cfg-endpoint'),
                api_key: val('embed-cfg-key'),
                model: val('embed-cfg-model'),
            };
            const btn = e.target.querySelector('button[type="submit"]');
            setButtonLoading(btn, true);
            try {
                await API.updateEmbedConfig(payload);
                // Tombol SELESAI begitu penyimpanan sukses — jangan gantung menunggu refresh
                // UI di bawah (loadEmbedConfig = panggilan jaringan) agar tombol tak nyangkut
                // "Memproses..." padahal toast sudah bilang tersimpan.
                setButtonLoading(btn, false, 'Simpan Embed Config');
                showToast('Embed config berhasil disimpan!');
                document.getElementById('embed-cfg-key').value = '';
                // Refresh best-effort: kegagalan TIDAK boleh memunculkan toast error (simpan sukses).
                try {
                    await loadEmbedConfig();
                } catch (refreshErr) {
                    console.warn('Refresh setelah simpan Embed config gagal:', refreshErr);
                }
            } catch (error) {
                setButtonLoading(btn, false, 'Simpan Embed Config');
                showToast(error.message, 'error');
            }
        });
    }

    // ===== Scopus Config =====
    const loadScopusConfig = async () => {
        try {
            const res = await API.getScopusConfig();
            const c = res.config || {};
            const keyEl = document.getElementById('scopus-cfg-key');
            if (keyEl) keyEl.placeholder = res.key_set ? '(key tersimpan — kosongkan = tetap)' : 'Scopus API Key';
        } catch (e) { console.warn('Gagal memuat Scopus config:', e.message); }
    };

    const formScopus = document.getElementById('form-scopus-config');
    if (formScopus) {
        formScopus.addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = (id) => (document.getElementById(id) || {}).value || '';
            const payload = {
                api_key: val('scopus-cfg-key'),
            };
            const btn = e.target.querySelector('button[type="submit"]');
            setButtonLoading(btn, true);
            try {
                await API.updateScopusConfig(payload);
                // Tombol SELESAI begitu penyimpanan sukses — jangan gantung menunggu refresh
                // UI di bawah (loadScopusConfig = panggilan jaringan) agar tombol tak nyangkut
                // "Memproses..." padahal toast sudah bilang tersimpan.
                setButtonLoading(btn, false, 'Simpan Scopus Config');
                showToast('Scopus config berhasil disimpan!');
                document.getElementById('scopus-cfg-key').value = '';
                // Refresh best-effort: kegagalan TIDAK boleh memunculkan toast error (simpan sukses).
                try {
                    await loadScopusConfig();
                } catch (refreshErr) {
                    console.warn('Refresh setelah simpan Scopus config gagal:', refreshErr);
                }
            } catch (error) {
                setButtonLoading(btn, false, 'Simpan Scopus Config');
                showToast(error.message, 'error');
            }
        });
    }

    const formGitHub = document.getElementById('form-github-config');
    if (formGitHub) {
        formGitHub.addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = (id) => (document.getElementById(id) || {}).value || '';
            const payload = {
                enabled: document.getElementById('gh-enabled').checked,
                token: val('gh-token'),
                owner: val('gh-owner'), repo: val('gh-repo'),
                branch: val('gh-branch'), base_path: val('gh-basepath'), pages_url: val('gh-pages'),
            };
            const btn = e.target.querySelector('button[type="submit"]');
            setButtonLoading(btn, true);
            try {
                await API.updateGitHubConfig(payload);
                showToast('GitHub config berhasil disimpan!');
                document.getElementById('gh-token').value = '';
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                setButtonLoading(btn, false, 'Simpan GitHub Config');
            }
        });
    }

    if (btnSettings) {
        btnSettings.addEventListener('click', async () => {
            openModal('modal-settings');
            document.getElementById('settings-error-dot')?.classList.add('hidden'); // sudah dilihat
            const alertBox = document.getElementById('llm-health-alert');
            if (alertBox) alertBox.innerHTML = '<div style="font-size:0.85em; color:#9ca3af;">🩺 Memeriksa status provider…</div>';
            loadGitHubConfig();
            loadEmbedConfig();
            loadScopusConfig();
            await loadRolesIntoForm(); // isi role selects dulu agar badge health akurat
            // Form baru saja dimuat dari config TERSIMPAN -> belum ada perubahan. Reset flag
            // (nilai di-set programatik tidak memicu event 'input'/'change', jadi aman).
            dirtyConfig = false;
            dirtyRoles = false;
            refreshHealth();           // cek kesehatan (async) lalu segarkan badge + banner
        });
    }

    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => closeModal('modal-settings'));
    }

    if (btnFetchModels) {
        btnFetchModels.addEventListener('click', async () => {
            const provider = document.getElementById('select-provider').value;
            const apiKey = document.getElementById('input-api-key').value;
            const baseUrl = llmBaseUrlInput ? llmBaseUrlInput.value : '';

            const savedKey = providerInfo[provider] && providerInfo[provider].has_key;
            const status = document.getElementById('llm-config-status');
            if (!apiKey && provider !== 'claude' && !savedKey) {
                showToast('API Key diperlukan untuk memuat model!', 'error');
                return;
            }

            setButtonLoading(btnFetchModels, true);
            selectModel.innerHTML = '<option value="">Memuat model...</option>';
            if (status) status.textContent = '';

            try {
                const res = await API.fetchModels(provider, apiKey, baseUrl);
                selectModel.innerHTML = '';
                if (res.models && res.models.length > 0) {
                    res.models.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m;
                        opt.textContent = m;
                        selectModel.appendChild(opt);
                    });
                    showToast('Model berhasil dimuat!');
                    // #4: memuat model = validasi key secara implisit.
                    if (status) status.innerHTML = `<span style="color:#6ee7b7;">✓ API key valid — ${res.models.length} model dimuat. Pilih model lalu Simpan.</span>`;
                } else {
                    selectModel.innerHTML = '<option value="">Tidak ada model ditemukan</option>';
                    if (status) status.innerHTML = '<span style="color:#fcd34d;">⚠ Key OK tapi tak ada model terdaftar.</span>';
                }
            } catch (error) {
                showToast(error.message, 'error');
                selectModel.innerHTML = '<option value="">Gagal memuat model</option>';
                if (status) status.innerHTML = `<span style="color:#fca5a5;">✗ Gagal (API key/koneksi?): ${error.message}</span>`;
            } finally {
                setButtonLoading(btnFetchModels, false, '🔄 Muat Model');
            }
        });
    }

    // 🧪 Test Model: panggilan completion NYATA ke model TERSIMPAN provider terpilih.
    // Menangkap model terkunci/404 yang lolos cek API key (mis. nvidia "not found for account").
    if (btnTestModel) {
        btnTestModel.addEventListener('click', async () => {
            const provider = document.getElementById('select-provider').value;
            const status = document.getElementById('llm-config-status');
            // Kirim nilai form -> menguji config yang BELUM disimpan (key/base_url/model terpilih).
            // Field kosong -> backend fallback ke config tersimpan.
            const opts = {
                api_key: (document.getElementById('input-api-key') || {}).value || '',
                base_url: (document.getElementById('llm-base-url') || {}).value || '',
                model: (document.getElementById('llm-model') || {}).value || '',
            };
            setButtonLoading(btnTestModel, true);
            if (status) status.innerHTML = `<span style="color:#9ca3af;">🧪 Menguji panggilan nyata ke model ${opts.model || provider}… (bisa ~10-30 dtk)</span>`;
            try {
                const res = await API.testModel(provider, opts);
                if (res.ok) {
                    if (status) status.innerHTML = `<span style="color:#6ee7b7;">✓ Model <strong>${res.model || '(default)'}</strong> BISA dipakai. Balasan uji: "${(res.sample || '').replace(/</g, '&lt;')}"</span>`;
                    showToast('✓ Model bisa dipakai.');
                } else {
                    if (status) status.innerHTML = `<span style="color:#fca5a5;">✗ Model <strong>${res.model || '(default)'}</strong> TIDAK bisa dipakai (mungkin terkunci/404/salah nama). Detail: ${(res.message || '').replace(/</g, '&lt;').slice(0, 300)}</span>`;
                    showToast('✗ Model tidak bisa dipakai — lihat detail.', 'error');
                }
            } catch (e) {
                if (status) status.innerHTML = `<span style="color:#fca5a5;">✗ Gagal menguji: ${e.message}</span>`;
            } finally {
                setButtonLoading(btnTestModel, false, '🧪 Test Model');
            }
        });
    }

    if (formLlmConfig) {
        formLlmConfig.addEventListener('submit', async (e) => {
            e.preventDefault();
            const provider = document.getElementById('select-provider').value;
            const apiKey = document.getElementById('input-api-key').value;
            const model = document.getElementById('llm-model').value;
            const btn = e.target.querySelector('button[type="submit"]');

            const savedKey = providerInfo[provider] && providerInfo[provider].has_key;
            const status = document.getElementById('llm-config-status');
            if (!apiKey && !savedKey) {
                showToast('API Key wajib untuk provider baru!', 'error');
                return;
            }
            if (!model) {
                showToast('Pilih/Muat model terlebih dahulu!', 'error');
                return;
            }

            const llmBaseUrlInput = document.getElementById('llm-base-url');
            const baseUrl = llmBaseUrlInput ? llmBaseUrlInput.value : '';

            setButtonLoading(btn, true);
            try {
                // apiKey kosong -> backend pertahankan key lama (edit model/base_url saja).
                await API.updateLLMConfig(provider, apiKey, model, baseUrl);
                dirtyConfig = false; // tersimpan
                // Tombol SELESAI begitu penyimpanan sukses. JANGAN gantung tombol menunggu
                // refresh UI di bawah (loadLLMConfigs = panggilan jaringan); kalau ditunggu,
                // tombol tampak "Memproses..." lama padahal toast sudah bilang tersimpan.
                setButtonLoading(btn, false, 'Simpan LLM Config');
                showToast(`✅ ${formatProviderName(provider)} (${model}) tersimpan.`);
                document.getElementById('input-api-key').value = '';
                // #1: segarkan providerInfo -> label routing + rekap ikut update; modal tetap
                // terbuka agar user melihat efeknya & bisa lanjut ke Model Routing. Best-effort:
                // kegagalan refresh TIDAK boleh memunculkan toast error (simpan sudah sukses).
                try {
                    await loadLLMConfigs();
                    populateRoleSelects();
                    renderRoutingSummary();
                    prefillConfigForm();
                } catch (refreshErr) {
                    console.warn('Refresh setelah simpan config gagal:', refreshErr);
                }
                if (status) status.innerHTML = '<span style="color:#6ee7b7;">✓ Tersimpan. Provider siap dipakai di Model Routing di bawah.</span>';
            } catch (error) {
                setButtonLoading(btn, false, 'Simpan LLM Config');
                showToast(error.message, 'error');
                if (status) status.innerHTML = `<span style="color:#fca5a5;">✗ ${error.message}</span>`;
            }
        });
    }
}
