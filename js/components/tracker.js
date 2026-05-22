// js/components/tracker.js
import { API, getBaseURL } from '../api.js';
import { showToast, toggleHidden } from '../ui.js';

let pollingInterval = null;
let currentSessionId = null;
let ws = null;

export function startTracking(sessionId) {
    currentSessionId = sessionId;
    document.getElementById('display-session-id').textContent = sessionId;
    
    // Clear terminal
    document.getElementById('terminal-logs').innerHTML = '';
    
    // Connect WebSocket
    connectWebSocket(sessionId);
    
    // Initial fetch
    fetchSessionStatus();
    
    // Start polling every 3 seconds for UI status
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(fetchSessionStatus, 3000);
    
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', fetchSessionStatus);
    }
}

function connectWebSocket(id) {
    if (ws) ws.close();
    
    // Convert http://... to ws://...
    const httpBase = getBaseURL();
    let wsBase = httpBase.replace(/^http/, 'ws');
    
    ws = new WebSocket(`${wsBase}/ws/logs/${id}`);
    
    ws.onmessage = (event) => {
        const terminal = document.getElementById('terminal-logs');
        const p = document.createElement('p');
        p.textContent = event.data;
        terminal.appendChild(p);
        // Auto scroll
        terminal.scrollTop = terminal.scrollHeight;
    };
    
    ws.onerror = (err) => console.error("WebSocket Error:", err);
    ws.onclose = () => console.log("WebSocket connection closed.");
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
}

async function fetchSessionStatus() {
    if (!currentSessionId) return;
    
    const displayStatus = document.getElementById('display-status');
    const spinner = document.getElementById('status-spinner');
    
    try {
        const session = await API.getSession(currentSessionId);
        displayStatus.textContent = session.status || 'UNKNOWN';
        
        // Logic for animation and interaction based on status
        if (session.status && session.status.includes('WAITING_APPROVAL')) {
            toggleHidden('status-spinner', false); // Hide spinner
            renderApprovalUI(session);
        } else if (session.status === 'COMPLETED') {
            toggleHidden('status-spinner', false);
            displayStatus.textContent = "COMPLETED ✅ (Selesai)";
            document.getElementById('interactive-area').innerHTML = `<p>Semua modul SLR telah berhasil diselesaikan!</p>`;
            toggleHidden('interactive-area', true);
            stopTracking();
        } else if (session.status.includes('NEEDS_REVISION')) {
            toggleHidden('status-spinner', false);
            document.getElementById('interactive-area').innerHTML = `<p>Sedang merevisi berdasar feedback...</p>`;
            toggleHidden('interactive-area', true);
        } else {
            // Agen sedang bekerja
            toggleHidden('status-spinner', true); // Show spinner
            document.getElementById('interactive-area').innerHTML = '';
            toggleHidden('interactive-area', false);
        }
    } catch (error) {
        console.error('Failed to poll status:', error);
    }
}

function renderApprovalUI(session) {
    const area = document.getElementById('interactive-area');
    area.innerHTML = '';
    
    const header = document.createElement('h3');
    header.textContent = 'Menunggu Persetujuan Anda';
    area.appendChild(header);

    // M2_STEP1: Topik Sugesti
    if (session.status === 'M2_STEP1_WAITING_APPROVAL' && session.suggested_topics) {
        const grid = document.createElement('div');
        grid.className = 'options-grid';
        
        session.suggested_topics.forEach((topic, idx) => {
            const card = document.createElement('div');
            card.className = 'option-card';
            card.innerHTML = `
                <div class="option-header">
                    <span class="badge">Opsi ${idx + 1}</span>
                    <span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd;">${topic.type}</span>
                </div>
                <div class="option-body">
                    <p><strong>Judul:</strong> ${topic.name}</p>
                    <p><strong>Gap:</strong> ${topic.gap}</p>
                    <p><strong>Pentingnya:</strong> ${topic.importance}</p>
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
        // Generic approval for other steps
        area.innerHTML += `
            <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                <p style="margin-bottom: 1rem;">Silakan periksa hasil pekerjaan agen di MongoDB Compass. Apakah Anda setuju?</p>
                <div style="display: flex; gap: 1rem;">
                    <button id="btn-generic-approve" class="btn btn-success">Setuju & Lanjut</button>
                </div>
            </div>
        `;
        // Generic approve
        setTimeout(() => {
            const btnApprove = document.getElementById('btn-generic-approve');
            if (btnApprove) {
                btnApprove.addEventListener('click', () => handleApproval({}));
            }
        }, 0);
    }
    
    // Always add Revise form at the bottom
    area.innerHTML += `
        <hr>
        <h4>Atau Berikan Revisi (Feedback)</h4>
        <form id="form-revise" style="margin-top: 1rem;">
            <textarea id="input-feedback" rows="2" placeholder="Tulis instruksi revisi di sini..." required></textarea>
            <button type="submit" class="btn btn-danger" style="margin-top: 0.5rem;">Kirim Revisi</button>
        </form>
    `;
    
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
