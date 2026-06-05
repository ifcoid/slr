import { API } from '../api.js';

export function initHealthDashboard() {
    const btnHealth = document.getElementById('btn-health');
    const sectionHealth = document.getElementById('section-health');
    const btnRefreshHealth = document.getElementById('btn-refresh-health');
    const btnBackHealth = document.getElementById('btn-back-health');
    const healthLoading = document.getElementById('health-loading');
    const healthResults = document.getElementById('health-results');
    
    // Simpan referensi ke section yang aktif sebelumnya agar bisa kembali
    let previousSection = null;

    if (!btnHealth || !sectionHealth) return;

    btnHealth.addEventListener('click', () => {
        // Cari section mana yang sedang aktif selain section-health
        const sections = document.querySelectorAll('main > section');
        sections.forEach(sec => {
            if (!sec.classList.contains('hidden') && sec.id !== 'section-health') {
                previousSection = sec.id;
                sec.classList.add('hidden');
            }
        });
        
        sectionHealth.classList.remove('hidden');
        loadHealthData();
    });

    btnBackHealth.addEventListener('click', () => {
        sectionHealth.classList.add('hidden');
        if (previousSection) {
            document.getElementById(previousSection).classList.remove('hidden');
        } else {
            // Default fallback
            if (localStorage.getItem('auth_token')) {
                document.getElementById('section-new-session').classList.remove('hidden');
            } else {
                document.getElementById('section-login').classList.remove('hidden');
            }
        }
    });

    btnRefreshHealth.addEventListener('click', () => {
        loadHealthData();
    });

    async function loadHealthData() {
        healthLoading.classList.remove('hidden');
        healthResults.innerHTML = '';
        btnRefreshHealth.disabled = true;

        try {
            const res = await API.checkLLMHealth();
            renderHealthTable(res.health || []);
        } catch (error) {
            healthResults.innerHTML = `<div class="error-msg" style="color: #ef4444; padding: 15px; border: 1px solid #ef4444; border-radius: 8px; background: rgba(239, 68, 68, 0.1);">Gagal memuat status kesehatan API: ${error.message}</div>`;
        } finally {
            healthLoading.classList.add('hidden');
            btnRefreshHealth.disabled = false;
        }
    }

    function renderHealthTable(healthData) {
        if (!healthData || healthData.length === 0) {
            healthResults.innerHTML = '<p>Tidak ada konfigurasi provider LLM yang tersimpan.</p>';
            return;
        }

        let tableHtml = `
            <table style="width: 100%; border-collapse: collapse; text-align: left; background: rgba(30, 41, 59, 0.5); border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr style="background: rgba(15, 23, 42, 0.8); border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <th style="padding: 12px 16px;">Provider</th>
                        <th style="padding: 12px 16px;">Status</th>
                        <th style="padding: 12px 16px;">Keterangan</th>
                    </tr>
                </thead>
                <tbody>
        `;

        healthData.forEach(item => {
            let statusBadge = '';
            switch (item.status) {
                case 'ALIVE':
                    statusBadge = '<span style="background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600;">🟢 Sehat</span>';
                    break;
                case 'UNAUTHORIZED':
                    statusBadge = '<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600;">🔴 Invalid Key</span>';
                    break;
                case 'QUOTA_EXCEEDED':
                    statusBadge = '<span style="background: rgba(234, 179, 8, 0.2); color: #facc15; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600;">🟡 Kuota Habis</span>';
                    break;
                default:
                    statusBadge = '<span style="background: rgba(100, 116, 139, 0.2); color: #94a3b8; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600;">⚪ Error/Timeout</span>';
                    break;
            }

            tableHtml += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px 16px; font-weight: 500;">${item.provider}</td>
                    <td style="padding: 12px 16px;">${statusBadge}</td>
                    <td style="padding: 12px 16px; font-size: 0.9em; color: #cbd5e1;">${item.message}</td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
            <div style="margin-top: 15px; font-size: 0.85em; color: #9ca3af;">
                * Pengecekan dilakukan secara real-time ke masing-masing API Server.
            </div>
        `;

        healthResults.innerHTML = tableHtml;
    }
}
