// js/components/setup.js
import { API, getBaseURL, setBaseURL } from '../api.js';
import { openModal, closeModal, showToast, setButtonLoading } from '../ui.js';

export function initSetup() {
    const btnSettings = document.getElementById('btn-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const inputBaseUrl = document.getElementById('input-base-url');
    const formLlmConfig = document.getElementById('form-llm-config');

    // Load initial Base URL to input
    if (inputBaseUrl) {
        inputBaseUrl.value = getBaseURL();
        inputBaseUrl.addEventListener('change', (e) => {
            setBaseURL(e.target.value);
            showToast('Base URL API berhasil diperbarui!');
        });
    }

    if (btnSettings) {
        btnSettings.addEventListener('click', () => openModal('modal-settings'));
    }

    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', () => closeModal('modal-settings'));
    }

    if (formLlmConfig) {
        formLlmConfig.addEventListener('submit', async (e) => {
            e.preventDefault();
            const provider = document.getElementById('select-provider').value;
            const apiKey = document.getElementById('input-api-key').value;
            const btn = e.target.querySelector('button[type="submit"]');

            if (!apiKey) {
                showToast('API Key tidak boleh kosong!', 'error');
                return;
            }

            setButtonLoading(btn, true);
            try {
                await API.updateLLMConfig(provider, apiKey);
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
