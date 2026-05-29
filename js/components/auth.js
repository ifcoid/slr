// js/components/auth.js
import { API } from '../api.js';
import { showToast, setButtonLoading, toggleHidden } from '../ui.js';

export function initAuth() {
    const authForm = document.getElementById('form-auth');
    const authTitle = document.getElementById('auth-title');
    const toggleLink = document.getElementById('link-toggle-auth');
    const btnSubmit = document.getElementById('btn-submit-auth');
    const usernameInput = document.getElementById('input-username');
    const passwordInput = document.getElementById('input-password');
    const inviteCodeGroup = document.getElementById('group-invite-code');
    const inviteCodeInput = document.getElementById('input-invite-code');

    if (!authForm) return;

    let isLoginMode = true;

    // Check existing auth
    const token = localStorage.getItem('auth_token');
    if (token) {
        // User has token, hide auth section
        toggleHidden('section-login', false);
        return;
    } else {
        // No token, show auth and hide new session
        toggleHidden('section-login', true);
        toggleHidden('section-new-session', false);
    }

    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        
        if (isLoginMode) {
            authTitle.textContent = "Masuk ke Sistem";
            btnSubmit.textContent = "Login";
            toggleLink.textContent = "Belum punya akun? Daftar di sini";
            toggleHidden('group-invite-code', false);
        } else {
            authTitle.textContent = "Registrasi Admin Baru";
            btnSubmit.textContent = "Daftar";
            toggleLink.textContent = "Sudah punya akun? Login di sini";
            toggleHidden('group-invite-code', true);
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const inviteCode = inviteCodeInput ? inviteCodeInput.value.trim() : '';

        if (!username || !password) {
            showToast('Username dan password harus diisi', 'error');
            return;
        }

        setButtonLoading(btnSubmit, true);

        try {
            if (isLoginMode) {
                const res = await API.login(username, password);
                localStorage.setItem('auth_token', res.auth_token);
                localStorage.setItem('user_data', JSON.stringify(res.user_data));
                showToast(res.message, 'success');
                
                // Hide auth, show main
                toggleHidden('section-login', false);
                toggleHidden('section-new-session', true);
                window.location.reload(); // Reload to start app cleanly
            } else {
                const res = await API.register(username, password, inviteCode);
                showToast(res.message + ". Silakan login.", 'success');
                // Switch to login
                isLoginMode = true;
                authTitle.textContent = "Masuk ke Sistem";
                btnSubmit.textContent = "Login";
                toggleLink.textContent = "Belum punya akun? Daftar di sini";
                toggleHidden('group-invite-code', false);
                passwordInput.value = '';
                if (inviteCodeInput) inviteCodeInput.value = '';
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setButtonLoading(btnSubmit, false, isLoginMode ? "Login" : "Daftar");
        }
    });

    // Handle logout
    const btnLogout = document.getElementById('btn-logout');
    if (token && btnLogout) {
        toggleHidden('btn-logout', true); // ensure it's visible
        btnLogout.addEventListener('click', () => {
            if (confirm('Yakin ingin keluar dari akun?')) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                window.location.reload();
            }
        });
    }
}
