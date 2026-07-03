import { API, getBaseURL } from '../api.js';

export function initHealthDashboard() {
    const btnHealth = document.getElementById('btn-health');
    const sectionHealth = document.getElementById('section-health');
    const btnRefreshHealth = document.getElementById('btn-refresh-health');
    const btnBackHealth = document.getElementById('btn-back-health');
    const healthLoading = document.getElementById('health-loading');
    const healthResults = document.getElementById('health-results');
    const btnPreflight = document.getElementById('btn-preflight');
    const preflightLoading = document.getElementById('preflight-loading');
    const preflightResults = document.getElementById('preflight-results');
    
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

    if (btnPreflight) {
        btnPreflight.addEventListener('click', () => {
            loadPreflightData();
        });
    }

    // Pre-flight: uji SEMUA role pipeline dengan generate NYATA (bukan sekadar GET /models).
    // Tujuannya: ketahui provider rusak (404 model salah/terkunci, 401 key, 429 kuota) di AWAL,
    // sebelum run panjang (ekstraksi/QA) terlanjur jalan dan membuang waktu.
    async function loadPreflightData() {
        if (!preflightLoading || !preflightResults) return;

        // Pre-flight menguji config TERSIMPAN. Bila user baru mengedit Pengaturan tapi belum
        // klik Simpan, hasil pre-flight bisa menyesatkan (menguji nilai lama). Peringatkan dulu.
        const unsaved = (typeof window.hasUnsavedLLMConfig === 'function')
            ? window.hasUnsavedLLMConfig() : { dirty: false, parts: [] };
        if (unsaved.dirty) {
            const proceed = confirm(
                '⚠ Ada perubahan konfigurasi LLM yang BELUM disimpan:\n' +
                '• ' + unsaved.parts.join('\n• ') + '\n\n' +
                'Pre-flight menguji konfigurasi TERSIMPAN, jadi perubahan tadi BELUM ikut diuji.\n' +
                'Sebaiknya buka Pengaturan, klik Simpan, lalu jalankan pre-flight lagi.\n\n' +
                'Tetap lanjut pre-flight dengan config tersimpan saat ini?'
            );
            if (!proceed) return;
        }

        preflightLoading.classList.remove('hidden');
        preflightResults.innerHTML = '';
        healthResults.innerHTML = ''; // jangan tumpang-tindih dgn tabel health lama
        btnPreflight.disabled = true;
        btnRefreshHealth.disabled = true;
        try {
            const res = await API.preflightRoles();
            renderPreflightTable(res.roles || [], !!res.all_usable, unsaved.dirty);
        } catch (error) {
            preflightResults.innerHTML = `<div class="error-msg" style="color:#ef4444;padding:15px;border:1px solid #ef4444;border-radius:8px;background:rgba(239,68,68,0.1);">Gagal menjalankan pre-flight: ${error.message}</div>`;
        } finally {
            preflightLoading.classList.add('hidden');
            btnPreflight.disabled = false;
            btnRefreshHealth.disabled = false;
        }
    }

    const roleLabels = {
        reviewer1: 'Reviewer 1 (Ekstraksi/Screening)',
        reviewer2: 'Reviewer 2 (QA silang)',
        supervisor: 'Supervisor (Resolusi)',
        brain: 'Brain (Saran/Sintesis)',
        auditor: 'Auditor (Audit PICO/Protokol)',
    };

    function provCell(name, modelName, ok, msg) {
        if (!name) return '<span style="color:#64748b;">—</span>';
        const icon = ok ? '🟢' : '🔴';
        const color = ok ? '#4ade80' : '#f87171';
        const m = (modelName || '(default)');
        const errLine = (!ok && msg)
            ? `<div style="font-size:0.8em;color:#fca5a5;margin-top:3px;white-space:pre-wrap;word-break:break-word;">${(msg || '').replace(/</g, '&lt;').slice(0, 300)}</div>`
            : '';
        return `<div style="color:${color};font-weight:600;">${icon} ${name}</div><div style="font-size:0.82em;color:#d6d3d1;">${m.replace(/</g, '&lt;')}</div>${errLine}`;
    }

    function renderPreflightTable(roles, allUsable, unsavedWarn) {
        if (!roles || roles.length === 0) {
            preflightResults.innerHTML = '<p>Tidak ada role LLM untuk diuji (cek Model Routing di Pengaturan).</p>';
            return;
        }
        const unsavedBanner = unsavedWarn
            ? `<div style="padding:10px 14px;background:rgba(234,179,8,0.12);border-left:4px solid #eab308;border-radius:8px;color:#fde68a;margin-bottom:12px;font-size:0.9em;"><strong>⚠ Hasil di bawah dari config TERSIMPAN</strong> — ada perubahan di Pengaturan yang belum Anda Simpan, jadi belum ikut terhitung. Simpan dulu lalu jalankan pre-flight lagi untuk hasil akurat.</div>`
            : '';
        const failed = roles.filter(r => !r.usable);
        const banner = allUsable
            ? `<div style="padding:12px 16px;background:rgba(34,197,94,0.12);border-left:4px solid #22c55e;border-radius:8px;color:#86efac;margin-bottom:16px;"><strong>✅ Semua role siap.</strong> Aman memulai run — tiap role punya minimal satu provider (primary/fallback) yang lolos generate nyata.</div>`
            : `<div style="padding:12px 16px;background:rgba(239,68,68,0.12);border-left:4px solid #ef4444;border-radius:8px;color:#fca5a5;margin-bottom:16px;"><strong>⛔ ${failed.length} role TIDAK bisa dipakai:</strong> ${failed.map(r => roleLabels[r.role] || r.role).join(', ')}.<br>Perbaiki provider di <strong>Pengaturan → Model Routing</strong> (Test Model sampai ✓) SEBELUM memulai run, agar tidak terhenti di tengah jalan.</div>`;

        let table = `
            ${unsavedBanner}
            ${banner}
            <table style="width:100%;border-collapse:collapse;text-align:left;background:rgba(30,41,59,0.5);border-radius:8px;overflow:hidden;">
                <thead>
                    <tr style="background:rgba(15,23,42,0.8);border-bottom:1px solid rgba(255,255,255,0.1);">
                        <th style="padding:12px 16px;">Role</th>
                        <th style="padding:12px 16px;">Primary</th>
                        <th style="padding:12px 16px;">Fallback</th>
                        <th style="padding:12px 16px;">Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
        roles.forEach(r => {
            const usableBadge = r.usable
                ? '<span style="background:rgba(34,197,94,0.2);color:#4ade80;padding:4px 8px;border-radius:4px;font-size:0.85em;font-weight:600;">✅ Siap</span>'
                : '<span style="background:rgba(239,68,68,0.2);color:#f87171;padding:4px 8px;border-radius:4px;font-size:0.85em;font-weight:600;">⛔ Gagal</span>';
            table += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:12px 16px;font-weight:500;">${roleLabels[r.role] || r.role}</td>
                    <td style="padding:12px 16px;">${provCell(r.primary, r.primary_model, r.primary_ok, r.primary_message)}</td>
                    <td style="padding:12px 16px;">${provCell(r.fallback, r.fallback_model, r.fallback_ok, r.fallback_message)}</td>
                    <td style="padding:12px 16px;">${usableBadge}</td>
                </tr>
            `;
        });
        table += `
                </tbody>
            </table>
            <div style="margin-top:15px;font-size:0.85em;color:#9ca3af;">
                * Pre-flight memanggil <strong>generate nyata</strong> (bukan cuma cek konektivitas) ke tiap provider unik sekali — menangkap nama model salah/terkunci (404) yang lolos dari Refresh Status biasa. Role "Siap" = primary ATAU fallback lolos.
            </div>
        `;
        preflightResults.innerHTML = table;
    }

    async function loadHealthData() {
        healthLoading.classList.remove('hidden');
        healthResults.innerHTML = '';
        if (preflightResults) preflightResults.innerHTML = ''; // hindari dua tabel sekaligus
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
                    statusBadge = '<span style="background: rgba(100, 116, 139, 0.2); color: #a8a29e; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600;">⚪ Error/Timeout</span>';
                    break;
            }

            tableHtml += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px 16px; font-weight: 500;">${item.provider}</td>
                    <td style="padding: 12px 16px;">${statusBadge}</td>
                    <td style="padding: 12px 16px; font-size: 0.9em; color: #d6d3d1;">${item.message}</td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
            <div style="margin-top: 15px; font-size: 0.85em; color: #9ca3af;">
                * Pengecekan dilakukan secara real-time ke masing-masing API Server.
            </div>

            <!-- MCP GUIDE BOX -->
            <div style="margin-top: 30px; padding: 20px; background: rgba(13, 148, 136, 0.1); border: 1px solid rgba(13, 148, 136, 0.3); border-radius: 8px;">
                <h3 style="margin-top: 0; color: #5eead4; font-size: 1.1em; margin-bottom: 15px;">🔌 Mode Pasif: Integrasi MCP Server</h3>
                <p style="font-size: 0.9em; margin-bottom: 10px; color: #e2e8f0;">
                    Jika semua API LLM di atas penuh/error (terutama saat *weekend*), Anda bisa menggunakan **Mode Pasif** dengan menghubungkan AI eksternal Anda (misal: Claude Desktop, Cursor, atau *agent* lainnya) ke NSA.
                </p>
                <div style="margin-bottom: 15px;">
                    <strong style="font-size: 0.85em; color: #d6d3d1;">1. Pengaturan Konfigurasi (Endpoint SSE):</strong>
                    <div style="background: #1c1917; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 0.85em; margin-top: 5px; color: #a7f3d0; word-break: break-all;">
                        URL MCP (SSE): ${getBaseURL()}/mcp/sse
                    </div>
                </div>
                <div>
                    <strong style="font-size: 0.85em; color: #d6d3d1;">2. Prompt (Copy-Paste ke AI Agent Anda):</strong>
                    <div style="background: #1c1917; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 0.85em; margin-top: 5px; color: #fde047; white-space: pre-wrap;">"Tolong koneksikan dirimu ke MCP Server di atas. Ambil session_id disertasi saya dari URL saat ini, panggil 'get_screener_briefing' untuk memahami aturannya, lalu panggil 'get_pending_disagreements'. Berikan saya tabel perbandingannya, dan jika saya setuju, panggil 'submit_supervisor_resolution' untuk menyelesaikan semua errornya."</div>
                </div>
            </div>
        `;

        healthResults.innerHTML = tableHtml;
    }
}
