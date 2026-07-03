// Reproducible Error (xAI): modal Debug & Uji Coba prompt LLM.
// Lihat prompt PERSIS + error panggilan LLM yang gagal, edit bila perlu, lalu "Uji Coba"
// untuk melihat respons/error MENTAH dari provider — pinpoint "error sebelah mana" dan
// jadikan laporan ke developer langsung actionable. Dipanggil via window.openLLMDebug(sessionId?).
import { API, getBaseURL } from '../api.js';
import { openModal, closeModal, showToast } from '../ui.js';

const MODAL_ID = 'modal-llm-debug';

// Konteks laporan: ditangkap OTOMATIS dari jejak error + hasil replay, agar user tak perlu
// menambah keterangan saat Report Bug.
const ctxState = { sessionId: '', step: '', error: '', replay: '' };

const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const val = (id) => (document.getElementById(id) || {}).value || '';
const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };

function ensureModal() {
    if (document.getElementById(MODAL_ID)) return;
    const el = document.createElement('div');
    el.id = MODAL_ID;
    el.className = 'modal-overlay hidden';
    el.innerHTML = `
    <div class="glass-panel modal-content" style="max-width:920px;">
        <div class="modal-header">
            <h2><span class="ico ico-bug"></span> Lapor / Debug Bug</h2>
            <button class="btn-close" id="llm-debug-close">&times;</button>
        </div>
        <p style="font-size:0.85em;color:#9ca3af;margin:0 0 12px;">Lapor masalah APA PUN — tampilan/UX (mis. "tombol toast tak muncul") atau error LLM. Cukup tulis keterangan; <strong>state (modul/step, sesi, browser) ditambahkan OTOMATIS</strong>. Untuk error LLM, detail prompt & error terisi sendiri dan bisa di-Uji Coba.</p>
        <div id="llm-debug-meta"></div>
        <div class="form-group"><label><span class="ico ico-file"></span> Keterangan masalah <span style="color:#9ca3af;font-size:0.8em;">(jelaskan singkat apa yang salah)</span></label><textarea id="llm-debug-note" rows="3" style="width:100%;" placeholder='mis. "Klik Sync, toast tidak muncul dan tombol diam"'></textarea></div>
        <div id="llm-debug-state" style="font-size:0.78em;color:#9ca3af;margin-bottom:10px;"></div>
        <details id="llm-debug-tech" style="margin-bottom:10px;">
            <summary style="cursor:pointer;color:#5eead4;font-size:0.85em;"><span class="ico ico-settings"></span> Detail teknis LLM (prompt &amp; error) — terisi otomatis bila lapor dari error LLM; bisa Uji Coba</summary>
            <div style="margin-top:10px;">
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <div class="form-group" style="flex:1;min-width:160px;"><label>Provider</label><input id="llm-debug-provider" type="text" placeholder="mis. groq / gemini / mistral"></div>
                    <div class="form-group" style="flex:1;min-width:160px;"><label>Model (opsional; kosong = default tersimpan)</label><input id="llm-debug-model" type="text" placeholder="(default tersimpan)"></div>
                </div>
                <div class="form-group"><label>System Prompt <span id="llm-debug-sys-chars" style="color:#9ca3af;font-size:0.8em;"></span></label><textarea id="llm-debug-system" rows="5" style="width:100%;font-family:monospace;font-size:0.82em;"></textarea></div>
                <div class="form-group"><label>User Prompt <span id="llm-debug-user-chars" style="color:#9ca3af;font-size:0.8em;"></span></label><textarea id="llm-debug-user" rows="10" style="width:100%;font-family:monospace;font-size:0.82em;"></textarea></div>
                <button id="llm-debug-run" class="btn btn-primary"><span class="ico ico-flask"></span> Uji Coba (replay ke provider)</button>
            </div>
        </details>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button id="llm-debug-report" class="btn" style="background:rgba(245,158,11,0.18);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);" title="Unduh file laporan (state otomatis) lalu lampirkan ke @BugLaporBot"><span class="ico ico-file"></span> Report Bug ke Telegram</button>
            <span style="font-size:0.8em;color:#9ca3af;">Unduh file laporan → lampirkan ke @BugLaporBot (bot balas "diterima").</span>
        </div>
        <div id="llm-debug-result" style="margin-top:12px;"></div>
    </div>`;
    document.body.appendChild(el);
    document.getElementById('llm-debug-close').addEventListener('click', () => closeModal(MODAL_ID));
    document.getElementById('llm-debug-report').addEventListener('click', reportBug);
    const sys = document.getElementById('llm-debug-system');
    const usr = document.getElementById('llm-debug-user');
    const updChars = () => {
        const sc = sys.value.length, uc = usr.value.length;
        document.getElementById('llm-debug-sys-chars').textContent = `(${sc} char)`;
        document.getElementById('llm-debug-user-chars').textContent = `(${uc} char ≈ ${Math.round((sc + uc) / 4)} token)`;
    };
    sys.addEventListener('input', updChars);
    usr.addEventListener('input', updChars);
    document.getElementById('llm-debug-run').addEventListener('click', runReplay);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runReplay() {
    const btn = document.getElementById('llm-debug-run');
    const provider = val('llm-debug-provider').trim();
    const model = val('llm-debug-model').trim();
    const system_prompt = val('llm-debug-system');
    const user_prompt = val('llm-debug-user');
    const box = document.getElementById('llm-debug-result');
    if (!provider) { showToast('Isi provider dulu.', 'error'); return; }
    btn.disabled = true; const orig = btn.textContent; btn.textContent = '⏳ Menguji…';
    box.innerHTML = '<div style="color:#9ca3af;">⏳ Mengirim prompt ke provider… (async — aman untuk prompt panjang)</div>';
    try {
        const start = await API.replayLLM({ provider, model, system_prompt, user_prompt });
        if (!start || !start.job_id) { renderResult(start || {}); return; } // error build client (langsung)
        await pollReplay(start.job_id, box);
    } catch (e) {
        box.innerHTML = `<div style="color:#fca5a5;">Gagal memanggil replay: ${esc(e.message)}</div>`;
    } finally {
        btn.disabled = false; btn.textContent = orig;
    }
}

// pollReplay menanyai hasil job tiap 2 dtk sampai done. Prompt besar bisa lama; tak ada
// timeout proxy karena tiap GET balik cepat. Batas aman 10 menit.
async function pollReplay(jobId, box) {
    const startT = Date.now();
    const maxMs = 10 * 60 * 1000;
    while (Date.now() - startT < maxMs) {
        await sleep(2000);
        let res;
        try { res = await API.getReplayResult(jobId); }
        catch (e) { box.innerHTML = `<div style="color:#fca5a5;">Gagal polling hasil: ${esc(e.message)}</div>`; return; }
        if (res && res.done) { renderResult(res); return; }
        const secs = Math.round((Date.now() - startT) / 1000);
        box.innerHTML = `<div style="color:#9ca3af;">⏳ Menunggu balasan provider… ${secs}s (prompt besar memang lama; aman tanpa timeout proxy)</div>`;
    }
    box.innerHTML = '<div style="color:#fca5a5;">⏱️ Replay belum selesai dalam 10 menit — provider kemungkinan sangat lambat / hang. Coba potong prompt lalu uji lagi.</div>';
}

// currentStatus membaca status sesi yang sedang tampil (= modul/step, mis. M5_STEP3_...).
function currentStatus() {
    return (document.getElementById('display-status')?.textContent || '').trim();
}

// renderState menampilkan state otomatis (sesi/modul-step/viewport) di modal — agar user tahu
// info apa yang ikut terkirim untuk laporan bug TAMPILAN/UX (tanpa perlu mengetik manual).
function renderState() {
    const el = document.getElementById('llm-debug-state');
    if (!el) return;
    const sid = ctxState.sessionId || window.currentSessionId || '(tidak ada sesi aktif)';
    el.innerHTML = `<span class="ico ico-info"></span> Ikut terkirim otomatis: sesi <strong>${esc(sid)}</strong> · modul/step <strong>${esc(currentStatus() || '-')}</strong> · backend <strong>${esc(getBaseURL())}</strong> · layar ${window.innerWidth}×${window.innerHeight}`;
}

// buildReportText merangkai SELURUH info reproduksi bug — keterangan user + STATE OTOMATIS
// (modul/step, sesi, url, browser) + (bila ada) detail LLM. TANPA dipotong (dikirim sebagai
// FILE ke bot). Cocok utk bug tampilan/UX MAUPUN error LLM.
function buildReportText() {
    const sid = ctxState.sessionId || window.currentSessionId || '(manual)';
    const note = val('llm-debug-note').trim();
    const provider = val('llm-debug-provider').trim();
    const model = val('llm-debug-model').trim();
    const sys = val('llm-debug-system');
    const usr = val('llm-debug-user');
    const err = ctxState.error || '';
    const replay = ctxState.replay || '';
    const lines = [
        '🐞 BUG REPORT NSA/SLR',
        `waktu      : ${new Date().toISOString()}`,
        `session    : ${sid}`,
        `modul/step : ${currentStatus() || '-'}`,
        // api_base = BACKEND yang dipakai user → menentukan DB mana sesinya berada. WAJIB ada
        // agar developer bisa MENEMUKAN sesi (backend bisa lokal/beda per-user). Bukan rahasia.
        `api_base   : ${getBaseURL()}`,
        `url        : ${location.href}`,
        `viewport   : ${window.innerWidth}x${window.innerHeight}`,
        `userAgent  : ${navigator.userAgent}`,
        '',
        '📝 KETERANGAN USER:',
        note || '(tidak diisi)',
    ];
    // Error console JS (window.__errLog dari script di <head>) — kunci untuk bug TAMPILAN.
    const errs = (window.__errLog || []);
    if (errs.length) {
        lines.push('', `── ERROR CONSOLE (${errs.length} terakhir) ──`, ...errs.slice(-20));
    }
    // Bagian LLM hanya disertakan bila relevan (lapor dari error LLM / ada prompt).
    if (err || provider || sys || usr || replay) {
        lines.push('', '── DETAIL LLM ──',
            `step    : ${ctxState.step || '-'}`,
            `provider: ${provider || '-'} / model: ${model || '-'}`,
            '', '❌ ERROR:', err || '(tidak ada)');
        if (replay) lines.push('', '🔁 REPLAY:', replay);
        lines.push('', `— SYSTEM PROMPT (${sys.length} char):`, sys, '', `— USER PROMPT (${usr.length} char):`, usr);
    }
    return lines.join('\n');
}

// Report Bug: unduh laporan LENGKAP sebagai FILE .txt lalu buka @BugLaporBot — user tinggal
// LAMPIRKAN file itu & kirim. Bot auto-reply "diterima". Untuk bug tampilan, keterangan wajib.
async function reportBug() {
    if (!val('llm-debug-note').trim() && !ctxState.error) {
        showToast('Tulis keterangan masalahnya dulu.', 'error');
        document.getElementById('llm-debug-note')?.focus();
        return;
    }
    const btn = document.getElementById('llm-debug-report');
    btn.disabled = true; const orig = btn.textContent; btn.textContent = '⏳ Menyiapkan…';
    let report = buildReportText();

    // VERSI BUILD FRONTEND: fingerprint deploy (slr "deploy from branch", tanpa SHA build) —
    // Last-Modified/ETag situs + version.json bila ada. Agar developer tahu versi frontend mana
    // yang dipakai user saat reproduksi. Best-effort.
    let fe = '';
    try {
        const vr = await fetch('version.json?cb=' + Date.now(), { cache: 'no-store' });
        if (vr.ok) { const vj = await vr.json(); fe += `frontend_version: ${JSON.stringify(vj)}\n`; }
    } catch (e) { /* abaikan */ }
    try {
        const hr = await fetch(location.pathname + '?cb=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
        fe += `frontend_deploy: last-modified=${hr.headers.get('last-modified') || '?'} etag=${hr.headers.get('etag') || '?'}\n`;
    } catch (e) { /* abaikan */ }
    if (fe) report += '\n════ VERSI FRONTEND ════\n' + fe;

    // SISIPKAN snapshot state DB (diagnostic) ke laporan → developer TAK perlu akses Mongo user
    // (cocok backend lokal; tak bocorkan connection-string). Diagnostic juga memuat backend_version.
    const sidRaw = ctxState.sessionId || window.currentSessionId;
    if (sidRaw) {
        try {
            const diag = await API.getSessionDiagnostic(sidRaw);
            report += '\n\n════ DIAGNOSTIC DB (state sesi dari backend; tanpa rahasia) ════\n' + JSON.stringify(diag, null, 2) + '\n';
        } catch (e) {
            report += `\n\n════ DIAGNOSTIC DB ════\n(gagal mengambil dari backend: ${e.message})\n`;
        }
    }
    btn.disabled = false; btn.textContent = orig;

    // AUTO-SCREENSHOT: capture viewport saat user klik Report Bug (best-effort).
    // Load html2canvas on-demand, convert ke base64 JPEG (lebih kecil dari PNG).
    try {
        if (!window.html2canvas) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                s.onload = resolve; s.onerror = reject;
                document.head.appendChild(s);
            });
        }
        const canvas = await window.html2canvas(document.body, { scale: 0.7, useCORS: true, logging: false });
        const b64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        report += '\n\n════ SCREENSHOT (base64 JPEG) ════\n' + b64 + '\n';
    } catch (e) {
        report += `\n\n════ SCREENSHOT ════\n(gagal capture: ${e.message})\n`;
    }

    const sid = (sidRaw || 'manual').replace(/[^A-Za-z0-9_-]/g, '');
    const fname = `bug-${sid || 'manual'}-${Date.now()}.txt`;
    const url = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    window.open('https://t.me/BugLaporBot', '_blank');
    showToast(`📎 File "${fname}" terunduh (termasuk state DB). Di chat @BugLaporBot, LAMPIRKAN file itu lalu kirim — bot membalas "diterima".`);
    const box = document.getElementById('llm-debug-result');
    box.innerHTML = `<div style="font-size:0.82em;color:#9ca3af;margin-bottom:6px;"><span class="ico ico-file"></span> File <strong>${esc(fname)}</strong> terunduh — berisi prompt + <strong>snapshot state DB</strong> (developer tak perlu akses database Anda). Lampirkan ke <strong>@BugLaporBot</strong> lalu kirim. Cadangan — salin teks ini bila perlu:</div><textarea readonly rows="8" style="width:100%;font-family:monospace;font-size:0.78em;" onclick="this.select()">${esc(report)}</textarea>`;
}

function renderResult(res) {
    // Simpan ringkas hasil replay agar ikut terkirim saat Report Bug (konteks otomatis).
    ctxState.replay = res.ok
        ? `[OK ${res.response_chars || 0} char, ${res.duration_ms || 0}ms] ${(res.response || '').slice(0, 2000)}`
        : `[ERROR ${res.duration_ms || 0}ms] ${res.error || ''}`;
    const box = document.getElementById('llm-debug-result');
    const meta = `<div style="font-size:0.8em;color:#9ca3af;margin-bottom:6px;">model: <strong>${esc(res.model) || '(default)'}</strong> · prompt ${res.prompt_chars || 0} char · ${res.duration_ms || 0} ms · respons ${res.response_chars || 0} char</div>`;
    if (res.ok) {
        box.innerHTML = meta + `<div style="padding:8px 10px;background:rgba(34,197,94,0.1);border-left:3px solid #22c55e;border-radius:6px;color:#86efac;margin-bottom:6px;">✓ Provider MEMBALAS (${res.response_chars} char). Prompt ini OK untuk provider/model ini — jika error aslinya hilang, berarti penyebabnya pada prompt/ukuran tadi.</div><pre style="white-space:pre-wrap;font-family:monospace;font-size:0.8em;background:rgba(0,0,0,0.35);padding:10px;border-radius:6px;max-height:340px;overflow:auto;color:#d6d3d1;">${esc(res.response)}</pre>`;
    } else {
        box.innerHTML = meta + `<div style="padding:8px 10px;background:rgba(239,68,68,0.12);border-left:3px solid #ef4444;border-radius:6px;color:#fca5a5;margin-bottom:6px;">✗ ERROR dari provider — inilah yang dilaporkan ke developer (sudah tereproduksi):</div><pre style="white-space:pre-wrap;font-family:monospace;font-size:0.8em;background:rgba(0,0,0,0.35);padding:10px;border-radius:6px;max-height:340px;overflow:auto;color:#fecaca;">${esc(res.error)}</pre>`;
    }
}

// window.openLLMDebug(sessionId?) — buka modal; bila sessionId punya jejak error terakhir,
// prefill prompt+provider+error. Tanpa sessionId / tanpa jejak: mode manual (isi sendiri).
window.openLLMDebug = async (sessionId) => {
    ensureModal();
    const meta = document.getElementById('llm-debug-meta');
    setVal('llm-debug-note', '');
    setVal('llm-debug-provider', ''); setVal('llm-debug-model', '');
    setVal('llm-debug-system', ''); setVal('llm-debug-user', '');
    document.getElementById('llm-debug-result').innerHTML = '';
    meta.innerHTML = '';
    const tech = document.getElementById('llm-debug-tech');
    if (tech) tech.open = false; // default tertutup (mode lapor tampilan/UX)
    ctxState.sessionId = sessionId || window.currentSessionId || '';
    ctxState.step = ''; ctxState.error = ''; ctxState.replay = '';
    renderState();
    openModal(MODAL_ID);
    setTimeout(() => document.getElementById('llm-debug-note')?.focus(), 50);

    const sid = sessionId || window.currentSessionId;
    if (!sid) {
        meta.innerHTML = '<div style="font-size:0.85em;color:#9ca3af;margin-bottom:10px;">Tulis keterangan masalah di atas, lalu Report Bug. (Detail LLM opsional — buka jika perlu uji prompt.)</div>';
        return;
    }
    meta.innerHTML = '<div style="font-size:0.85em;color:#9ca3af;margin-bottom:10px;">⏳ Memuat jejak error LLM terakhir…</div>';
    try {
        const res = await API.getLLMDebug(sid);
        const t = res.trace;
        if (!t) {
            meta.innerHTML = '<div style="padding:8px 10px;background:rgba(13, 148, 136,0.1);border-left:3px solid #5eead4;border-radius:6px;font-size:0.85em;color:#d6d3d1;">Belum ada panggilan LLM yang gagal tercatat untuk sesi ini. Anda tetap bisa uji manual: isi provider & prompt.</div>';
            return;
        }
        ctxState.step = t.step || '';
        ctxState.error = t.error || '';
        setVal('llm-debug-provider', t.provider);
        setVal('llm-debug-model', t.model);
        setVal('llm-debug-system', t.system_prompt);
        setVal('llm-debug-user', t.user_prompt);
        if (tech) tech.open = true; // ada jejak error LLM → buka detail teknis otomatis
        document.getElementById('llm-debug-system').dispatchEvent(new Event('input'));
        const when = t.timestamp ? new Date(t.timestamp).toLocaleString() : '';
        meta.innerHTML = `<div style="padding:10px 12px;background:rgba(239,68,68,0.1);border-left:3px solid #ef4444;border-radius:6px;margin-bottom:12px;font-size:0.85em;color:#fca5a5;">
            <strong>Jejak error terakhir</strong> — step <strong>${esc(t.step)}</strong> · fungsi ${esc(t.agent_func)} · provider <strong>${esc(t.provider)}</strong> · model <strong>${esc(t.model)}</strong> · ${t.prompt_chars} char · ${esc(when)}
            <div style="margin-top:6px;color:#fecaca;white-space:pre-wrap;"><strong>Error:</strong> ${esc(t.error)}</div>
            <div style="margin-top:6px;color:#d6d3d1;">Klik <strong>Uji Coba</strong> untuk mereproduksi. Tip: potong User Prompt (full-text) lalu uji lagi — jika jadi sukses, kemungkinan context window model terlampaui.</div>
        </div>`;
    } catch (e) {
        meta.innerHTML = `<div style="color:#fca5a5;font-size:0.85em;">Gagal memuat jejak: ${esc(e.message)}</div>`;
    }
};

// Modal dibuat lazy saat pertama dibuka; init hanya untuk menandai modul ter-load.
export function initLLMDebug() { /* no-op: window.openLLMDebug siap dipakai sejak import */ }
