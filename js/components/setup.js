// js/components/setup.js
import { API, getBaseURL, setBaseURL } from '../api.js';
import { openModal, closeModal, showToast, setButtonLoading } from '../ui.js';

export function initSetup() {
    const btnSettings = document.getElementById('btn-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const inputBaseUrl = document.getElementById('input-base-url');
    const formLlmConfig = document.getElementById('form-llm-config');
    const btnFetchModels = document.getElementById('btn-fetch-models');
    const selectModel = document.getElementById('llm-model');

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

    // ===== Model Routing (peran -> provider) =====
    const ROLE_IDS = ['reviewer1', 'reviewer1_fallback', 'reviewer2', 'reviewer2_fallback', 'supervisor', 'supervisor_fallback', 'brain', 'brain_fallback'];
    const PROVIDERS = ['gemini', 'groq', 'zhipu', 'claude', 'openrouter', 'cohere', 'xiaomi', 'rprompt'];
    let roleSelectsPopulated = false;

    const populateRoleSelects = () => {
        if (roleSelectsPopulated) return;
        ROLE_IDS.forEach((id) => {
            const sel = document.getElementById('role-' + id);
            if (!sel) return;
            sel.innerHTML = PROVIDERS.map((p) => `<option value="${p}">${p}</option>`).join('');
        });
        roleSelectsPopulated = true;
    };

    const loadRolesIntoForm = async () => {
        populateRoleSelects();
        try {
            const r = await API.getRoles();
            ROLE_IDS.forEach((id) => {
                const sel = document.getElementById('role-' + id);
                if (sel && r[id]) sel.value = r[id];
            });
        } catch (e) {
            console.warn('Gagal memuat roles:', e.message);
        }
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
                showToast('Model Routing berhasil disimpan!');
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
        btnSettings.addEventListener('click', () => {
            openModal('modal-settings');
            loadRolesIntoForm();
            loadGitHubConfig();
        });
    }

    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => closeModal('modal-settings'));
    }

    if (btnFetchModels) {
        btnFetchModels.addEventListener('click', async () => {
            const provider = document.getElementById('select-provider').value;
            const apiKey = document.getElementById('input-api-key').value;
            const llmBaseUrlInput = document.getElementById('llm-base-url');
            const baseUrl = llmBaseUrlInput ? llmBaseUrlInput.value : '';

            if (!apiKey && provider !== 'claude') {
                showToast('API Key diperlukan untuk memuat model!', 'error');
                return;
            }

            setButtonLoading(btnFetchModels, true);
            selectModel.innerHTML = '<option value="">Memuat model...</option>';
            
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
                } else {
                    selectModel.innerHTML = '<option value="">Tidak ada model ditemukan</option>';
                }
            } catch (error) {
                showToast(error.message, 'error');
                selectModel.innerHTML = '<option value="">Gagal memuat model</option>';
            } finally {
                setButtonLoading(btnFetchModels, false, '🔄 Muat Model');
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

            if (!apiKey) {
                showToast('API Key tidak boleh kosong!', 'error');
                return;
            }

            if (!model) {
                showToast('Pilih model terlebih dahulu!', 'error');
                return;
            }

            const llmBaseUrlInput = document.getElementById('llm-base-url');
            const baseUrl = llmBaseUrlInput ? llmBaseUrlInput.value : '';

            setButtonLoading(btn, true);
            try {
                await API.updateLLMConfig(provider, apiKey, model, baseUrl);
                showToast(`Konfigurasi ${provider} berhasil disimpan!`);
                document.getElementById('input-api-key').value = '';
                closeModal('modal-settings');
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                setButtonLoading(btn, false, 'Simpan LLM Config');
            }
        });
    }
}
