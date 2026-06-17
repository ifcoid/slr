// js/main.js
import { initSetup } from './components/setup.js';
import { initAuth } from './components/auth.js';
import { initSession } from './components/session.js';
import { startTracking } from './components/tracker.js';
import { initHealthDashboard } from './components/health.js';
import { toggleHidden, openModal, closeModal, showToast } from './ui.js';
import { API, getBaseURL } from './api.js';

// --- Backend Connection Check ---
async function checkBackendConnection() {
    const baseURL = getBaseURL();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${baseURL}/../health`, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeout);
        return response.ok;
    } catch (e) {
        // Try the LLM health endpoint as fallback
        try {
            const controller2 = new AbortController();
            const timeout2 = setTimeout(() => controller2.abort(), 5000);
            const response2 = await fetch(`${baseURL}/llm/health`, {
                method: 'GET',
                signal: controller2.signal,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
                }
            });
            clearTimeout(timeout2);
            return response2.ok || response2.status === 401; // 401 means backend is alive but needs auth
        } catch (e2) {
            return false;
        }
    }
}

function showConnectionModal(errorDetail) {
    const modal = document.getElementById('modal-connection');
    const errorEl = document.getElementById('connection-error-detail');
    if (errorDetail) {
        errorEl.textContent = `Detail: ${errorDetail}`;
        errorEl.style.display = 'block';
    } else {
        errorEl.style.display = 'none';
    }
    modal.classList.remove('hidden');
}

function hideConnectionModal() {
    const modal = document.getElementById('modal-connection');
    modal.classList.add('hidden');
}

function initConnectionCheck() {
    const btnRetry = document.getElementById('btn-conn-retry');
    const btnSettings = document.getElementById('btn-conn-settings');
    const checkingEl = document.getElementById('connection-checking');

    btnRetry.addEventListener('click', async () => {
        btnRetry.disabled = true;
        checkingEl.classList.remove('hidden');

        const connected = await checkBackendConnection();
        checkingEl.classList.add('hidden');
        btnRetry.disabled = false;

        if (connected) {
            hideConnectionModal();
            showToast('Backend terhubung!', 'success');
            // Update settings button to show connected state
            const btnSettingsHeader = document.getElementById('btn-settings');
            if (btnSettingsHeader) {
                btnSettingsHeader.style.color = '#10b981';
                btnSettingsHeader.innerHTML = '⚙️ Configured';
            }
        } else {
            showToast('Backend masih tidak terhubung', 'error');
        }
    });

    btnSettings.addEventListener('click', () => {
        openModal('modal-settings');
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // 0. Init Auth
    initAuth();

    // 1. Initialize API Base URL and LLM Config Setup logic
    initSetup();
    
    // Initialize Health Dashboard
    initHealthDashboard();

    // Initialize connection check modal buttons
    initConnectionCheck();

    const btnSettings = document.getElementById('btn-settings');
    if (!localStorage.getItem('apiBaseURL')) {
        console.warn('apiBaseURL tidak ditemukan di localStorage. Membuka modal pengaturan otomatis.');
        openModal('modal-settings');
        if (btnSettings) {
            btnSettings.style.color = '#ef4444';
            btnSettings.innerHTML = '⚠️ Set API URL!';
        }
    } else {
        if (btnSettings) {
            btnSettings.style.color = '#10b981';
            btnSettings.innerHTML = '⚙️ Configured';
        }
    }

    // Backend connectivity check on page load
    const connected = await checkBackendConnection();
    if (!connected) {
        const baseURL = getBaseURL();
        showConnectionModal(`Tidak dapat terhubung ke ${baseURL}`);
    }

    if (!localStorage.getItem('auth_token')) {
        return; // Hentikan inisialisasi lain jika belum login
    }

    // 2. Cek apakah ada sesi aktif yang tersimpan sebelumnya
    const activeSessionId = localStorage.getItem('activeSessionId');
    if (activeSessionId) {
        // Switch view to tracker
        toggleHidden('section-new-session', false);
        toggleHidden('section-tracker', true);
        // Langsung mulai tracking tanpa harus submit form
        startTracking(activeSessionId);
    }

    // 3. Initialize Session Creation logic
    initSession((sessionId) => {
        // Switch view to tracker
        toggleHidden('section-new-session', false);
        toggleHidden('section-tracker', true);
        // Callback when a new session is successfully created
        localStorage.setItem('activeSessionId', sessionId);
        startTracking(sessionId);
    });

    // 4. Header scroll effect
    const mainHeader = document.querySelector('.main-header');
    if (mainHeader) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                mainHeader.classList.add('scrolled');
            } else {
                mainHeader.classList.remove('scrolled');
            }
        });
    }

    console.log('Agentic SLR Orchestrator - Frontend Initialized');
});

// Global functions for Extraction Viewer Modal
window.showExtractionModal = async function(filterAmbiguous = false) {
    const sessionId = localStorage.getItem('activeSessionId');
    if (!sessionId) {
        showToast('Error: No active session', 'error');
        return;
    }

    const modal = document.getElementById('extraction-modal');
    const container = document.getElementById('extraction-table-container');
    container.innerHTML = '<p style="text-align:center; padding:20px;">Memuat data ekstraksi dari server...</p>';
    openModal('extraction-modal');

    try {
        const res = await API.getExtractions(sessionId);
        if (!res.extractions || res.extractions.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px;">Belum ada data ekstraksi.</p>';
            return;
        }

        // Generate Table
        let html = '';
        if (filterAmbiguous) {
            html += '<div style="background: rgba(234, 179, 8, 0.1); border-left: 4px solid #eab308; padding: 10px; margin-bottom: 15px; color: #fef08a;"><strong>Mode Filter Aktif:</strong> Saat ini Anda HANYA melihat paper yang memiliki isian rancu/ambigu (ditandai dengan kolom kuning tebal). Paper lain disembunyikan.</div>';
        }
        
        html += '<table class="table-modern" style="width:100%; white-space:nowrap;"><thead><tr>';
        html += '<th style="position:sticky; left:0; background:var(--bg-secondary); z-index:2;">Title</th>';
        
        // Find all unique fields across all extractions
        const fieldKeys = new Set();
        res.extractions.forEach(ext => {
            if (ext.fields) {
                ext.fields.forEach(f => fieldKeys.add(f.key));
            }
        });
        
        Array.from(fieldKeys).forEach(k => {
            html += `<th>${k}</th>`;
        });
        html += '<th>Notes / Coverage</th>';
        html += '<th>Model AI</th>';
        html += '</tr></thead><tbody>';

        res.extractions.forEach(ext => {
            // Jika filterAmbiguous aktif, pastikan paper ini memiliki setidaknya 1 ambiguous
            if (filterAmbiguous) {
                if (!ext.ambiguous || ext.ambiguous.length === 0) {
                    return; // Skip rendering this row entirely
                }
            }

            html += `<tr>`;
            html += `<td style="position:sticky; left:0; background:var(--bg-main); border-right:1px solid var(--border-color); max-width:300px; overflow:hidden; text-overflow:ellipsis;" title="${ext.Title}">${ext.Title || 'Unknown'}</td>`;
            
            const fieldMap = {};
            if (ext.fields) {
                ext.fields.forEach(f => {
                    fieldMap[f.key] = f;
                });
            }

            Array.from(fieldKeys).forEach(k => {
                const f = fieldMap[k];
                if (!f) {
                    html += `<td style="color:var(--text-secondary);">-</td>`;
                } else {
                    let style = '';
                    if (f.status === 'NOT_REPORTED') style = 'color:#fca5a5;font-style:italic;';
                    // Cek ambiguitas
                    let isAmbiguous = false;
                    if (ext.ambiguous && Array.isArray(ext.ambiguous)) {
                        isAmbiguous = ext.ambiguous.includes(k);
                    }
                    if (isAmbiguous) style = 'color:#fcd34d;font-weight:bold;';
                    
                    html += `<td style="${style}" title="Raw: ${f.raw_value || ''}">${f.value || f.status}</td>`;
                }
            });
            
            html += `<td style="max-width:200px; white-space:normal; font-size:0.85em;">Coverage: ${ext.coverage || '-'}</td>`;
            html += `<td style="max-width:150px; font-size:0.85em; color:#9ca3af;">${ext.model_extraction || 'Default'}</td>`;
            html += `</tr>`;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
    } catch (e) {
        container.innerHTML = `<p style="text-align:center; padding:20px; color:#ef4444;">Gagal memuat data: ${e.message}</p>`;
    }
};

window.closeExtractionModal = function() {
    closeModal('extraction-modal');
};

window.showAmbiguityResolutionModal = async function() {
    const sessionId = localStorage.getItem('activeSessionId');
    if (!sessionId) return;
    
    // Close extraction modal if open
    document.getElementById('extraction-modal').classList.add('hidden');
    
    const container = document.getElementById('ambiguity-list-container');
    container.innerHTML = '<p style="text-align:center; padding:20px;">Memuat data ambigu...</p>';
    document.getElementById('ambiguity-resolution-modal').classList.remove('hidden');

    try {
        const res = await API.getAmbiguousExtractions(sessionId);
        if (!res.extractions || res.extractions.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px; color:#a3e635;">Hore! Tidak ada data yang ambigu.</p>';
            return;
        }

        let html = `
        <div style="margin-bottom: 20px; text-align: center;">
            <button id="btn-auto-resolve-all" class="btn btn-primary" onclick="runAutoResolveAll()" style="font-size: 1.1em; padding: 10px 20px; background-color: #10b981; border-color: #059669; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
                🤖 Auto-Resolve Semua Ambigu
            </button>
            <p id="progress-auto-resolve-all" style="margin-top: 10px; color: #9ca3af; font-size: 0.9em;"></p>
        </div>
        <div id="ambiguity-cards-container">
        `;
        
        window.currentAmbiguousTasks = [];

        res.extractions.forEach(ext => {
            if (!ext.ambiguous || ext.ambiguous.length === 0) return;
            
            ext.ambiguous.forEach(fieldKey => {
                window.currentAmbiguousTasks.push({ extId: ext._id, fieldKey: fieldKey });
                const f = (ext.fields || []).find(x => x.key === fieldKey);
                const rawVal = f ? f.value : 'N/A';
                const evidence = f ? f.evidence : 'N/A';
                
                html += `
                <div class="card" style="padding: 15px; border-left: 4px solid #fcd34d; background: rgba(252, 211, 77, 0.05); margin-bottom: 10px;" id="card-${ext._id}-${fieldKey}">
                    <h3 style="margin-top: 0; font-size: 1.1em; color: var(--text-primary);">${ext.Title}</h3>
                    <div style="display: flex; gap: 20px; margin-bottom: 10px; font-size: 0.9em;">
                        <div><strong style="color: #9ca3af;">Field:</strong> <span style="color: #fef08a;">${fieldKey}</span></div>
                        <div style="flex: 1;"><strong style="color: #9ca3af;">Nilai LLM Awal:</strong> ${rawVal}</div>
                    </div>
                    <div style="font-size: 0.85em; color: #6b7280; margin-bottom: 15px; font-style: italic;">
                        <strong>Evidence Terakhir:</strong> ${evidence}
                    </div>
                    
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="text" id="input-${ext._id}-${fieldKey}" class="input-modern" style="flex: 1; padding: 8px;" placeholder="Ketik nilai yang benar secara manual di sini..." value="${rawVal !== '[NOT REPORTED]' && rawVal !== 'AMBIGUOUS' ? rawVal : ''}">
                        
                        <button class="btn btn-secondary" onclick="saveManualResolution('${ext._id}', '${fieldKey}')" style="border-color: #3b82f6; color: #60a5fa;">💾 Save (Manual)</button>
                        <button class="btn btn-secondary" onclick="runAutoResolve('${ext._id}', '${fieldKey}')" style="border-color: #eab308; color: #fef08a;">🤖 Auto-Resolve (AI)</button>
                    </div>
                    <div id="loader-${ext._id}-${fieldKey}" class="hidden" style="margin-top: 10px; color: #9ca3af; font-size: 0.85em;">Sedang memproses dengan LLM...</div>
                </div>`;
            });
        });
        
        html += `</div>`; // close ambiguity-cards-container
        container.innerHTML = html;
        
        if (window.currentAmbiguousTasks.length === 0) {
            document.getElementById('btn-auto-resolve-all').style.display = 'none';
        }
        
    } catch (e) {
        container.innerHTML = `<p style="text-align:center; padding:20px; color:#ef4444;">Gagal memuat data ambigu: ${e.message}</p>`;
    }
};

window.saveManualResolution = async function(extId, fieldKey) {
    const sessionId = localStorage.getItem('activeSessionId');
    const inputEl = document.getElementById(`input-${extId}-${fieldKey}`);
    const resolvedValue = inputEl.value.trim();
    if (!resolvedValue) {
        showToast('Nilai manual tidak boleh kosong', 'error');
        return;
    }
    
    try {
        await API.resolveExtractionManual(sessionId, extId, fieldKey, resolvedValue);
        showToast(`Field ${fieldKey} berhasil di-resolve!`, 'success');
        document.getElementById(`card-${extId}-${fieldKey}`).style.display = 'none';
    } catch(e) {
        showToast(`Gagal menyimpan: ${e.message}`, 'error');
    }
};

window.runAutoResolve = async function(extId, fieldKey) {
    const sessionId = localStorage.getItem('activeSessionId');
    const loader = document.getElementById(`loader-${extId}-${fieldKey}`);
    const card = document.getElementById(`card-${extId}-${fieldKey}`);
    
    loader.classList.remove('hidden');
    
    try {
        const res = await API.resolveExtractionAuto(sessionId, extId, fieldKey);
        showToast(`Field ${fieldKey} auto-resolve berhasil!`, 'success');
        
        // Ganti isi card untuk menunjukkan hasil sukses
        card.style.borderLeftColor = '#10b981';
        card.style.background = 'rgba(16, 185, 129, 0.05)';
        card.innerHTML = `
            <div style="color: #10b981; font-weight: bold; margin-bottom: 10px;">✅ Terselesaikan Otomatis</div>
            <div style="font-size: 0.9em; margin-bottom: 5px;"><strong style="color:#9ca3af;">Field:</strong> ${fieldKey}</div>
            <div style="font-size: 0.9em; margin-bottom: 5px;"><strong style="color:#9ca3af;">Nilai Baru:</strong> ${res.resolved_value}</div>
            <div style="font-size: 0.85em; margin-bottom: 5px;"><strong style="color:#9ca3af;">Model AI Resolusi:</strong> ${res.model_used || 'Default'}</div>
            <div style="font-size: 0.85em; color: #6b7280; font-style: italic;"><strong style="color:#9ca3af;">Evidence:</strong> ${res.evidence}</div>
        `;
        
        setTimeout(() => {
            card.style.display = 'none';
        }, 15000); // hilangkan card setelah 15 detik biar sempat terbaca
    } catch(e) {
        showToast(`Auto-Resolve gagal: ${e.message}`, 'error');
        loader.classList.add('hidden');
        throw e; // Added to propagate error to runAutoResolveAll
    }
};

window.runAutoResolveAll = async function() {
    const tasks = window.currentAmbiguousTasks;
    if (!tasks || tasks.length === 0) return;
    
    const btn = document.getElementById('btn-auto-resolve-all');
    const progress = document.getElementById('progress-auto-resolve-all');
    
    btn.disabled = true;
    btn.innerHTML = '🤖 Memproses...';
    
    let successCount = 0;
    let failCount = 0;
    let currentIndex = 0;
    const CONCURRENCY_LIMIT = 3; // Proses 3 field sekaligus agar lebih cepat namun tidak terkena rate-limit
    
    const worker = async () => {
        while (currentIndex < tasks.length) {
            const index = currentIndex++;
            const t = tasks[index];
            
            // Update progress (hanya perkiraan karena concurrent)
            progress.innerText = `Memproses... (Selesai: ${successCount+failCount} dari ${tasks.length} field)`;
            
            try {
                await window.runAutoResolve(t.extId, t.fieldKey);
                successCount++;
            } catch (e) {
                failCount++;
            }
            
            progress.innerText = `Memproses... (Selesai: ${successCount+failCount} dari ${tasks.length} field)`;
        }
    };
    
    const workers = [];
    for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
        workers.push(worker());
    }
    
    await Promise.all(workers);
    
    progress.innerText = `Selesai! ${successCount} berhasil di-resolve. ${failCount} gagal/masih ambigu (silakan gunakan resolusi manual).`;
    btn.innerHTML = '🤖 Selesai';
    
    if (failCount === 0) {
        setTimeout(() => {
            document.getElementById('ambiguity-resolution-modal').classList.add('hidden');
            window.showExtractionModal();
        }, 3000);
    }
};

window.downloadExtractionMarkdown = async (sessionId) => {
    try {
        const btn = document.getElementById('btn-dl-ext-md');
        if (btn) btn.innerText = "⏳ Sedang Mengunduh...";
        
        const session = await API.getSession(sessionId);
        const extractionsRes = await API.getExtractions(sessionId);
        const extractions = extractionsRes.extractions || [];
        
        const l = session.extraction_log || {};
        const rate = (l.disagreement_rate || 0).toFixed(1);

        let md = `# Laporan Hasil Ekstraksi Data (Full-Text)\n\n`;
        md += `## 📋 Protokol Ekstraksi Saat Ini\n`;
        md += `**Framework:** ${session.framework_selection?.framework || 'Tidak ada'}\n\n`;
        
        if (session.framework_selection && session.framework_selection.columns) {
            md += `| Kolom | Kategori | Deskripsi |\n`;
            md += `|-------|----------|-----------|\n`;
            session.framework_selection.columns.forEach(c => {
                md += `| ${c.key} | ${c.category || ''} | ${c.desc || ''} |\n`;
            });
            md += `\n`;
        }

        md += `## 🔍 xAI: Langkah AI, Prompt & Model Dibalik Ekstraksi Ini\n`;
        md += `**Langkah-Langkah yang Dilakukan Agent AI:**\n`;
        md += `1. **Persiapan RAG:** AI memuat indeks vektor teks penuh (full-text) dari PDF yang telah diunduh di Modul 6.\n`;
        md += `2. **Ekstraksi Massal (Reviewer 1):** Model Ekstraksi membaca secara iteratif setiap paper dan mengekstrak data spesifik berdasarkan definisi operasional dan struktur framework (Prompt).\n`;
        md += `3. **Penanganan Data Kosong:** Jika informasi tak ditemukan dalam teks, AI dilarang menebak dan diwajibkan mengisinya dengan [NOT REPORTED].\n`;
        md += `4. **Spot-Verification (Reviewer 2):** Model Refine Protocol (AI Kedua) mengambil sampel acak 20% dan me-review field yang terindikasi "AMBIGUOUS" untuk dibandingkan secara ketat dengan isi teks asli.\n`;
        md += `5. **Kalkulasi Disagreement:** Tingkat kerancuan dihitung untuk menentukan apakah ekstraksi dapat dilanjutkan atau memerlukan perbaikan manual (Refine Protocol).\n\n`;
        
        if (l.model_extraction) md += `- **LLM Model Ekstraksi (Reviewer 1):** ${l.model_extraction}\n`;
        if (l.model_refine_protocol) md += `- **LLM Model Refine Protocol (Reviewer 2):** ${l.model_refine_protocol}\n`;
        
        if (l.system_prompt) {
            md += `\n**System Prompt (Instruksi Agent Ekstraksi):**\n\`\`\`\n${l.system_prompt}\n\`\`\`\n\n`;
        }
        
        md += `## 📈 Hasil Perhitungan Matematis\n`;
        md += `- **Total Paper:** ${l.total_extracted || 0} paper berhasil dibaca dan diekstrak datanya oleh AI (Reviewer 1).\n`;
        md += `- **Sampel Pengecekan Kualitas (Cross-check):** ${l.verified_sample || 0} paper.\n`;
        md += `- **Tingkat Perbedaan Pemahaman (Disagreement Rate):** ${rate}%\n`;
        md += `- **Temuan Kerancuan:** ${l.ambiguous_count || 0} isian data (seperti metodologi, hasil, atau variabel lainnya) ditandai ambigu/membingungkan oleh Reviewer 2.\n\n`;

        md += `## 📊 Tabel Ekstraksi\n`;
        
        if (extractions && extractions.length > 0 && session.framework_selection && session.framework_selection.columns) {
            let headers = ['DOI / Judul'].concat(session.framework_selection.columns.map(c => c.key));
            md += `| ${headers.join(' | ')} |\n`;
            md += `| ${headers.map(() => '---').join(' | ')} |\n`;
            
            extractions.forEach(ext => {
                let row = [`${ext.doi || 'N/A'}<br>${ext.title}`];
                session.framework_selection.columns.forEach(c => {
                    let fieldObj = (ext.fields || []).find(f => f.key === c.key);
                    let val = fieldObj ? (fieldObj.value || '-') : '-';
                    val = String(val).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
                    row.push(val);
                });
                md += `| ${row.join(' | ')} |\n`;
            });
        } else {
            md += `*Data ekstraksi tidak tersedia.*\n`;
        }

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Laporan_Ekstraksi_Modul7_${sessionId}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (btn) btn.innerText = "📥 Download Laporan (MD)";
    } catch (e) {
        console.error(e);
        alert('Gagal mendownload laporan: ' + e.message);
        const btn = document.getElementById('btn-dl-ext-md');
        if (btn) btn.innerText = "📥 Download Laporan (MD)";
    }
};
