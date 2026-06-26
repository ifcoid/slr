// Reproducible Error (xAI): modal Debug & Uji Coba prompt LLM.
// Lihat prompt PERSIS + error panggilan LLM yang gagal, edit bila perlu, lalu "Uji Coba"
// untuk melihat respons/error MENTAH dari provider — pinpoint "error sebelah mana" dan
// jadikan laporan ke developer langsung actionable. Dipanggil via window.openLLMDebug(sessionId?).
import { API } from '../api.js';
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
            <h2>🔬 Debug & Uji Coba Prompt LLM</h2>
            <button class="btn-close" id="llm-debug-close">&times;</button>
        </div>
        <p style="font-size:0.85em;color:#9ca3af;margin:0 0 12px;">Reproduksi error (xAI): lihat prompt PERSIS yang dikirim + error provider, edit bila perlu (mis. potong full-text untuk uji batas context window), lalu <strong>Uji Coba</strong> untuk melihat respons/error mentah. Hasilnya bisa Anda kirim ke developer.</p>
        <div id="llm-debug-meta"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <div class="form-group" style="flex:1;min-width:160px;"><label>Provider</label><input id="llm-debug-provider" type="text" placeholder="mis. groq / gemini / mistral"></div>
            <div class="form-group" style="flex:1;min-width:160px;"><label>Model (opsional; kosong = default tersimpan)</label><input id="llm-debug-model" type="text" placeholder="(default tersimpan)"></div>
        </div>
        <div class="form-group"><label>System Prompt <span id="llm-debug-sys-chars" style="color:#9ca3af;font-size:0.8em;"></span></label><textarea id="llm-debug-system" rows="5" style="width:100%;font-family:monospace;font-size:0.82em;"></textarea></div>
        <div class="form-group"><label>User Prompt <span id="llm-debug-user-chars" style="color:#9ca3af;font-size:0.8em;"></span></label><textarea id="llm-debug-user" rows="10" style="width:100%;font-family:monospace;font-size:0.82em;"></textarea></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button id="llm-debug-run" class="btn btn-primary">🧪 Uji Coba</button>
            <button id="llm-debug-report" class="btn" style="background:rgba(245,158,11,0.18);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);" title="Kirim laporan bug (konteks otomatis) ke @BugLaporBot — tanpa perlu menambah keterangan">📨 Report Bug ke Telegram</button>
            <span style="font-size:0.8em;color:#9ca3af;">Uji Coba = panggil provider. Report Bug = kirim ke developer via @BugLaporBot.</span>
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

// buildReportText merangkai SELURUH info reproduksi bug ke SATU pesan (muat di limit Telegram
// 4096 char): metadata + error PENUH + prompt (dipotong bila perlu) + ringkas hasil replay.
// Tidak butuh backend — konten dibawa lewat deep-link & dikirim user ke bot (cocok utk backend
// lokal per-user; bot terpusat = satu-satunya inbox yang developer bisa baca).
function buildReportText() {
    const sid = ctxState.sessionId || window.currentSessionId || '(manual)';
    const provider = val('llm-debug-provider').trim() || '-';
    const model = val('llm-debug-model').trim() || '-';
    const sys = val('llm-debug-system');
    const usr = val('llm-debug-user');
    const err = ctxState.error || '(lihat hasil replay)';
    const replay = ctxState.replay || '';
    const head = `🐞 BUG NSA/SLR\nsession: ${sid}\nstep: ${ctxState.step || '-'}\nprovider: ${provider} / model: ${model}\nwaktu: ${new Date().toISOString()}\n\n❌ ERROR:\n${err}\n`;
    const replayLine = replay ? `\n🔁 REPLAY: ${replay.slice(0, 500)}\n` : '';
    let budget = 3800 - head.length - replayLine.length - 120;
    if (budget < 200) budget = 200;
    const sysBudget = Math.min(sys.length, Math.floor(budget * 0.35));
    const usrBudget = Math.min(usr.length, budget - sysBudget);
    const clip = (s, n) => (s.length > n ? s.slice(0, n) + `…[+${s.length - n} char dipotong]` : s);
    const body = `\n— SYSTEM PROMPT (${sys.length} char):\n${clip(sys, sysBudget)}\n\n— USER PROMPT (${usr.length} char):\n${clip(usr, usrBudget)}`;
    return head + replayLine + body;
}

// Report Bug: SATU pesan reproduksi → deep-link t.me/BugLaporBot?text=... (user tap KIRIM).
// Clipboard sebagai cadangan bila client tak meng-isi otomatis.
async function reportBug() {
    const report = buildReportText();
    let copied = false;
    try { await navigator.clipboard.writeText(report); copied = true; } catch (e) { /* abaikan */ }
    window.open('https://t.me/BugLaporBot?text=' + encodeURIComponent(report), '_blank');
    showToast(copied
        ? '📨 Telegram terbuka & laporan terisi — tap KIRIM. (Sudah disalin juga bila perlu paste.)'
        : '📨 Telegram terbuka & laporan terisi — tap KIRIM ke @BugLaporBot.');
    const box = document.getElementById('llm-debug-result');
    box.innerHTML = `<div style="font-size:0.82em;color:#9ca3af;margin-bottom:6px;">📨 Laporan siap kirim ke <strong>@BugLaporBot</strong> (bot akan balas "diterima"). Jika Telegram tak terisi otomatis, salin teks ini lalu kirim manual:</div><textarea readonly rows="8" style="width:100%;font-family:monospace;font-size:0.78em;" onclick="this.select()">${esc(report)}</textarea>`;
}

function renderResult(res) {
    // Simpan ringkas hasil replay agar ikut terkirim saat Report Bug (konteks otomatis).
    ctxState.replay = res.ok
        ? `[OK ${res.response_chars || 0} char, ${res.duration_ms || 0}ms] ${(res.response || '').slice(0, 2000)}`
        : `[ERROR ${res.duration_ms || 0}ms] ${res.error || ''}`;
    const box = document.getElementById('llm-debug-result');
    const meta = `<div style="font-size:0.8em;color:#9ca3af;margin-bottom:6px;">model: <strong>${esc(res.model) || '(default)'}</strong> · prompt ${res.prompt_chars || 0} char · ${res.duration_ms || 0} ms · respons ${res.response_chars || 0} char</div>`;
    if (res.ok) {
        box.innerHTML = meta + `<div style="padding:8px 10px;background:rgba(34,197,94,0.1);border-left:3px solid #22c55e;border-radius:6px;color:#86efac;margin-bottom:6px;">✓ Provider MEMBALAS (${res.response_chars} char). Prompt ini OK untuk provider/model ini — jika error aslinya hilang, berarti penyebabnya pada prompt/ukuran tadi.</div><pre style="white-space:pre-wrap;font-family:monospace;font-size:0.8em;background:rgba(0,0,0,0.35);padding:10px;border-radius:6px;max-height:340px;overflow:auto;color:#cbd5e1;">${esc(res.response)}</pre>`;
    } else {
        box.innerHTML = meta + `<div style="padding:8px 10px;background:rgba(239,68,68,0.12);border-left:3px solid #ef4444;border-radius:6px;color:#fca5a5;margin-bottom:6px;">✗ ERROR dari provider — inilah yang dilaporkan ke developer (sudah tereproduksi):</div><pre style="white-space:pre-wrap;font-family:monospace;font-size:0.8em;background:rgba(0,0,0,0.35);padding:10px;border-radius:6px;max-height:340px;overflow:auto;color:#fecaca;">${esc(res.error)}</pre>`;
    }
}

// window.openLLMDebug(sessionId?) — buka modal; bila sessionId punya jejak error terakhir,
// prefill prompt+provider+error. Tanpa sessionId / tanpa jejak: mode manual (isi sendiri).
window.openLLMDebug = async (sessionId) => {
    ensureModal();
    const meta = document.getElementById('llm-debug-meta');
    setVal('llm-debug-provider', ''); setVal('llm-debug-model', '');
    setVal('llm-debug-system', ''); setVal('llm-debug-user', '');
    document.getElementById('llm-debug-result').innerHTML = '';
    meta.innerHTML = '';
    ctxState.sessionId = sessionId || window.currentSessionId || '';
    ctxState.step = ''; ctxState.error = ''; ctxState.replay = '';
    openModal(MODAL_ID);

    const sid = sessionId || window.currentSessionId;
    if (!sid) {
        meta.innerHTML = '<div style="font-size:0.85em;color:#9ca3af;margin-bottom:10px;">Mode manual — isi provider & prompt, lalu Uji Coba.</div>';
        return;
    }
    meta.innerHTML = '<div style="font-size:0.85em;color:#9ca3af;margin-bottom:10px;">⏳ Memuat jejak error LLM terakhir…</div>';
    try {
        const res = await API.getLLMDebug(sid);
        const t = res.trace;
        if (!t) {
            meta.innerHTML = '<div style="padding:8px 10px;background:rgba(59,130,246,0.1);border-left:3px solid #60a5fa;border-radius:6px;font-size:0.85em;color:#cbd5e1;">Belum ada panggilan LLM yang gagal tercatat untuk sesi ini. Anda tetap bisa uji manual: isi provider & prompt.</div>';
            return;
        }
        ctxState.step = t.step || '';
        ctxState.error = t.error || '';
        setVal('llm-debug-provider', t.provider);
        setVal('llm-debug-model', t.model);
        setVal('llm-debug-system', t.system_prompt);
        setVal('llm-debug-user', t.user_prompt);
        document.getElementById('llm-debug-system').dispatchEvent(new Event('input'));
        const when = t.timestamp ? new Date(t.timestamp).toLocaleString() : '';
        meta.innerHTML = `<div style="padding:10px 12px;background:rgba(239,68,68,0.1);border-left:3px solid #ef4444;border-radius:6px;margin-bottom:12px;font-size:0.85em;color:#fca5a5;">
            <strong>Jejak error terakhir</strong> — step <strong>${esc(t.step)}</strong> · fungsi ${esc(t.agent_func)} · provider <strong>${esc(t.provider)}</strong> · model <strong>${esc(t.model)}</strong> · ${t.prompt_chars} char · ${esc(when)}
            <div style="margin-top:6px;color:#fecaca;white-space:pre-wrap;"><strong>Error:</strong> ${esc(t.error)}</div>
            <div style="margin-top:6px;color:#cbd5e1;">Klik <strong>Uji Coba</strong> untuk mereproduksi. Tip: potong User Prompt (full-text) lalu uji lagi — jika jadi sukses, kemungkinan context window model terlampaui.</div>
        </div>`;
    } catch (e) {
        meta.innerHTML = `<div style="color:#fca5a5;font-size:0.85em;">Gagal memuat jejak: ${esc(e.message)}</div>`;
    }
};

// Modal dibuat lazy saat pertama dibuka; init hanya untuk menandai modul ter-load.
export function initLLMDebug() { /* no-op: window.openLLMDebug siap dipakai sejak import */ }
