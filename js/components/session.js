// js/components/session.js
import { API } from '../api.js';
import { showToast, setButtonLoading, toggleHidden } from '../ui.js';

export function initSession(onSessionCreated) {
    const formNewSession = document.getElementById('form-new-session');

    if (formNewSession) {
        formNewSession.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('input-session-id').value.trim();
            const topic = document.getElementById('input-topic').value.trim();
            const btn = e.target.querySelector('button[type="submit"]');

            if (!id || !topic) {
                showToast('ID dan Topik wajib diisi!', 'error');
                return;
            }

            setButtonLoading(btn, true);
            try {
                const result = await API.createSession(id, topic);
                showToast(`Sesi "${id}" berhasil dibuat! Agen sedang bekerja.`);
                
                // Switch view to tracker
                toggleHidden('section-new-session', false);
                toggleHidden('section-tracker', true);
                
                // Callback to start tracking
                if (onSessionCreated) onSessionCreated(id);
                
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                setButtonLoading(btn, false, 'Mulai Eksekusi Agen');
            }
        });
    }
}
