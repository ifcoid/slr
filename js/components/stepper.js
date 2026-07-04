// js/components/stepper.js
// Breadcrumb/stepper M1–M9 — ORIENTASI (posisi + progres) + peek read-only modul selesai.
//
// PENTING (validitas): ini MURNI turunan dari session.status (prefix M<n>_STEP<m>) dan TIDAK
// mengubah state/backend. Maju/mundur TETAP lewat gerbang HITL (Approve/Revisi) pada langkah
// aktif — stepper BUKAN navigator lompat-bebas. Lompat-mundur bebas = risiko reset = merusak
// protokol a-priori/PRISMA (lih. CLAUDE.md "protokol STABIL, preserve ≠ reset"). Klik hanya
// diizinkan untuk MELIHAT (read-only) modul yang sudah selesai.
//
// Token status MENTAH sengaja TIDAK disentuh di #display-status (dibaca llmdebug.js untuk
// laporan bug). Stepper hanya MENAMBAH lapisan manusiawi di atasnya.

export const MODULES = [
    { n: 1, title: 'Fondasi Teori & Aturan Global', short: 'Fondasi' },
    { n: 2, title: 'Topik & PICO', short: 'Topik & PICO' },
    { n: 3, title: 'Strategi Pencarian (Kueri)', short: 'Kueri' },
    { n: 4, title: 'Impor & Deduplikasi', short: 'Impor' },
    { n: 5, title: 'Skrining Judul/Abstrak', short: 'Skrining' },
    { n: 6, title: 'Skrining Teks Lengkap', short: 'Teks Lengkap' },
    { n: 7, title: 'Ekstraksi Data & QA', short: 'Ekstraksi & QA' },
    { n: 8, title: 'Sintesis & GRADE', short: 'Sintesis' },
    { n: 9, title: 'Manuskrip', short: 'Manuskrip' },
];

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// currentModuleNum: nomor modul dari prefix status. COMPLETED => 10 (semua selesai).
export function currentModuleNum(status) {
    if (!status) return 1;
    if (status === 'COMPLETED') return 10;
    const m = String(status).match(/^M(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
}

function currentStepNum(status) {
    const m = String(status || '').match(/_STEP(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

// Frasa fase manusiawi dari sufiks token (dicek berurutan; yang cocok pertama menang).
const PHASES = [
    [/WAITING_APPROVAL/, 'menunggu persetujuan Anda'],
    [/NEEDS_REVISION/, 'perlu revisi'],
    [/LOW_KAPPA/, 'kappa rendah — perlu keputusan Anda'],
    [/CALIBRATION/, 'kalibrasi QA berjalan'],
    [/VERIFY_BLOCKED|BLOCKED/, 'terhalang — perlu perbaikan'],
    [/REEXTRACT_FAILED|FAILED|ERROR/, 'bermasalah — cek Live Log'],
    [/WAITING_SYNC/, 'menunggu sinkronisasi Qdrant'],
    [/WAITING_EMBED/, 'menunggu embedding teks lengkap'],
    [/WAITING_IMPORT/, 'menunggu impor data'],
    [/WAITING_RESOLUTION/, 'menunggu resolusi konflik'],
    [/WAITING_INPUT/, 'menunggu input Anda'],
    [/WAITING_EXECUTION/, 'sedang dijalankan'],
    [/BATCH_SCREENING|FULLTEXT_SCREENING|SCREENING/, 'sedang menyaring paper'],
    [/REVIEW_HASIL/, 'meninjau hasil'],
    [/DESCRIPTIVE/, 'analisis deskriptif'],
    [/REVERIFY|VERIFY/, 'verifikasi berjalan'],
    [/FORCE_PROCEED/, 'lanjut dengan peringatan'],
    [/EVALUAT/, 'evaluasi berjalan'],
];

// humanizeStatus: { line, sub, raw } untuk baris orientasi manusiawi.
export function humanizeStatus(status) {
    if (!status) return { line: 'Menunggu…', sub: '', raw: '' };
    if (status === 'COMPLETED') return { line: 'Semua modul selesai', sub: 'SLR selesai — siap ekspor/manuskrip', raw: status };
    // Modul 10 = gerbang audit pra-submisi (setelah 9 modul). Stepper menampilkan 9 modul
    // (semua ✓), baris ini menandai fase audit.
    if (status.startsWith('M10')) {
        let phase = 'menjalankan audit';
        for (const [re, ph] of PHASES) { if (re.test(status)) { phase = ph; break; } }
        return { line: 'Audit Pra-Submisi — Defensibility Gate (Modul 10)', sub: phase, raw: String(status) };
    }
    const n = currentModuleNum(status);
    const mod = MODULES.find(m => m.n === n);
    const step = currentStepNum(status);
    let phase = 'sedang diproses';
    for (const [re, ph] of PHASES) { if (re.test(status)) { phase = ph; break; } }
    const line = mod ? `Modul ${n} · ${mod.title}` : String(status);
    const sub = (step ? `Langkah ${step} — ` : '') + phase;
    return { line, sub, raw: String(status) };
}

// renderStepper: gambar stepper + baris orientasi ke container. onPeek(n, session) dipanggil
// saat modul SELESAI diklik. Dipanggil tiap kali status berubah (dari tracker.js).
export function renderStepper(containerId, session, onPeek) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const status = session && session.status;
    const cur = currentModuleNum(status);

    const nodes = MODULES.map(m => {
        let state = 'upcoming';
        if (cur >= 10 || m.n < cur) state = 'done';
        else if (m.n === cur) state = 'current';
        const clickable = state === 'done';
        const mark = state === 'done' ? '✓' : (state === 'current' ? '●' : '○');
        const tip = m.title + (clickable ? ' — klik untuk lihat (read-only)' : (state === 'current' ? ' (posisi sekarang)' : ' (belum)'));
        return `<button type="button" class="step-node step-${state}" data-mod="${m.n}" ${clickable ? '' : 'disabled'} title="${esc(tip)}" aria-label="${esc(tip)}">
            <span class="step-dot">${mark}</span>
            <span class="step-num">${m.n}</span>
            <span class="step-label">${esc(m.short)}</span>
        </button>`;
    }).join('<span class="step-conn" aria-hidden="true"></span>');

    const h = humanizeStatus(status);
    el.innerHTML = `
        <div class="stepper-row" role="list">${nodes}</div>
        <div class="stepper-current">
            <span class="stepper-line">${esc(h.line)}</span>
            ${h.sub ? `<span class="stepper-sub">${esc(h.sub)}</span>` : ''}
            <span class="stepper-count">Modul ${Math.min(cur, 9)} dari 9</span>
        </div>`;

    el.querySelectorAll('.step-node[data-mod]:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            if (typeof onPeek === 'function') onPeek(parseInt(btn.dataset.mod, 10), session);
        });
    });
}

// --- Peek read-only ---------------------------------------------------------

function asText(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') return v.markdown || v.summary || v.text || v.content || '';
    return String(v);
}

function picoText(session) {
    const p = session && session.pico_definitions;
    if (!p) return '';
    const row = (lbl, x) => (x && x.value ? `**${lbl}:** ${x.value}\n` : '');
    const s = row('Population/Problem (P)', p.p) + row('Intervention (I)', p.i) + row('Comparison (C)', p.c) + row('Outcome (O)', p.o);
    return s.trim();
}

function pickSummary(session, n) {
    if (n === 1) return asText(session.foundation);
    if (n === 2) return asText(session.modul2_summary) || picoText(session);
    if (n >= 3 && n <= 8) return asText(session['modul' + n + '_summary']);
    if (n === 9) return asText(session.manuscript) || asText(session.modul9_summary);
    return '';
}

// mdLite: format ringan & AMAN (input SUDAH di-escape). Hanya heading ##, **bold**, dan newline.
function mdLite(escaped) {
    return escaped
        .replace(/^\s*##\s?(.*)$/gm, '<strong>$1</strong>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

// showModulePeek: modal hanya-baca ringkasan modul selesai. Self-contained (buat & hapus DOM).
export function showModulePeek(n, session) {
    const mod = MODULES.find(m => m.n === n);
    if (!mod) return;
    const raw = pickSummary(session, n);
    const body = raw
        ? `<div class="peek-md">${mdLite(esc(raw))}</div>`
        : `<p class="peek-empty">Ringkasan modul ini belum tersimpan di sesi. Detailnya bisa dilihat di Live Log, atau saat langkah tersebut aktif kembali lewat gerbang HITL.</p>`;

    const overlay = document.createElement('div');
    overlay.className = 'peek-overlay';
    overlay.innerHTML = `
        <div class="peek-modal" role="dialog" aria-modal="true">
            <div class="peek-header">
                <span>Modul ${n} — ${esc(mod.title)} <span class="peek-ro">read-only</span></span>
                <button type="button" class="peek-close" aria-label="Tutup"><span class="ico ico-close"></span></button>
            </div>
            <div class="peek-body">${body}</div>
            <div class="peek-foot">Tampilan hanya-baca. Untuk mengubah keputusan, gunakan gerbang HITL (Approve/Revisi) pada langkah aktif — bukan dari sini (menjaga protokol a-priori).</div>
        </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.peek-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });
}
