// js/ui.js

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function toggleHidden(elementId, forceState) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (forceState !== undefined) {
        if (forceState) el.classList.remove('hidden');
        else el.classList.add('hidden');
    } else {
        el.classList.toggle('hidden');
    }
}

export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.remove('hiding');
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('hiding');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('hiding');
    }, 300);
}

export function setButtonLoading(btn, isLoading, originalText = '') {
    if (isLoading) {
        btn.dataset.originalText = btn.textContent;
        btn.innerHTML = `<span class="spinner" style="width:16px; height:16px; border-width:2px; display:inline-block; margin-right:8px; vertical-align:middle;"></span> Memproses...`;
        btn.disabled = true;
    } else {
        btn.textContent = originalText || btn.dataset.originalText || 'Submit';
        btn.disabled = false;
    }
}
