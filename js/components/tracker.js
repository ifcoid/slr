// js/components/tracker.js
import { API, getBaseURL } from '../api.js';
import { showToast, toggleHidden } from '../ui.js';
import { renderApprovalContent } from './renderer.js';

let pollingInterval = null;
let currentSessionId = null;
let ws = null;
let lastRenderedStatus = null;

export function startTracking(sessionId) {
    currentSessionId = sessionId;
    document.getElementById('display-session-id').textContent = sessionId;
    
    // Clear terminal
    document.getElementById('terminal-logs').innerHTML = '';
    
    // Connect WebSocket
    connectWebSocket(sessionId);
    
    // Initial fetch and wake up backend worker
    fetchSessionStatus();
    API.resumeSession(sessionId).catch(e => console.log('Resume attempt info:', e));
    
    // Start polling every 3 seconds for UI status
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(fetchSessionStatus, 3000);
    
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', fetchSessionStatus);
    }

    const btnExitSession = document.getElementById('btn-exit-session');
    if (btnExitSession) {
        // Hapus event listener lama jika ada (mencegah multiple trigger)
        const newBtn = btnExitSession.cloneNode(true);
        btnExitSession.parentNode.replaceChild(newBtn, btnExitSession);
        
        newBtn.addEventListener('click', () => {
            if (confirm("Anda yakin ingin keluar dari pemantauan sesi ini? (Proses agen di background mungkin masih berjalan)")) {
                localStorage.removeItem('activeSessionId');
                stopTracking();
                toggleHidden('section-tracker', false);
                toggleHidden('section-new-session', true);
            }
        });
    }
}

function setWSStatus(status, text) {
    const indicator = document.getElementById('ws-status-indicator');
    const led = document.getElementById('ws-led');
    const textSpan = document.getElementById('ws-text');
    if (!indicator || !led || !textSpan) return;
    
    indicator.classList.remove('hidden');
    led.className = 'led'; // reset
    if (status === 'connected') {
        led.classList.add('led-green');
        textSpan.textContent = text || 'Live Log Connected';
    } else if (status === 'disconnected') {
        led.classList.add('led-red');
        textSpan.textContent = text || 'Live Log Disconnected';
    } else if (status === 'connecting') {
        led.classList.add('led-yellow');
        textSpan.textContent = text || 'Connecting...';
    }
}

function connectWebSocket(id) {
    if (ws) ws.close();
    setWSStatus('connecting');
    
    // Convert http://... to ws://...
    const httpBase = getBaseURL();
    let wsBase = httpBase.replace(/^http/, 'ws');
    
    ws = new WebSocket(`${wsBase}/ws/logs/${id}`);
    
    ws.onopen = () => {
        setWSStatus('connected');
    };
    
    ws.onmessage = (event) => {
        const terminal = document.getElementById('terminal-logs');
        const p = document.createElement('p');
        p.textContent = event.data;
        terminal.appendChild(p);
        // Auto scroll
        terminal.scrollTop = terminal.scrollHeight;
    };
    
    ws.onerror = (err) => {
        console.error("WebSocket Error:", err);
        setWSStatus('disconnected', 'Connection Error');
    };
    
    ws.onclose = () => {
        console.log("WebSocket connection closed. Attempting to reconnect in 2 seconds...");
        setWSStatus('disconnected', 'Reconnecting...');
        setTimeout(() => {
            // Only reconnect if we are still tracking this session
            if (currentSessionId === id && document.getElementById('section-tracker') && !document.getElementById('section-tracker').classList.contains('hidden')) {
                connectWebSocket(id);
            }
        }, 2000);
    };
}

export function stopTracking() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    if (ws) {
        ws.close();
        ws = null;
    }
    const indicator = document.getElementById('ws-status-indicator');
    if (indicator) indicator.classList.add('hidden');
}

async function fetchSessionStatus() {
    if (!currentSessionId) return;
    
    const displayStatus = document.getElementById('display-status');
    const spinner = document.getElementById('status-spinner');
    
    try {
        const session = await API.getSession(currentSessionId);
        displayStatus.textContent = session.status || 'UNKNOWN';
        
        // Prevent re-rendering UI if status hasn't changed, 
        // to avoid wiping out user's input in textareas
        if (session.status === lastRenderedStatus) {
            return;
        }
        lastRenderedStatus = session.status;

        // Logic for animation and interaction based on status
        if (session.status && (session.status.includes('WAITING') || session.status.includes('DONE'))) {
            toggleHidden('status-spinner', false); // Hide spinner
            renderApprovalUI(session);
        } else if (session.status === 'COMPLETED') {
            toggleHidden('status-spinner', false);
            displayStatus.textContent = "COMPLETED ✅ (Selesai)";
            document.getElementById('interactive-area').innerHTML = `<p>Semua modul SLR telah berhasil diselesaikan!</p>`;
            toggleHidden('interactive-area', true);
            stopTracking();
        } else if (session.status.includes('NEEDS_REVISION') && !session.status.includes('ERROR')) {
            toggleHidden('status-spinner', false);
            document.getElementById('interactive-area').innerHTML = `<p>Sedang merevisi berdasar feedback...</p>`;
            toggleHidden('interactive-area', true);
        } else if (session.status.includes('ERROR') || session.status.includes('FAILED')) {
            toggleHidden('status-spinner', false);
            document.getElementById('interactive-area').innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
                    <h4 style="color: #ef4444; margin-top: 0;">Sistem Mengalami Kendala <span style="font-size: 0.8em; color: #666;">[v1.0.1 - 09 Juni 2026]</span></h4>
                    <p style="margin-bottom: 1rem; font-size: 0.9rem;">${session.system_error || 'Silakan cek log terminal untuk detail error.'}</p>
                    <button id="btn-retry-error" class="btn btn-primary">🔄 Coba Lagi (Retry)</button>
                </div>

                <div style="margin-top: 20px; padding: 15px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px;">
                    <h5 style="margin-top: 0; color: #60a5fa; margin-bottom: 10px;">💡 Alternatif: Selesaikan via MCP (AI Agent Eksternal)</h5>
                    <p style="font-size: 0.85em; margin-bottom: 10px; color: #cbd5e1;">AI Agent eksternal membutuhkan konfigurasi server terlebih dahulu sebelum bisa merespons *prompt*. Silakan lakukan langkah berikut:</p>
                    <strong style="font-size: 0.85em; color: #cbd5e1;">1. Buka Pengaturan "Add MCP Server" di AI Anda, lalu Paste JSON ini:</strong>
                    <div style="background: #0f172a; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 0.8em; color: #a7f3d0; white-space: pre-wrap; margin-bottom: 10px;">{
  "mcpServers": {
    "nsa-supervisor": {
      "url": "https://apk.fly.dev/api/mcp/sse"
    }
  }
}</div>
                    <strong style="font-size: 0.85em; color: #cbd5e1;">2. Setelah di-Save, gunakan Prompt berikut di chat:</strong>
                    <div style="background: #0f172a; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 0.8em; color: #fde047; white-space: pre-wrap;">"Tolong cek daftar MCP tools yang kamu miliki sekarang, seharusnya ada tool berawalan 'mcp_nsa_supervisor'. Jika ada, gunakan tool tersebut. Panggil 'get_screener_briefing' dengan session_id '${session.id || currentSessionId}', lalu panggil 'get_pending_disagreements' dengan session_id yang sama. Berikan tabel perbandingannya, dan tunggu persetujuan saya sebelum memanggil 'submit_supervisor_resolution'."</div>
                    <div style="margin-top: 10px; font-size: 0.85em; color: #f87171;"><strong>Penting:</strong> Setelah AI berhasil melakukan submit, klik tombol <strong>"🔄 Coba Lagi (Retry)"</strong> di atas agar sistem memuat ulang status terbaru.</div>
                </div>
            `;
            toggleHidden('interactive-area', true);

            setTimeout(() => {
                const btnRetry = document.getElementById('btn-retry-error');
                if (btnRetry) {
                    btnRetry.addEventListener('click', () => {
                        API.approveStep(currentSessionId, { is_retry: true });
                        showToast('Mencoba ulang...');
                        fetchSessionStatus();
                    });
                }
            }, 0);
        } else {
            // Agen sedang bekerja
            toggleHidden('status-spinner', true); // Show spinner
            const area = document.getElementById('interactive-area');
            area.innerHTML = `
                <div style="margin-top: 15px; padding: 15px; background: rgba(239, 68, 68, 0.1); border: 1px dashed rgba(239, 68, 68, 0.5); border-radius: 8px;">
                    <h5 style="color: #ef4444; margin-top: 0; margin-bottom: 10px;">⚠️ Interupsi Paksa (Force Stop & Revise)</h5>
                    <p style="font-size: 0.85em; color: #fca5a5; margin-bottom: 10px;">
                        <strong>Peringatan:</strong> Mengirim instruksi ini akan <strong>mematikan proses agen yang sedang berjalan secara paksa</strong> dan mengulanginya dari awal langkah ini. Jangan iseng menekan tombol ini jika Anda hanya ingin melanjutkan ke langkah berikutnya.
                    </p>
                    <form id="form-force-revise" style="margin-top: 0.5rem;">
                        <textarea id="input-force-feedback" rows="2" placeholder="Tulis instruksi revisi paksa di sini..." required style="width: 100%; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; padding: 8px; background: rgba(0,0,0,0.2); color: white; resize: vertical; font-family: inherit; margin-bottom: 8px;"></textarea>
                        <button type="submit" class="btn btn-danger" style="width: 100%; font-weight: bold; padding: 10px;">🛑 MATIKAN PROSES & ULANGI DENGAN REVISI INI</button>
                    </form>
                </div>
            `;
            
            setTimeout(() => {
                const formForceRevise = document.getElementById('form-force-revise');
                if (formForceRevise) {
                    formForceRevise.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        if (!confirm("⚠️ PERINGATAN KERAS ⚠️\n\nAnda yakin ingin MEMATIKAN paksa proses AI yang sedang berjalan ini?\n\nSemua progres pada langkah ini akan terhenti dan diulang dari awal dengan instruksi baru Anda.")) {
                            return;
                        }
                        const feedback = document.getElementById('input-force-feedback').value;
                        const btn = e.target.querySelector('button');
                        const originalText = btn.textContent;
                        btn.textContent = "Mengeksekusi Force Stop...";
                        btn.disabled = true;
                        
                        try {
                            await API.reviseStep(currentSessionId, feedback);
                            showToast('Proses berhasil dihentikan! Agen akan mengulang.', 'success');
                            fetchSessionStatus(); // re-poll immediately
                        } catch (error) {
                            showToast(error.message, 'error');
                            btn.textContent = originalText;
                            btn.disabled = false;
                        }
                    });
                }
            }, 0);
            toggleHidden('interactive-area', true); // Show the interactive area
        }
    } catch (error) {
        console.error('Failed to poll status:', error);
    }
}

function renderApprovalUI(session) {
    const area = document.getElementById('interactive-area');
    area.innerHTML = '';
    
    const header = document.createElement('h3');
    if (session.status && session.status.includes('DONE')) {
        header.textContent = 'Tahap Selesai';
    } else {
        header.textContent = 'Menunggu Persetujuan Anda';
    }
    area.appendChild(header);

    // M2_STEP1: Topik Sugesti
    if (session.status === 'M2_STEP1_WAITING_APPROVAL' && session.suggested_topics) {
        // Tampilkan info prompt sebelumnya
        const infoBox = document.createElement('div');
        infoBox.style.cssText = "background: rgba(30, 41, 59, 0.5); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1);";
        infoBox.innerHTML = `
            <p style="margin-top:0; font-size: 0.9em; color: #94a3b8;"><i class="fas fa-history"></i> <strong>Prompt Terakhir yang Digunakan:</strong></p>
            <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; font-style: italic; font-size: 0.85em; color: #cbd5e1; margin-bottom: 10px;">
                ${session.feedback ? session.feedback : session.topic}
            </div>
            <p style="font-size: 0.8em; color: #64748b; margin-bottom: 0;">
                <i class="fas fa-robot"></i> Jika hasil berantakan (seperti judul/field kosong), artinya model LLM gagal mengikuti instruksi JSON karena prompt terlalu panjang/memaksa. 
                Anda bisa mengganti model LLM di menu <strong>⚙️ Settings</strong> di pojok kanan atas, lalu coba revisi kembali.
            </p>
        `;
        area.appendChild(infoBox);

        const grid = document.createElement('div');
        grid.className = 'options-grid';
        
        session.suggested_topics.forEach((topic, idx) => {
            const card = document.createElement('div');
            card.className = 'option-card';
            card.innerHTML = `
                <div class="option-header">
                    <span class="badge">Opsi ${idx + 1}</span>
                    <span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd;">${topic.type || 'TIPE A'}</span>
                </div>
                <div class="option-body">
                    <p><strong>Judul:</strong> ${topic.name || '<span style="color:#ef4444;font-style:italic;">[Gagal diekstrak dari LLM]</span>'}</p>
                    <p><strong>Gap:</strong> ${topic.gap || '<span style="color:#ef4444;font-style:italic;">[Gagal diekstrak dari LLM]</span>'}</p>
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #3b82f6; margin: 10px 0;">
                        <p style="margin: 0; font-size: 0.9em;"><strong>Alasan Klasifikasi (${topic.type || 'TIPE A'}):</strong> ${topic.type_reason || ''}</p>
                    </div>
                    <p><strong>Bukti/Konteks (Evidence):</strong> ${topic.evidence || ''}</p>
                    <p><strong>Pentingnya:</strong> ${topic.importance || ''}</p>
                    ${topic.references && topic.references.length > 0 ? `
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.2);">
                        <p style="margin-bottom: 5px; font-size: 0.85em; color: var(--text-muted);"><strong><i class="fa fa-book"></i> Referensi Grounding:</strong></p>
                        <ul style="font-size: 0.8em; color: var(--text-muted); padding-left: 20px; margin-bottom: 0;">
                            ${topic.references.map(ref => `<li>${ref}</li>`).join('')}
                        </ul>
                    </div>` : ''}
                </div>
                <div style="margin-top: 1rem;">
                    <button class="btn btn-success btn-approve-topic" data-index="${idx}">Pilih Topik Ini</button>
                </div>
            `;
            grid.appendChild(card);
        });
        
        area.appendChild(grid);
        
        // Attach events
        grid.querySelectorAll('.btn-approve-topic').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idx = e.target.dataset.index;
                const selectedTopic = session.suggested_topics[idx];
                await handleApproval({ selected_topic: selectedTopic });
            });
        });
    } else {
        const handled = renderApprovalContent(area, session, handleApproval);
        if (!handled) {
            // Generic approval for other steps
            area.insertAdjacentHTML('beforeend', `
                <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <p style="margin-bottom: 1rem;">Silakan periksa hasil pekerjaan agen di MongoDB Compass. Apakah Anda setuju?</p>
                    <div style="display: flex; gap: 1rem;">
                        <button id="btn-generic-approve" class="btn btn-success">Setuju & Lanjut</button>
                    </div>
                </div>
            `);
            // Generic approve
            setTimeout(() => {
                const btnApprove = document.getElementById('btn-generic-approve');
                if (btnApprove) {
                    btnApprove.addEventListener('click', () => handleApproval({}));
                }
            }, 0);
        }
    }
    
    // Only add Revise form if this is an approval step (not a data-input step)
    if (session.status.includes('APPROVAL')) {
        area.insertAdjacentHTML('beforeend', `
            <hr>
            <h4>Atau Berikan Revisi (Feedback)</h4>
            <form id="form-revise" style="margin-top: 1rem;">
                <textarea id="input-feedback" rows="2" placeholder="Tulis instruksi revisi di sini..." required></textarea>
                <button type="submit" class="btn btn-danger" style="margin-top: 0.5rem;">Kirim Revisi</button>
            </form>
        `);
    }
    
    setTimeout(() => {
        const formRevise = document.getElementById('form-revise');
        if (formRevise) {
            formRevise.addEventListener('submit', async (e) => {
                e.preventDefault();
                const feedback = document.getElementById('input-feedback').value;
                const btn = e.target.querySelector('button');
                const originalText = btn.textContent;
                btn.textContent = "Mengirim...";
                btn.disabled = true;
                
                try {
                    await API.reviseStep(currentSessionId, feedback);
                    showToast('Instruksi revisi dikirim. Agen mulai mengulang.');
                    fetchSessionStatus(); // re-poll immediately
                } catch (error) {
                    showToast(error.message, 'error');
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            });
        }
    }, 0);
    
    toggleHidden('interactive-area', true);
}

async function handleApproval(payload) {
    try {
        await API.approveStep(currentSessionId, payload);
        showToast('Berhasil disetujui! Agen melanjutkan pekerjaannya.');
        fetchSessionStatus(); // re-poll immediately
    } catch (error) {
        showToast(error.message, 'error');
    }
}
