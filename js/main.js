// js/main.js
import { initSetup } from './components/setup.js';
import { initAuth } from './components/auth.js';
import { initSession } from './components/session.js';
import { startTracking } from './components/tracker.js';
import { initHealthDashboard } from './components/health.js';
import { toggleHidden, openModal } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // 0. Init Auth
    initAuth();

    // 1. Initialize API Base URL and LLM Config Setup logic
    initSetup();
    
    // Initialize Health Dashboard
    initHealthDashboard();

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
window.showExtractionModal = async function() {
    const sessionId = localStorage.getItem('activeSessionId');
    if (!sessionId) {
        window.showToast('Error: No active session', 'error');
        return;
    }

    const modal = document.getElementById('extraction-modal');
    const container = document.getElementById('extraction-table-container');
    container.innerHTML = '<p style="text-align:center; padding:20px;">Memuat data ekstraksi dari server...</p>';
    modal.style.display = 'block';

    try {
        const res = await window.API.getExtractions(sessionId);
        if (!res.extractions || res.extractions.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px;">Belum ada data ekstraksi.</p>';
            return;
        }

        // Generate Table
        let html = '<table class="table-modern" style="width:100%; white-space:nowrap;"><thead><tr>';
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
        html += '</tr></thead><tbody>';

        res.extractions.forEach(ext => {
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
                        isAmbiguous = ext.ambiguous.some(amb => amb.key === k);
                    }
                    if (isAmbiguous) style = 'color:#fcd34d;font-weight:bold;';
                    
                    html += `<td style="${style}" title="Raw: ${f.raw_value || ''}">${f.value || f.status}</td>`;
                }
            });
            
            html += `<td style="max-width:200px; white-space:normal; font-size:0.85em;">Coverage: ${ext.coverage || '-'}</td>`;
            html += `</tr>`;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
    } catch (e) {
        container.innerHTML = `<p style="text-align:center; padding:20px; color:#ef4444;">Gagal memuat data: ${e.message}</p>`;
    }
};

window.closeExtractionModal = function() {
    document.getElementById('extraction-modal').style.display = 'none';
};
