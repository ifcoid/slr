// js/main.js
import { initSetup } from './components/setup.js';
import { initSession } from './components/session.js';
import { startTracking } from './components/tracker.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize API Base URL and LLM Config Setup logic
    initSetup();

    // 2. Initialize Session Creation logic
    initSession((sessionId) => {
        // Callback when a new session is successfully created
        startTracking(sessionId);
    });

    console.log('Agentic SLR Orchestrator - Frontend Initialized');
});
