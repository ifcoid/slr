// js/components/session.js
import { API } from '../api.js';
import { showToast, setButtonLoading, toggleHidden } from '../ui.js';

const PREFLIGHT_ROLE_LABELS = {
    reviewer1: 'Reviewer 1 (Ekstraksi/Screening)',
    reviewer2: 'Reviewer 2 (QA silang)',
    supervisor: 'Supervisor (Resolusi)',
    brain: 'Brain (Saran/Sintesis)',
    auditor: 'Auditor (Audit PICO/Protokol)',
};

// P1 — Auto pre-flight SEBELUM memulai run panjang. Menguji SEMUA role LLM dengan generate
// NYATA (bukan sekadar cek konektivitas /models) agar provider rusak/rate-limited/kuota-habis
// ketahuan di AWAL, sebelum user investasi waktu berjam-jam lalu terhenti di tengah (mis. QA).
// Overridable: user boleh 'Mulai tetap'. Bila endpoint pre-flight sendiri gagal, JANGAN
// halangi pembuatan sesi — degrade dengan konfirmasi. Return true = boleh lanjut.
async function preflightBeforeStart(btn) {
    const prevHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '🔎 Menguji semua provider LLM… (±1–2 mnt)';
    try {
        const res = await API.preflightRoles();
        const roles = res.roles || [];
        if (res.all_usable || roles.length === 0) return true; // semua siap / belum ada role
        const failed = roles.filter(r => !r.usable);
        const lines = failed.map(r => {
            const rl = PREFLIGHT_ROLE_LABELS[r.role] || r.role;
            const prov = [r.primary, r.primary_model].filter(Boolean).join('/') || '(tak diset)';
            const msg = (r.primary_message || r.fallback_message || 'gagal generate').replace(/\s+/g, ' ').slice(0, 180);
            return `• ${rl} — ${prov}: ${msg}`;
        }).join('\n');
        return confirm(
            `⛔ ${failed.length} role LLM TIDAK bisa dipakai (hasil uji generate nyata):\n\n${lines}\n\n` +
            `Disarankan buka Pengaturan → Model Routing, perbaiki/ganti provider (Test Model sampai ✓) SEBELUM memulai, agar run tidak terhenti di tengah jalan (mis. saat QA/ekstraksi).\n\n` +
            `Tetap MULAI sekarang?`
        );
    } catch (e) {
        // Endpoint pre-flight gagal (mis. backend lama tanpa /llm/preflight) — jangan blokir.
        return confirm(`Tidak bisa menjalankan pre-flight provider (${e.message}).\n\nTetap mulai sesi tanpa pengecekan awal?`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = prevHTML;
    }
}

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

            // P1: gerbang pre-flight proaktif sebelum run panjang dimulai.
            const okToStart = await preflightBeforeStart(btn);
            if (!okToStart) {
                showToast('Dibatalkan — perbaiki provider di Pengaturan lalu mulai lagi.', 'error');
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
