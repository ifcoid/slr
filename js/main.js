// js/main.js
import { initSetup } from './components/setup.js';
import { initAuth } from './components/auth.js';
import { initSession } from './components/session.js';
import { startTracking } from './components/tracker.js';
import { toggleHidden, openModal } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // 0. Init Auth
    initAuth();

    // 1. Initialize API Base URL and LLM Config Setup logic
    initSetup();

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
