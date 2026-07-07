// js/components/renderer.js
import { API, getBaseURL } from '../api.js';
import { setButtonLoading, showToast } from '../ui.js';

// Panel audit koreksi include/exclude (HITL) — dipakai di tahap-tahap M9 agar jejak
// deviasi protokol terlihat peneliti & bisa diekspor (provenance/Q1). "" bila tak ada.
function correctionsAuditHtml(session) {
    const cor = session.screening_corrections || [];
    if (cor.length === 0) return '';
    const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const reincl = cor.filter(c => c.to === 'INCLUDE').length;
    const excl = cor.filter(c => c.to === 'EXCLUDE').length;
    const rows = cor.map(c => `<tr>
        <td style="padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.85em;">${esc(c.title) || esc(c.doi) || '-'}</td>
        <td style="padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:center;white-space:nowrap;"><span style="color:#fca5a5;">${esc(c.from) || '?'}</span> → <span style="color:${c.to === 'INCLUDE' ? '#6ee7b7' : '#fca5a5'};font-weight:bold;">${esc(c.to)}</span></td>
        <td style="padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.85em;color:#d6d3d1;">${esc(c.reason)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.78em;color:#a8a29e;white-space:nowrap;">${esc((c.at || '').slice(0, 10))}</td>
    </tr>`).join('');
    return `<details style="margin-bottom:12px;background:rgba(245,158,11,0.06);border-left:3px solid #f59e0b;border-radius:6px;padding:10px;">
        <summary style="cursor:pointer;color:#fcd34d;font-weight:bold;"><span class="ico ico-file"></span> Audit Koreksi Include/Exclude (${cor.length}: ${reincl} re-include, ${excl} exclude)</summary>
        <p style="font-size:0.82em;color:#d6d3d1;margin:8px 0;">Jejak koreksi keputusan full-text pasca-screening (deviasi protokol terdokumentasi). Angka PRISMA sudah mencerminkan keputusan FINAL; ini provenance untuk audit/Q1, juga otomatis masuk narasi Methods.</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.85em;">
            <tr style="color:#9ca3af;text-align:left;"><th style="padding:4px 6px;">Paper</th><th style="padding:4px 6px;text-align:center;">Perubahan</th><th style="padding:4px 6px;">Alasan</th><th style="padding:4px 6px;">Tgl</th></tr>
            ${rows}
        </table>
        <button onclick="window.exportCorrectionsAudit('${session.id}')" class="btn btn-secondary" style="margin-top:8px;padding:3px 9px;font-size:0.8em;"><span class="ico ico-import"></span> Export CSV</button>
    </details>`;
}

// Unduh laporan SLR utuh (Markdown) dari database untuk sesi aktif.
window.downloadFullReport = async () => {
    const sid = localStorage.getItem('activeSessionId') ||
        ((document.getElementById('display-session-id') || {}).textContent || '').trim();
    if (!sid || sid === '...' || sid === '-') { showToast('Buka sesi dulu untuk membuat laporan.', 'error'); return; }
    showToast('📄 Menyusun laporan dari database…');
    try {
        const resp = await fetch(`${getBaseURL()}/sessions/${encodeURIComponent(sid)}/report`, {
            headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '') }
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `laporan_slr_${sid}.md`;
        document.body.appendChild(a); a.click(); a.remove();
        showToast('✅ Laporan diunduh.');
    } catch (e) { showToast('Gagal menyusun laporan: ' + e.message, 'error'); }
};

// ── Ruang Ekspor (handoff kit) ──────────────────────────────────────────────
function _clientDownload(name, content, type) {
    const blob = new Blob([content || ''], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    // Revoke DITUNDA: revoke di setTimeout(0) balapan dengan proses baca-unduh browser untuk
    // blob besar (mis. laporan .md) -> entri unduhan muncul tapi file 0 byte / gagal tersimpan.
    // 60 dtk cukup; blob otomatis dibebaskan saat navigasi/tab ditutup.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function _serverDownload(sid, path, name) {
    const resp = await fetch(`${getBaseURL()}/sessions/${encodeURIComponent(sid)}${path}`, {
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '') }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    _clientDownload(name, await resp.text(), 'text/markdown;charset=utf-8');
}

// renderExportHub: panel unduhan terpusat semua artefak final (manuskrip/laporan/suplemen
// Q1 + panduan handoff cowork-LLM). Dipakai inline di COMPLETED & di modal ☰ Menu.
export function renderExportHub(session) {
    const ar = session.audit_report || {};
    // CATATAN PENTING: `session.manuscript` dari poll SELALU kosong — backend meng-EXCLUDE
    // `manuscript` dari proyeksi GetSessionLite (perf/anti-timeout). Maka JANGAN menilai
    // ketersediaan manuskrip dari objek sesi. wireExportHub memanggil GET /manuscript/meta
    // SEKALI (muat sesi penuh) lalu meng-gate tombol + reveal banner bila benar-benar absen.
    // Unduhan manuskrip .tex/.bib/.md dilayani endpoint SERVER (bukan blob dari sesi ter-strip).
    const row = (label, btns) => `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--surface-border);">
        <span style="min-width:120px;font-weight:600;font-size:0.88em;">${label}</span><span style="display:flex;gap:6px;flex-wrap:wrap;">${btns}</span></div>`;
    const b = (id, ico, text, disabled) => `<button class="btn btn-secondary" data-x="${id}" style="font-size:0.8em;" ${disabled ? 'disabled' : ''}><span class="ico ico-${ico}"></span> ${text}</button>`;
    // Banner default TERSEMBUNYI; hanya di-reveal wireExportHub bila /manuscript/meta melapor absen.
    const msWarn = `
      <div data-x="ms-warn" style="display:none;border:1px solid #b45309;background:rgba(180,83,9,.12);border-radius:8px;padding:10px 12px;margin:6px 0 4px;">
        <strong style="color:#b45309;">⚠ Manuskrip belum berhasil dibuat</strong>
        <p style="font-size:0.82em;margin:4px 0 6px;">Penulisan Modul 9 <strong>gagal / terputus</strong> (umumnya provider LLM membalas kosong karena <em>context window</em> terlampaui prompt besar, atau server embedding PEDE mati saat menulis). Karena <code>references.bib</code> laporan diambil dari BibTeX manuskrip, laporan .bib pun ikut kosong.</p>
        <p style="font-size:0.82em;margin:0 0 8px;"><strong>Sebelum mengulang:</strong> (1) nyalakan server embedding <strong>PEDE (Colab)</strong> &amp; pastikan endpoint terisi di Pengaturan; (2) di <strong>Peran LLM → Brain</strong> pilih model <strong>context besar &amp; stabil</strong> (mis. gemini/deepseek/glm-4.5 non-flash) — hindari model flash context kecil.</p>
        <button class="btn btn-secondary" data-x="regen-ms" style="font-size:0.8em;"><span class="ico ico-refresh"></span> Ulangi Pembuatan Manuskrip (Modul 9)</button>
      </div>`;
    // Banner NETRAL "unknown": ditampilkan HANYA saat ketersediaan manuskrip TAK BISA
    // dipastikan (endpoint /manuscript/meta gagal — koneksi/timeout/backend lama). JANGAN
    // menyuruh regen di sini (cegah false-negative spt kasus balqis: manuskrip ADA tapi
    // meta tak terjawab → user telanjur regen & buang kuota). Fail-open: tombol tetap aktif.
    const msUnknown = `
      <div data-x="ms-unknown" style="display:none;border:1px solid #64748b;background:rgba(100,116,139,.12);border-radius:8px;padding:10px 12px;margin:6px 0 4px;">
        <strong style="color:#94a3b8;">ℹ Ketersediaan manuskrip belum bisa dipastikan</strong>
        <p style="font-size:0.82em;margin:4px 0 6px;">Backend tak bisa dihubungi untuk memeriksa artefak manuskrip (koneksi/timeout, atau versi backend lama). Tombol unduh dibiarkan <strong>aktif</strong> — bila manuskrip Anda memang sudah selesai, unduhan tetap berfungsi. Ini <strong>BUKAN</strong> berarti manuskrip hilang.</p>
        <button class="btn btn-secondary" data-x="ms-recheck" style="font-size:0.8em;"><span class="ico ico-refresh"></span> Periksa Lagi</button>
      </div>`;
    return `
    <div class="export-hub">
      <h3 style="margin-bottom:4px;"><span class="ico ico-download"></span> Ruang Ekspor — SLR Selesai</h3>
      <p style="font-size:0.85em;color:var(--text-secondary);margin-bottom:10px;">Semua artefak final di satu tempat — rantai dokumentasi lengkap untuk submit Q1 &amp; melanjutkan bersama cowork-LLM.</p>
      ${msWarn}
      ${msUnknown}
      ${row('Manuskrip', b('tex', 'file', 'LaTeX .tex') + b('bib', 'file', 'BibTeX .bib') + b('mmd', 'file', 'Markdown .md'))}
      ${row('Laporan', b('reporttex', 'file', 'LaTeX .tex') + b('reportbib', 'file', 'references .bib') + b('report', 'file', 'Markdown .md'))}
      <p style="font-size:0.78em;color:var(--text-secondary);margin:2px 0 6px;">Manuskrip &amp; laporan konsisten <strong>LaTeX + BibTeX</strong> memakai katalog referensi NYATA yang sama (integritas sitasi). Compile: taruh <code>.tex</code> + <code>references.bib</code> di folder yang sama → <code>pdflatex</code> → <code>bibtex</code> → <code>pdflatex</code> ×2. Butuh LaTeX? <a href="#" data-x="tinytex" style="color:var(--accent-color,#0ea5a4);">Panduan install TinyTeX ↓</a></p>
      ${row('Suplemen Q1', b('protocol', 'file', 'Protokol PROSPERO', !ar.protocol_markdown) + b('repro', 'file', 'Reproducibility', !ar.repro_package_markdown))}
      ${row('Arsip Zenodo', `<button class="btn btn-secondary" data-x="zenodo" style="font-size:0.8em;"><span class="ico ico-upload"></span> Buat Draft Zenodo</button><button class="btn btn-secondary" data-x="zenodo-cfg" style="font-size:0.8em;" title="Konfigurasi token Zenodo"><span class="ico ico-file"></span> Token…</button>`)}
      <p style="font-size:0.78em;color:var(--text-secondary);margin:2px 0 6px;">Membuat <strong>draft</strong> deposition (unggah kit + prefill metadata) — <strong>PUBLISH tetap Anda lakukan sendiri</strong> di Zenodo setelah melengkapi nama penulis/ORCID (DOI permanen = perlu review). DOI lalu disitasi di Data Availability manuskrip.</p>
      ${row('Handoff LLM', b('handoff', 'ai', 'Panduan koneksi DB + regen LaTeX') + b('schema', 'file', 'Skema Data (Live)'))}
      <p style="font-size:0.78em;color:var(--text-secondary);margin-top:8px;">Panduan Handoff = cara mengarahkan LLM lain ke <strong>data Anda</strong> (Mongo/Qdrant/Neo4j, credential-safe). Skema Data = peta field ter-introspeksi dari DB Anda saat ini (selalu terkini).</p>
      <div style="border-top:1px solid var(--surface-border);margin-top:10px;padding-top:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <strong style="font-size:0.9em;">Figur Bibliometrik / SLNA</strong>
          <span style="display:flex;gap:6px;">
            <button class="btn btn-secondary" data-x="fig-upload" style="font-size:0.8em;"><span class="ico ico-file"></span> Unggah Figur</button>
            <input type="file" data-x="fig-input" accept=".svg,.png,.pdf,.csv,.json" multiple style="display:none;">
          </span>
        </div>
        <p style="font-size:0.78em;color:var(--text-secondary);margin:4px 0;">Di-generate dari notebook PEDE (thematic map, co-occurrence, tren, kolaborasi). Unggah folder hasil (SVG/PNG + CSV) agar tersimpan &amp; masuk arsip Zenodo. SVG untuk kualitas Q1.</p>
        <div data-x="fig-list" style="font-size:0.82em;color:var(--text-secondary);">Memuat figur…</div>
      </div>
    </div>`;
}
export function wireExportHub(root, session) {
    const sid = session.id;
    const ar = session.audit_report || {};
    const on = (x, fn) => { const el = root.querySelector(`[data-x="${x}"]`); if (el && !el.disabled) el.addEventListener('click', fn); };
    // Manuskrip .tex/.bib/.md diunduh dari ENDPOINT SERVER (muat sesi PENUH), BUKAN dari
    // session.manuscript (poll meng-strip `manuscript` → selalu kosong; itu bug lama yang
    // membuat tombol "belum tersedia" walau manuskrip ADA di DB).
    // Tri-state ketersediaan manuskrip: null = belum tahu, true = TERKONFIRMASI absen (meta
    // melapor semua artefak kosong), false = ada. Banner regen HANYA saat terkonfirmasi absen.
    let msConfirmedAbsent = null;
    const showMsBanner = (which) => { // 'absent' | 'unknown' | 'none'
        const warn = root.querySelector('[data-x="ms-warn"]');
        const unk = root.querySelector('[data-x="ms-unknown"]');
        if (warn) warn.style.display = (which === 'absent') ? '' : 'none';
        if (unk) unk.style.display = (which === 'unknown') ? '' : 'none';
    };
    const dl = (x, path, name, startMsg, okMsg) => on(x, async () => {
        try { if (startMsg) showToast(startMsg); await _serverDownload(sid, path, name); if (okMsg) showToast(okMsg); }
        catch (e) {
            if (/HTTP 404/.test(e.message || '')) {
                // 404 saja BUKAN bukti manuskrip hilang (bisa transien / endpoint versi lama).
                // Hanya arahkan ke regen bila meta sudah MEMASTIKAN absen; selain itu → netral.
                if (msConfirmedAbsent === true) { showToast('Manuskrip belum tergenerasi untuk sesi ini.', 'error'); showMsBanner('absent'); }
                else { showToast('Server tak mengembalikan file (404). Bila manuskrip Anda sudah selesai, coba lagi atau klik "Periksa Lagi" — ini belum tentu berarti manuskrip hilang.', 'error'); showMsBanner('unknown'); }
            }
            else showToast('Gagal: ' + e.message, 'error');
        }
    });
    dl('tex', '/manuscript/download-tex', `manuscript_${sid}.tex`, null, 'Manuskrip .tex diunduh.');
    dl('bib', '/manuscript/download-bib', `references_${sid}.bib`, null, 'BibTeX .bib diunduh.');
    dl('mmd', '/manuscript/download-md', `manuscript_${sid}.md`, null, 'Manuskrip .md diunduh.');
    dl('reportbib', '/manuscript/download-bib', 'references.bib', null, 'references.bib diunduh.');
    on('protocol', () => _clientDownload(`protokol_${sid}.md`, ar.protocol_markdown, 'text/markdown'));
    on('repro', () => _clientDownload(`reproducibility_${sid}.md`, ar.repro_package_markdown, 'text/markdown'));
    on('report', async () => { try { showToast('Menyusun laporan…'); await _serverDownload(sid, '/report', `laporan_slr_${sid}.md`); showToast('Laporan diunduh.'); } catch (e) { showToast('Gagal: ' + e.message, 'error'); } });
    on('reporttex', async () => { try { showToast('Menyusun laporan LaTeX…'); await _serverDownload(sid, '/report-tex', `laporan_slr_${sid}.tex`); showToast('Laporan .tex diunduh (butuh references.bib untuk compile).'); } catch (e) { showToast('Gagal: ' + e.message, 'error'); } });
    const tt = root.querySelector('[data-x="tinytex"]');
    if (tt) tt.addEventListener('click', (e) => { e.preventDefault(); _showTinyTexGuide(); });

    // Gating akurat via endpoint penuh (poll meng-strip `manuscript`). Tiga hasil:
    //  • sukses & ADA  → aktifkan tombol yang tersedia, sembunyikan banner.
    //  • sukses & ABSEN (semua artefak kosong) → disable tombol + banner regen (SAH).
    //  • GAGAL (koneksi/timeout/backend lama) → UNKNOWN: JANGAN klaim absen (cegah false-
    //    negative balqis), biarkan tombol aktif, tampilkan banner netral + 'Periksa Lagi'.
    const setDisabled = (x, off) => { const el = root.querySelector(`[data-x="${x}"]`); if (el) { el.disabled = off; if (off) el.title = 'Belum tersedia di sesi ini'; else el.removeAttribute('title'); } };
    async function checkManuscriptMeta() {
        try {
            const meta = await API.manuscriptMeta(sid);
            setDisabled('tex', !meta.has_latex);
            setDisabled('bib', !meta.has_bibtex);
            setDisabled('mmd', !meta.has_final);
            setDisabled('reportbib', !meta.has_bibtex);
            const absent = !meta.has_latex && !meta.has_bibtex && !meta.has_final;
            msConfirmedAbsent = absent;
            showMsBanner(absent ? 'absent' : 'none');
        } catch (_) {
            // UNKNOWN — fail-open. Tak tahu ≠ tak ada.
            msConfirmedAbsent = null;
            ['tex', 'bib', 'mmd', 'reportbib'].forEach(x => setDisabled(x, false));
            showMsBanner('unknown');
        }
    }
    checkManuscriptMeta();
    const recheckBtn = root.querySelector('[data-x="ms-recheck"]');
    if (recheckBtn) recheckBtn.addEventListener('click', () => { showToast('Memeriksa ketersediaan manuskrip…'); checkManuscriptMeta(); });

    // ── Regenerasi manuskrip (M9) saat manuskrip hilang/gagal ──
    const regenBtn = root.querySelector('[data-x="regen-ms"]');
    if (regenBtn) regenBtn.addEventListener('click', async () => {
        if (!confirm('Ulangi pembuatan manuskrip (Modul 9) dari awal?\n\nData ekstraksi, sintesis, dan keputusan inklusi TETAP dipertahankan — hanya penulisan naskah yang diulang.\n\nPASTIKAN server embedding PEDE (Colab) menyala, jika tidak proses akan menjeda menunggu.')) return;
        setButtonLoading(regenBtn, true);
        try {
            await API.reviseStep(sid, 'Regenerasi manuskrip: penulisan Modul 9 sebelumnya gagal/kosong (context overflow / provider). Ditrigger dari Ruang Ekspor.', 'M9_NEEDS_REVISION');
            showToast('Modul 9 dijalankan ulang — pantau Live Log. Nyalakan Colab PEDE bila diminta.');
        } catch (e) {
            showToast('Gagal memulai regenerasi: ' + e.message, 'error');
            setButtonLoading(regenBtn, false, '<span class="ico ico-refresh"></span> Ulangi Pembuatan Manuskrip (Modul 9)');
        }
    });

    // ── Zenodo draft-deposit ──
    async function doZenodoDeposit(btn) {
        setButtonLoading(btn, true);
        try {
            const r = await API.zenodoDeposit(sid);
            _showZenodoResult(r);
        } catch (e) {
            if (/token zenodo belum diisi/i.test(e.message || '')) { _showZenodoConfig(() => doZenodoDeposit(btn)); }
            else showToast('Gagal: ' + e.message, 'error');
        } finally { setButtonLoading(btn, false, '<span class="ico ico-upload"></span> Buat Draft Zenodo'); }
    }
    const zBtn = root.querySelector('[data-x="zenodo"]');
    if (zBtn) zBtn.addEventListener('click', () => doZenodoDeposit(zBtn));
    const zCfg = root.querySelector('[data-x="zenodo-cfg"]');
    if (zCfg) zCfg.addEventListener('click', () => _showZenodoConfig(null));
    on('handoff', async () => { try { showToast('Menyusun panduan handoff…'); await _serverDownload(sid, '/handoff-guide', `handoff_${sid}.md`); showToast('Panduan handoff diunduh.'); } catch (e) { showToast('Gagal: ' + e.message, 'error'); } });
    on('schema', async () => { try { showToast('Introspeksi skema live…'); await _serverDownload(sid, '/schema-guide', `schema_${sid}.md`); showToast('Skema data diunduh.'); } catch (e) { showToast('Gagal: ' + e.message, 'error'); } });

    // ── Figur bibliometrik: unggah + daftar + preview ──
    const figList = root.querySelector('[data-x="fig-list"]');
    const figInput = root.querySelector('[data-x="fig-input"]');
    const figUploadBtn = root.querySelector('[data-x="fig-upload"]');
    async function _figBlobURL(name) {
        const resp = await fetch(`${getBaseURL()}/sessions/${encodeURIComponent(sid)}/figures/${encodeURIComponent(name)}`, {
            headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '') }
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return URL.createObjectURL(await resp.blob());
    }
    async function reloadFigures() {
        if (!figList) return;
        try {
            const r = await API.listFigures(sid);
            const figs = (r && r.figures) || [];
            if (!figs.length) { figList.innerHTML = '<em>Belum ada figur. Jalankan notebook PEDE lalu unggah hasilnya.</em>'; return; }
            const isImg = (n) => /\.(png|svg)$/i.test(n);
            figList.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">` +
                figs.map(f => {
                    const kb = Math.max(1, Math.round((f.size || 0) / 1024));
                    return `<span style="display:inline-flex;align-items:center;gap:4px;border:1px solid var(--surface-border);border-radius:6px;padding:3px 7px;">
                        <a href="#" data-fig="${encodeURIComponent(f.filename)}" style="color:var(--accent-color,#0ea5a4);">${f.filename}</a>
                        <span style="color:var(--text-secondary);font-size:0.85em;">${kb}KB</span></span>`;
                }).join('') + `</div><div data-x="fig-previews" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;"></div>`;
            figList.querySelectorAll('[data-fig]').forEach(a => a.addEventListener('click', async (e) => {
                e.preventDefault();
                try { const url = await _figBlobURL(decodeURIComponent(a.dataset.fig)); const el = document.createElement('a'); el.href = url; el.download = decodeURIComponent(a.dataset.fig); document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
                catch (err) { showToast('Gagal unduh: ' + err.message, 'error'); }
            }));
            const prev = figList.querySelector('[data-x="fig-previews"]');
            for (const f of figs.filter(x => isImg(x.filename)).slice(0, 6)) {
                try {
                    const url = await _figBlobURL(f.filename);
                    const img = document.createElement('img');
                    img.src = url; img.title = f.filename;
                    img.style.cssText = 'max-width:150px;max-height:120px;border:1px solid var(--surface-border);border-radius:6px;background:#fff;';
                    prev.appendChild(img);
                } catch (_) { /* skip preview */ }
            }
        } catch (e) { figList.innerHTML = '<em>Gagal memuat figur: ' + e.message + '</em>'; }
    }
    if (figUploadBtn && figInput) {
        figUploadBtn.addEventListener('click', () => figInput.click());
        figInput.addEventListener('change', async () => {
            if (!figInput.files.length) return;
            const fd = new FormData();
            for (const f of figInput.files) fd.append('files', f);
            setButtonLoading(figUploadBtn, true);
            try {
                const r = await API.uploadFigures(sid, fd);
                showToast(`${r.saved || 0} figur diunggah.`, 'success');
                await reloadFigures();
            } catch (e) { showToast('Gagal unggah: ' + e.message, 'error'); }
            finally { setButtonLoading(figUploadBtn, false, '<span class="ico ico-file"></span> Unggah Figur'); figInput.value = ''; }
        });
    }
    reloadFigures();
}
// Panduan install TinyTeX (LaTeX ringan lintas-platform) untuk compile .tex → PDF.
function _showTinyTexGuide() {
    const overlay = document.createElement('div'); overlay.className = 'peek-overlay';
    overlay.innerHTML = `<div class="peek-modal"><div class="peek-header"><span><span class="ico ico-file"></span> Install TinyTeX &amp; compile PDF</span><button class="peek-close" aria-label="Tutup"><span class="ico ico-close"></span></button></div>
    <div class="peek-body" style="font-size:0.88em;line-height:1.6;">
      <p><strong>TinyTeX</strong> = distribusi LaTeX ringan (~100 MB) lintas-platform. Cukup sekali pasang untuk meng-compile manuskrip &amp; laporan menjadi PDF.</p>
      <p><strong>1) Install (pilih OS):</strong></p>
      <p style="margin:4px 0;">• <em>macOS / Linux</em> (terminal):</p>
      <pre style="background:rgba(255,255,255,.05);padding:8px;border-radius:6px;overflow-x:auto;"><code>wget -qO- "https://yihui.org/tinytex/install-bin-unix.sh" | sh</code></pre>
      <p style="margin:4px 0;">• <em>Windows</em> (PowerShell):</p>
      <pre style="background:rgba(255,255,255,.05);padding:8px;border-radius:6px;overflow-x:auto;"><code>irm https://yihui.org/tinytex/install-bin-windows.bat -OutFile install.bat; ./install.bat</code></pre>
      <p style="margin:4px 0;">• Alternatif via R: <code>install.packages('tinytex'); tinytex::install_tinytex()</code></p>
      <p><strong>2) Compile</strong> (taruh <code>.tex</code> + <code>references.bib</code> di folder sama):</p>
      <pre style="background:rgba(255,255,255,.05);padding:8px;border-radius:6px;overflow-x:auto;"><code>pdflatex manuscript.tex
bibtex manuscript
pdflatex manuscript.tex
pdflatex manuscript.tex</code></pre>
      <p style="color:var(--text-secondary);">Urutan itu (pdflatex → bibtex → pdflatex ×2) diperlukan agar sitasi &amp; daftar pustaka dari BibTeX ter-resolve. Paket yang kurang di-install otomatis oleh TinyTeX saat pertama dipakai. Cara sama untuk <code>laporan_slr.tex</code>.</p>
      <p style="color:var(--text-secondary);">Tanpa install: tempel <code>.tex</code> ke <strong>Overleaf</strong> (upload <code>.tex</code> + <code>references.bib</code>) — compile di browser.</p>
    </div></div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.peek-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

// Modal konfig token Zenodo (per-user, sandbox toggle). onSaved: callback (mis. retry deposit).
async function _showZenodoConfig(onSaved) {
    let cfg = { sandbox: false }, tokenSet = false;
    try { const r = await API.getZenodoConfig(); cfg = (r && r.config) || cfg; tokenSet = !!(r && r.token_set); } catch (_) { }
    const overlay = document.createElement('div'); overlay.className = 'peek-overlay';
    overlay.innerHTML = `<div class="peek-modal"><div class="peek-header"><span><span class="ico ico-file"></span> Konfigurasi Token Zenodo</span><button class="peek-close" aria-label="Tutup"><span class="ico ico-close"></span></button></div>
    <div class="peek-body" style="font-size:0.9em;line-height:1.6;">
      <p>Buat token di <strong>zenodo.org</strong> (atau sandbox) → Account ▸ Applications ▸ <em>Personal access tokens</em> ▸ New, centang scope <code>deposit:write</code> (+ <code>deposit:actions</code>). Token disimpan di backend Anda, <strong>tak pernah dibagikan</strong>.</p>
      <label style="display:block;margin:8px 0 3px;font-weight:600;">Personal Access Token ${tokenSet ? '<span style="color:#10b981;font-weight:400;">(sudah tersimpan — kosongkan untuk mempertahankan)</span>' : ''}</label>
      <input type="password" id="zen-token" placeholder="${tokenSet ? '••••••• (tersimpan)' : 'tempel token di sini'}" style="width:100%;padding:7px;border-radius:6px;border:1px solid var(--surface-border);background:var(--input-bg,#1c1917);color:inherit;">
      <label style="display:flex;align-items:center;gap:8px;margin:10px 0;"><input type="checkbox" id="zen-sandbox" ${cfg.sandbox ? 'checked' : ''}> Mode <strong>sandbox</strong> (sandbox.zenodo.org — uji tanpa mint DOI asli)</label>
      <p style="font-size:0.82em;color:var(--text-secondary);">Sandbox &amp; produksi memakai token BERBEDA (dari situs masing-masing).</p>
      <button id="zen-save" class="btn btn-primary" style="margin-top:6px;"><span class="ico ico-file"></span> Simpan</button>
    </div></div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.peek-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#zen-save').addEventListener('click', async () => {
        const payload = { token: overlay.querySelector('#zen-token').value.trim(), sandbox: overlay.querySelector('#zen-sandbox').checked };
        try { await API.updateZenodoConfig(payload); showToast('Token Zenodo tersimpan.', 'success'); close(); if (onSaved) onSaved(); }
        catch (e) { showToast('Gagal simpan: ' + e.message, 'error'); }
    });
}

// Modal hasil draft-deposit (link + pengingat publish manual).
function _showZenodoResult(r) {
    const overlay = document.createElement('div'); overlay.className = 'peek-overlay';
    const warn = (r.failed || 0) > 0 ? `<p style="color:#f59e0b;">${r.failed} file gagal diunggah (dari ${r.total}).</p>` : '';
    overlay.innerHTML = `<div class="peek-modal"><div class="peek-header"><span><span class="ico ico-upload"></span> Draft Zenodo dibuat${r.sandbox ? ' (sandbox)' : ''}</span><button class="peek-close" aria-label="Tutup"><span class="ico ico-close"></span></button></div>
    <div class="peek-body" style="font-size:0.9em;line-height:1.6;">
      <p><strong>${r.uploaded} artefak</strong> terunggah ke draft deposition. ${warn}</p>
      <p><strong style="color:#f59e0b;">Belum ter-publish.</strong> Langkah Anda selanjutnya:</p>
      <ol style="padding-left:18px;">
        <li>Buka draft di Zenodo (tombol bawah).</li>
        <li>Lengkapi metadata <strong>WAJIB</strong>: nama penulis + ORCID, deskripsi, lisensi, keywords.</li>
        <li>Tekan <strong>Publish</strong> di Zenodo untuk mint <strong>DOI</strong> permanen.</li>
        <li>Sitasi DOI itu di <em>Data Availability Statement</em> manuskrip.</li>
      </ol>
      <p style="font-size:0.82em;color:var(--text-secondary);">Draft tidak di-publish otomatis: DOI bersifat permanen &amp; publik, jadi perlu review Anda.</p>
      <a href="${r.draft_url}" target="_blank" rel="noopener" class="btn btn-primary" style="margin-top:6px;"><span class="ico ico-upload"></span> Buka Draft di Zenodo</a>
    </div></div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.peek-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

// Buka Ruang Ekspor sebagai modal dari ☰ Menu (kapan saja, untuk sesi aktif).
window.openExportHub = async () => {
    const sid = localStorage.getItem('activeSessionId') || ((document.getElementById('display-session-id') || {}).textContent || '').trim();
    if (!sid || sid === '...' || sid === '-') { showToast('Buka sesi dulu untuk mengekspor.', 'error'); return; }
    let session;
    try { session = await API.getSession(sid); } catch (e) { showToast('Gagal memuat sesi: ' + e.message, 'error'); return; }
    const overlay = document.createElement('div'); overlay.className = 'peek-overlay';
    overlay.innerHTML = `<div class="peek-modal"><div class="peek-header"><span><span class="ico ico-download"></span> Ruang Ekspor</span><button class="peek-close" aria-label="Tutup"><span class="ico ico-close"></span></button></div><div class="peek-body">${renderExportHub(session)}</div></div>`;
    document.body.appendChild(overlay);
    wireExportHub(overlay, session);
    const close = () => overlay.remove();
    overlay.querySelector('.peek-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
};

// Uji model NYATA untuk sebuah ROLE (mis. reviewer2) — tangkap model terkunci/404.
window.testRoleModel = async (role) => {
    showToast(`🧪 Menguji model ${role}…`);
    try {
        const res = await API.testModel('', { role });
        if (res.ok) showToast(`✓ ${role} (${res.model || 'default'}) bisa dipakai.`);
        else showToast(`✗ ${role} (${res.model || 'default'}) gagal: ${(res.message || '').slice(0, 160)}`, 'error');
    } catch (e) { showToast('Gagal menguji: ' + e.message, 'error'); }
};

// Ulangi HANYA spot-verification (tanpa re-ekstrak) setelah memperbaiki provider Reviewer 2.
window.reverifyExtraction = async (sessionId) => {
    if (!confirm('Ulangi pengecekan kualitas (Reviewer 2) tanpa re-ekstrak? Pastikan model Reviewer 2 sudah benar (Test Model).')) return;
    try {
        await API.reviseStep(sessionId, 'Re-verify setelah perbaikan provider Reviewer 2', 'M7_STEP2_REVERIFY');
        showToast('🔁 Verifikasi diulang — lihat Live Log.');
        setTimeout(() => window.location.reload(), 900);
    } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
};

// Lanjut TANPA QA Reviewer 2 (provider tak tersedia) — keputusan SADAR user; dicatat sebagai
// limitation metodologis. Dipakai dari gerbang M7_STEP2_VERIFY_BLOCKED saat provider tak bisa
// diperbaiki sekarang. Ekstraksi tetap dipertahankan.
window.skipVerification = async (sessionId) => {
    if (!confirm('Lanjut TANPA QA silang Reviewer 2?\n\nIni akan dicatat sebagai LIMITATION metodologis (tidak ada verifikasi dual-rater). Gunakan hanya bila provider Reviewer 2 benar-benar tak bisa diperbaiki sekarang.')) return;
    try {
        await API.reviseStep(sessionId, 'Lanjut tanpa QA Reviewer 2 (limitation)', 'M7_STEP2_VERIFY_SKIP');
        showToast('⏭ Lanjut tanpa verifikasi — dicatat sebagai limitation.');
        setTimeout(() => window.location.reload(), 900);
    } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
};

// Ulangi QA setelah rater provider diperbaiki — dari gerbang M7_STEP3_QA_BLOCKED (QA dijeda
// karena rater gagal sistemik: rate-limit/overload/ResourceExhausted/context/koneksi).
// reviseStep → M7_STEP3_QA memicu ResetQAErrors di backend: HANYA paper ERROR yang di-rate
// ulang; rating & kalibrasi yang sudah ada DIPERTAHANKAN (hemat kuota, jaga reproducibility).
window.retryQABlocked = async (sessionId) => {
    if (!confirm('Ulangi penilaian QA?\n\nPastikan provider rater (Reviewer 1 & 2) sudah diperbaiki/diganti dan lolos Test Model. Hanya paper yang ERROR yang akan dinilai ulang — paper yang sudah dinilai & kalibrasi dipertahankan.')) return;
    try {
        await API.reviseStep(sessionId, 'Ulangi QA setelah perbaikan provider rater', 'M7_STEP3_QA');
        showToast('🔁 QA diulang — lihat Live Log.');
        setTimeout(() => window.location.reload(), 900);
    } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
};

window.exportCorrectionsAudit = async (sessionId) => {
    try {
        const s = await API.getSession(sessionId);
        const cor = s.screening_corrections || [];
        if (!cor.length) { showToast('Tak ada koreksi tercatat.', 'error'); return; }
        const q = (v) => '"' + String(v || '').replace(/"/g, '""') + '"';
        const csv = 'paper_id,doi,title,from,to,reason,at\n' +
            cor.map(c => [c.paper_id, c.doi, c.title, c.from, c.to, c.reason, c.at].map(q).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'screening_corrections.csv';
        document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { showToast('Gagal export: ' + e.message, 'error'); }
};
// renderAuditReport merender laporan audit Modul 10 (verdict + cek per-kategori + atestasi).
function renderAuditReport(rep) {
    const e = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const verdictMap = {
        READY: ['#10b981', 'SIAP SUBMIT', 'Semua cek lolos.'],
        READY_WITH_WARNINGS: ['#f59e0b', 'SIAP DENGAN CATATAN', 'Tak ada bloker; tinjau peringatan.'],
        NOT_READY: ['#ef4444', 'BELUM SIAP', 'Ada bloker yang harus diperbaiki.'],
    };
    const [vc, vlabel] = verdictMap[rep.verdict] || ['#a8a29e', rep.verdict || '-', ''];
    const badge = (st) => {
        if (st === 'PASS') return `<span style="color:#10b981;font-weight:700;">✓ LOLOS</span>`;
        if (st === 'WARN') return `<span style="color:#f59e0b;font-weight:700;">⚠ PERINGATAN</span>`;
        return `<span style="color:#ef4444;font-weight:700;">✗ BLOKER</span>`;
    };
    const order = { FAIL: 0, WARN: 1, PASS: 2 };
    const checks = (rep.checks || []).slice().sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    const rows = checks.map(c => `
        <div style="padding:10px 12px;border-left:3px solid ${c.status === 'FAIL' ? '#ef4444' : c.status === 'WARN' ? '#f59e0b' : '#10b981'};background:rgba(255,255,255,0.03);border-radius:6px;margin-bottom:6px;">
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                <strong style="font-size:0.92em;">${e(c.name)}</strong>
                <span style="font-size:0.82em;">${badge(c.status)} <span style="color:#a8a29e;">· ${e(c.category)}</span></span>
            </div>
            <div style="font-size:0.85em;color:#d6d3d1;margin-top:4px;">${e(c.detail)}</div>
            ${c.fix ? `<div style="font-size:0.82em;color:#fcd34d;margin-top:4px;">→ ${e(c.fix)}</div>` : ''}
        </div>`).join('');
    const hasErrorFail = (rep.checks || []).some(c => c.status === 'FAIL' && /ERROR/i.test(c.detail || ''));
    const dlRow = (rep.protocol_markdown || rep.repro_package_markdown || hasErrorFail) ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:${hasErrorFail ? '4px' : '12px'};">
            ${hasErrorFail ? `<button id="btn-m10-fix-errors" class="btn btn-warning" style="font-size:0.85em;"><span class="ico ico-repeat"></span> Rate Ulang Studi ERROR</button>` : ''}
            ${rep.protocol_markdown ? `<button id="dl-protocol" class="btn btn-secondary" style="font-size:0.85em;"><span class="ico ico-download"></span> Protokol (PROSPERO/OSF)</button>` : ''}
            ${rep.repro_package_markdown ? `<button id="dl-repro" class="btn btn-secondary" style="font-size:0.85em;"><span class="ico ico-download"></span> Paket Reproducibility (Supplementary)</button>` : ''}
        </div>
        ${hasErrorFail ? `<p style="font-size:0.8em;color:#a8a29e;margin:0 0 12px;">Studi ERROR = gagal dinilai (biasanya rater/provider bermasalah). Tombol di atas MENILAI ULANG studi tsb (bukan mengabaikannya — mencegah selection bias). Bila rater masih gagal, perbaiki provider di Pengaturan lalu ulangi.</p>` : ''}` : '';
    return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:8px;background:${vc}1a;border:1px solid ${vc}55;margin-bottom:12px;">
            <span style="font-size:1.05em;font-weight:700;color:${vc};">${e(vlabel)}</span>
            <span style="font-size:0.9em;color:#d6d3d1;">${e(rep.summary)}</span>
        </div>
        ${dlRow}
        <div style="display:flex;gap:14px;font-size:0.82em;color:#a8a29e;margin-bottom:10px;">
            <span style="color:#10b981;">✓ ${rep.pass_count || 0} lolos</span>
            <span style="color:#f59e0b;">⚠ ${rep.warn_count || 0} peringatan</span>
            <span style="color:#ef4444;">✗ ${rep.fail_count || 0} bloker</span>
        </div>
        <p style="font-size:0.82em;color:#a8a29e;margin-bottom:10px;">Cek ini <strong>simbolik/deterministik</strong> dari data sesi (bukan hasil tebakan AI). Perbaiki bloker via tombol modul terkait lalu jalankan ulang, atau — sebagai peneliti penanggung jawab — <strong>atestasi</strong> bahwa manuskrip layak submit dengan menekan <em>Setuju &amp; Lanjut</em> (tercatat sebagai jejak audit).</p>
        ${rows}
    `;
}

// renderClaimVerify menampilkan bukti xAI M9: nama model penulis + hasil triangulasi
// neuro-symbolic per klaim (Qdrant/Neo4j/MongoDB) + daftar klaim dukungan <2 sumber.
function renderClaimVerify(ms) {
    const cvs = (ms && ms.claim_verifications) || [];
    const model = (ms && ms.model_used) || '';
    if (!cvs.length && !model) return '';
    const e = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let ver = 0, q = 0, n = 0, mo = 0; const weak = [];
    cvs.forEach(c => { if (c.sources >= 2) ver++; else weak.push(c); if (c.qdrant_verified) q++; if (c.neo4j_verified) n++; if (c.mongo_verified) mo++; });
    const total = cvs.length;
    const modelLine = model ? `<div style="font-size:0.82em;color:#a8a29e;margin-bottom:6px;">Ditulis oleh: <strong style="color:#5eead4;">${e(model)}</strong></div>` : '';
    if (!total) return `<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:10px 12px;margin-bottom:12px;">${modelLine}</div>`;
    const pct = Math.round(ver / total * 100);
    const weakRows = weak.slice(0, 30).map(c => {
        const src = [c.qdrant_verified && 'Qdrant', c.neo4j_verified && 'Neo4j', c.mongo_verified && 'MongoDB'].filter(Boolean).join('+') || '—';
        return `<tr><td style="padding:3px 6px;color:#a8a29e;vertical-align:top;">${e(c.section)}</td><td style="padding:3px 6px;">${e((c.claim || '').slice(0, 160))}</td><td style="padding:3px 6px;color:#fcd34d;white-space:nowrap;">${e(src)}</td></tr>`;
    }).join('');
    return `
    <div style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:10px 12px;margin-bottom:12px;">
        ${modelLine}
        <div style="font-size:0.86em;margin-bottom:4px;"><strong>Verifikasi klaim (triangulasi neuro-symbolic):</strong> ${ver}/${total} klaim didukung ≥2 sumber (${pct}%).</div>
        <div style="font-size:0.8em;color:#a8a29e;">Sumber cocok: Qdrant ${q} · Neo4j ${n} · MongoDB ${mo}.${n === 0 ? ' <span style="color:#fcd34d;">Neo4j/AuraDB nonaktif — aktifkan untuk triangulasi 3-sumber yang lebih kuat.</span>' : ''}</div>
        ${weak.length ? `<details style="margin-top:6px;"><summary style="cursor:pointer;color:#fcd34d;font-size:0.82em;">⚠ ${weak.length} klaim dukungan &lt;2 sumber (ditinjau/dilemahkan saat Pass 2)</summary>
            <div style="max-height:240px;overflow:auto;margin-top:6px;"><table style="width:100%;font-size:0.78em;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:3px 6px;">Section</th><th style="text-align:left;padding:3px 6px;">Klaim</th><th style="text-align:left;padding:3px 6px;">Cocok</th></tr></thead><tbody>${weakRows}</tbody></table></div></details>` : ''}
    </div>`;
}

export function renderApprovalContent(area, session, handleApproval) {
    const status = session.status;
    let html = '';

    const wrapCard = (title, content) => `
        <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
            <h4 style="margin-top: 0; color: #5eead4; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">${title}</h4>
            ${content}
        </div>
    `;

    const formatMarkdown = (md) => {
        if (!md) return '';
        
        // Percantik teks gaya === JUDUL ===
        md = md.replace(/^===\s*(.*?)\s*===$/gm, '\n\n<div style="background: linear-gradient(90deg, rgba(13, 148, 136, 0.2) 0%, transparent 100%); border-left: 4px solid #0d9488; padding: 6px 15px; font-weight: bold; color: #5eead4; font-size: 0.9em; letter-spacing: 1px; text-transform: uppercase; margin: 10px 0; border-radius: 4px; display: block;">$1</div>\n\n');

        if (window.marked) {
            return window.marked.parse(md);
        }
        // Fallback simpel markdown parser
        return md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                 .replace(/\*(.*?)\*/g, '<em>$1</em>')
                 .replace(/\n/g, '<br>');
    };

    const escHtml = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    if (status === 'M1_WAITING_APPROVAL' && session.foundation) {
        const f = session.foundation;
        const fSection = (title, md, color) => `
            <div style="margin-bottom: 18px;">
                <h5 style="color: ${color}; margin: 0 0 8px;">${title}</h5>
                <div style="background: rgba(0,0,0,0.2); padding: 12px 15px; border-radius: 6px; font-size: 0.92em; line-height: 1.6; max-height: 320px; overflow-y: auto;">
                    ${formatMarkdown(md) || '<em style="color:#9ca3af;">(kosong)</em>'}
                </div>
            </div>`;
        html = wrapCard('Modul 1 — Fondasi Teori & Aturan Global (Briefing)', `
            <p style="margin-top:0; color:#9ca3af; font-size:0.88em;">Topik: <strong style="color:#d1d5db;">${f.topic_context || session.topic || '-'}</strong></p>
            ${fSection('<span class="ico ico-book"></span> Fondasi Teori SLR (disesuaikan topik · AI)', f.theory_markdown, '#5eead4')}
            ${fSection('🤖 Etika & Kapabilitas AI (kanonik)', f.ai_practice_markdown, '#c4b5fd')}
            ${fSection('<span class="ico ico-settings"></span> Aturan Global SLR + CoWork (kanonik)', f.global_rules_markdown, '#6ee7b7')}
        `);

    } else if (status === 'M2_STEP2_WAITING_APPROVAL' && session.prior_reviews_matrix) {
        // HITL + anti-halusinasi: usulan AI dibuat TANPA web search (provider Brain tak
        // mendukung pencarian), jadi tiap entri ditandai UNVERIFIED dan WAJIB diverifikasi
        // peneliti (edit + tandai VERIFIED) sebelum Setuju.
        const escAttr = (v) => String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const escTxt = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const inp = (cls, val, ph) => `<input class="${cls}" value="${escAttr(val)}" placeholder="${ph}" style="width:100%;padding:6px;border-radius:4px;background:rgba(255,255,255,0.05);color:#e5e7eb;border:1px solid rgba(255,255,255,0.1);">`;
        const ta = (cls, val, ph) => `<textarea class="${cls}" placeholder="${ph}" rows="2" style="width:100%;padding:6px;border-radius:4px;background:rgba(255,255,255,0.05);color:#e5e7eb;border:1px solid rgba(255,255,255,0.1);resize:vertical;">${escTxt(val)}</textarea>`;
        const cardHtml = (r) => {
            const verified = String(r.verification || '').toUpperCase() === 'VERIFIED';
            return `
            <div class="pr-card" data-verif="${verified ? 'VERIFIED' : 'UNVERIFIED'}" style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid ${verified ? '#10b981' : '#f59e0b'};">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px;">
                    <span class="pr-badge" style="font-size:0.75em; font-weight:bold; padding:3px 8px; border-radius:10px; ${verified ? 'background:rgba(16,185,129,0.2);color:#6ee7b7;' : 'background:rgba(245,158,11,0.2);color:#fcd34d;'}">${verified ? '✓ VERIFIED' : '⚠ UNVERIFIED — perlu dicek'}</span>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="pr-verif-toggle btn" style="padding:3px 9px; font-size:0.8em;">${verified ? 'Tandai UNVERIFIED' : '✓ Tandai VERIFIED'}</button>
                        <button type="button" class="pr-del btn btn-danger" style="padding:3px 9px; font-size:0.8em;"><span class="ico ico-close"></span> </button>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9em;">
                    <div style="grid-column: 1 / -1;"><strong style="color:#9ca3af;">Author/Year:</strong> ${inp('pr-author', r.author_year, 'Nama dkk. (Tahun)')}</div>
                    <div><strong style="color:#9ca3af;">Scope:</strong> ${inp('pr-scope', r.scope, 'Populasi, Area, Periode')}</div>
                    <div><strong style="color:#9ca3af;">Methodology:</strong> ${inp('pr-method', r.methodology, 'SLR/Biblio, DB, n')}</div>
                    <div style="grid-column: 1 / -1;"><strong style="color:#9ca3af;">Key Findings:</strong> ${ta('pr-find', r.key_findings, 'Temuan utama')}</div>
                    <div style="grid-column: 1 / -1;"><strong style="color:#9ca3af;">Limitations:</strong> ${ta('pr-limit', r.limitations, 'Kelemahan studi')}</div>
                    <div style="grid-column: 1 / -1;"><strong style="color:#fca5a5;">Selisih (Gap):</strong> ${inp('pr-selisih', r.selisih, 'BEDA POPULASI / BEDA FOKUS')}</div>
                    <div style="grid-column: 1 / -1;"><strong style="color:#6ee7b7;">Synthesis Novelty:</strong> ${ta('pr-novelty', r.synthesis_novelty, 'Sintesis 150-200 kata')}</div>
                </div>
            </div>`;
        };
        const reviews = (session.prior_reviews_matrix.reviews || []);
        const cards = reviews.map(cardHtml).join('');
        const guidance = session.prior_reviews_matrix.search_guidance || '';
        const guidanceHtml = guidance ? `
            <div style="background:rgba(13, 148, 136,0.08); padding:12px; border-radius:6px; border-left:3px solid #0d9488; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">
                    <strong style="color:#5eead4; font-size:0.9em;"><span class="ico ico-search"></span> Cara menemukan & memverifikasi artikelnya</strong>
                    <button type="button" id="btn-pr-copy-guide" class="btn btn-secondary" style="padding:3px 9px; font-size:0.78em;"><span class="ico ico-copy"></span> Salin query</button>
                </div>
                <p id="pr-guide-text" style="font-size:0.85em; color:#d6d3d1; margin:0; white-space:pre-wrap; line-height:1.5;">${escTxt(guidance)}</p>
            </div>` : '';
        html = wrapCard('Review of Prior Reviews (Matrix)', `
            <p style="font-size:0.85em; color:#fcd34d; background:rgba(245,158,11,0.08); padding:10px; border-radius:6px; border-left:3px solid #f59e0b; margin-top:0;">⚠ Usulan ini dibuat <strong>tanpa pencarian web</strong> (dari pengetahuan model). Setiap entri <strong>WAJIB Anda verifikasi</strong> di Scholar/Scopus/WoS memakai panduan di bawah, koreksi bila perlu, lalu tandai <strong>VERIFIED</strong>. Jangan Setuju selama masih ada UNVERIFIED yang belum Anda cek.</p>
            ${guidanceHtml}
            <div id="pr-cards">${cards}</div>
            <div style="margin-top:10px; display:flex; gap:8px;">
                <button type="button" id="btn-pr-add" class="btn btn-secondary" style="padding:5px 10px;"><span class="ico ico-plus"></span> Tambah Review</button>
                <button type="button" id="btn-pr-save" class="btn btn-primary" style="padding:5px 10px;"><span class="ico ico-save"></span> Simpan Matriks</button>
            </div>
        `);

        setTimeout(() => {
            const copyBtn = document.getElementById('btn-pr-copy-guide');
            if (copyBtn) copyBtn.addEventListener('click', async () => {
                const txt = document.getElementById('pr-guide-text')?.textContent || '';
                try { await navigator.clipboard.writeText(txt); showToast('📋 Panduan pencarian disalin.'); }
                catch { showToast('Gagal menyalin; salin manual dari teks panduan.', 'error'); }
            });
            const wrap = document.getElementById('pr-cards');
            if (!wrap) return;
            const addBtn = document.getElementById('btn-pr-add');
            const saveBtn = document.getElementById('btn-pr-save');
            const applyCard = (card) => {
                const verified = card.dataset.verif === 'VERIFIED';
                card.style.borderLeftColor = verified ? '#10b981' : '#f59e0b';
                const badge = card.querySelector('.pr-badge');
                const toggle = card.querySelector('.pr-verif-toggle');
                if (badge) {
                    badge.textContent = verified ? '✓ VERIFIED' : '⚠ UNVERIFIED — perlu dicek';
                    badge.style.cssText = `font-size:0.75em; font-weight:bold; padding:3px 8px; border-radius:10px; ${verified ? 'background:rgba(16,185,129,0.2);color:#6ee7b7;' : 'background:rgba(245,158,11,0.2);color:#fcd34d;'}`;
                }
                if (toggle) toggle.textContent = verified ? 'Tandai UNVERIFIED' : '✓ Tandai VERIFIED';
            };
            wrap.addEventListener('click', (e) => {
                const card = e.target.closest('.pr-card');
                if (!card) return;
                if (e.target.classList.contains('pr-del')) { card.remove(); return; }
                if (e.target.classList.contains('pr-verif-toggle')) {
                    card.dataset.verif = card.dataset.verif === 'VERIFIED' ? 'UNVERIFIED' : 'VERIFIED';
                    applyCard(card);
                }
            });
            if (addBtn) addBtn.addEventListener('click', () => {
                wrap.insertAdjacentHTML('beforeend', cardHtml({ verification: 'UNVERIFIED' }));
                wrap.querySelector('.pr-card:last-child .pr-author')?.focus();
            });
            if (saveBtn) saveBtn.addEventListener('click', async () => {
                const out = [];
                wrap.querySelectorAll('.pr-card').forEach((c) => {
                    const author = (c.querySelector('.pr-author')?.value || '').trim();
                    if (!author) return;
                    out.push({
                        author_year: author,
                        scope: (c.querySelector('.pr-scope')?.value || '').trim(),
                        methodology: (c.querySelector('.pr-method')?.value || '').trim(),
                        key_findings: (c.querySelector('.pr-find')?.value || '').trim(),
                        limitations: (c.querySelector('.pr-limit')?.value || '').trim(),
                        selisih: (c.querySelector('.pr-selisih')?.value || '').trim(),
                        synthesis_novelty: (c.querySelector('.pr-novelty')?.value || '').trim(),
                        verification: c.dataset.verif === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED',
                    });
                });
                if (out.length === 0) { showToast('Minimal satu review dengan Author/Year.', 'error'); return; }
                try {
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = '<span class="ico ico-save"></span> Menyimpan...';
                    const res = await API.savePriorReviews(session.id, out);
                    const v = out.filter(r => r.verification === 'VERIFIED').length;
                    showToast(`✅ ${out.length} review tersimpan (${v} terverifikasi).`);
                } catch (err) {
                    showToast('Gagal menyimpan matriks: ' + err.message, 'error');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<span class="ico ico-save"></span> Simpan Matriks';
                }
            });
        }, 0);

    } else if (status === 'M2_STEP3_WAITING_APPROVAL' && session.pico_definitions) {
        const pico = session.pico_definitions;
        html = wrapCard('PICO Definitions', `
            <div style="margin-bottom: 15px;">
                <h5 style="color: #c4b5fd; margin-bottom: 5px; margin-top: 0;">Canonical Term</h5>
                <p><strong>Term:</strong> ${pico.canonical_term?.term || ''}</p>
                <p><strong>Definition:</strong> ${pico.canonical_term?.definition || ''}</p>
                <p><strong>Rejected Alternatives:</strong> ${pico.canonical_term?.rejected_alternatives || ''}</p>
            </div>
            <hr style="border-color: rgba(255,255,255,0.1);">
            
            <div style="margin-bottom: 15px;">
                <h5 style="color: #c4b5fd; margin-bottom: 5px;">Population</h5>
                <p><strong>Value:</strong> ${pico.p?.value || ''}</p>
                <p><em>What Counts:</em> ${pico.p?.operational_def?.what_counts || ''}</p>
                <p><em>What Doesn't:</em> ${pico.p?.operational_def?.what_doesnt_count || ''}</p>
                <p><em>Edge Cases:</em> ${pico.p?.operational_def?.edge_cases || ''}</p>
            </div>
            <hr style="border-color: rgba(255,255,255,0.1);">
            
            <div style="margin-bottom: 15px;">
                <h5 style="color: #c4b5fd; margin-bottom: 5px;">Intervention</h5>
                <p><strong>Value:</strong> ${pico.i?.value || ''}</p>
                <p><em>What Counts:</em> ${pico.i?.operational_def?.what_counts || ''}</p>
                <p><em>What Doesn't:</em> ${pico.i?.operational_def?.what_doesnt_count || ''}</p>
                <p><em>Edge Cases:</em> ${pico.i?.operational_def?.edge_cases || ''}</p>
            </div>
            <hr style="border-color: rgba(255,255,255,0.1);">
            
            <div style="margin-bottom: 15px;">
                <h5 style="color: #c4b5fd; margin-bottom: 5px;">Comparison</h5>
                <p><strong>Value:</strong> ${pico.c?.value || ''}</p>
                <p><em>What Counts:</em> ${pico.c?.operational_def?.what_counts || ''}</p>
                <p><em>What Doesn't:</em> ${pico.c?.operational_def?.what_doesnt_count || ''}</p>
                <p><em>Edge Cases:</em> ${pico.c?.operational_def?.edge_cases || ''}</p>
            </div>
            <hr style="border-color: rgba(255,255,255,0.1);">
            
            <div style="margin-bottom: 15px;">
                <h5 style="color: #c4b5fd; margin-bottom: 5px;">Outcome</h5>
                <p><strong>Value:</strong> ${pico.o?.value || ''}</p>
                <p><em>What Counts:</em> ${pico.o?.operational_def?.what_counts || ''}</p>
                <p><em>What Doesn't:</em> ${pico.o?.operational_def?.what_doesnt_count || ''}</p>
                <p><em>Edge Cases:</em> ${pico.o?.operational_def?.edge_cases || ''}</p>
            </div>
        `);

    } else if (status === 'M2_STEP3_5_WAITING_FILTERS') {
        let filtersHtml = `
            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="color: #fca5a5;">Aksi Diperlukan: Isi Scope Filters</h4>
                <p>Silakan isi detail batasan riset Anda:</p>
                <form id="form-filters">
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Rentang Tahun (Misal: 2018-2024)</label>
                        <input type="text" id="filter-tahun" placeholder="contoh: 2018-2023" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${(session.scope_filters?.rentang_tahun || '').includes('[ISI DI SINI') ? '' : session.scope_filters?.rentang_tahun}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Geografis (Misal: Global, Asia, USA)</label>
                        <input type="text" id="filter-geografis" placeholder="contoh: Global / Asia Tenggara" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${(session.scope_filters?.geografis || '').includes('[ISI DI SINI') ? '' : session.scope_filters?.geografis}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Sektor / Bidang (Misal: Computer Science & Medicine)</label>
                        <input type="text" id="filter-sektor" placeholder="contoh: Pendidikan / Kesehatan" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${(session.scope_filters?.sektor || '').includes('[ISI DI SINI') ? '' : session.scope_filters?.sektor}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Bahasa (Misal: English only)</label>
                        <input type="text" id="filter-bahasa" placeholder="contoh: English only" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${(session.scope_filters?.bahasa || '').includes('[ISI DI SINI') ? '' : session.scope_filters?.bahasa}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Lainnya (Misal: Hanya Jurnal Peer-Reviewed, Bebas Konferensi)</label>
                        <input type="text" id="filter-lainnya" placeholder="contoh: Hanya Jurnal Peer-Reviewed" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${(session.scope_filters?.lainnya || '').includes('[ISI DI SINI') ? '' : session.scope_filters?.lainnya}">
                    </div>
                    <button type="submit" class="btn btn-primary" style="margin-top: 10px;">Simpan Filters & Lanjut</button>
                </form>
            </div>
        `;
        area.insertAdjacentHTML('beforeend', filtersHtml);
        
        setTimeout(() => {
            const formFilters = document.getElementById('form-filters');
            if (formFilters) {
                formFilters.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const filterData = {
                        rentang_tahun: document.getElementById('filter-tahun').value,
                        geografis: document.getElementById('filter-geografis').value,
                        sektor: document.getElementById('filter-sektor').value,
                        bahasa: document.getElementById('filter-bahasa').value,
                        lainnya: document.getElementById('filter-lainnya').value
                    };
                    
                    try {
                        const btn = e.target.querySelector('button');
                        btn.textContent = "Menyimpan...";
                        btn.disabled = true;
                        
                        const { getBaseURL } = await import('../api.js');
                        const token = localStorage.getItem('auth_token');
                        const headers = { 'Content-Type': 'application/json' };
                        if (token) headers['Authorization'] = `Bearer ${token}`;
                        
                        const response = await fetch(`${getBaseURL()}/sessions/${session.id}`, {
                            method: 'PUT',
                            headers: headers,
                            body: JSON.stringify({ 
                                scope_filters: filterData,
                                status: 'M2_STEP3_5_FILTERS_PROVIDED'
                            })
                        });
                        
                        if (!response.ok) {
                            const errData = await response.json().catch(() => ({}));
                            throw new Error(errData.error || `HTTP Error ${response.status}`);
                        }
                        
                        // Sukses! Cukup trigger re-fetch dari tracker utama, jangan reload page penuh
                        if (window.fetchSessionStatus) {
                            window.fetchSessionStatus();
                        } else {
                            window.location.reload();
                        }
                    } catch (error) {
                        console.error("Gagal update filter:", error);
                        alert("Gagal update filter: " + error.message);
                        
                        // Kembalikan tombol ke kondisi semula
                        const btn = e.target.querySelector('button');
                        btn.textContent = "Simpan Filters & Lanjut";
                        btn.disabled = false;
                    }
                });
            }
        }, 100);
        return true; // We handled rendering completely

    } else if (status === 'M2_STEP4_WAITING_APPROVAL' && session.scope_justifications) {
        const justifications = session.scope_justifications;
        
        // Helper untuk menyulap URL menjadi link pendek yang bisa diklik
        const formatLinks = (text) => {
            if (!text) return '';
            return text.replace(/https?:\/\/(www\.)?([-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9]{1,6})\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi, function(url, www, domain) {
                let trailing = '';
                // Pisahkan tanda baca di akhir URL yang kemungkinan bukan bagian dari URL
                while (url.endsWith(')') || url.endsWith('.') || url.endsWith(',') || url.endsWith(']')) {
                    trailing = url.slice(-1) + trailing;
                    url = url.slice(0, -1);
                }
                
                // Kembalikan kurung tutup jika ternyata itu pasangan kurung buka dari URL Wikipedia dll
                let openP = (url.match(/\(/g) || []).length;
                let closeP = (url.match(/\)/g) || []).length;
                while (trailing.startsWith(')') && openP > closeP) {
                    url += ')';
                    trailing = trailing.substring(1);
                    closeP++;
                }

                return `<a href="${url}" target="_blank" style="color: #5eead4; text-decoration: none; border-bottom: 1px dotted #5eead4;">${domain}</a>` + trailing;
            });
        };

        let scList = '';
        justifications.forEach((sc) => {
            const statusColor = sc.status && sc.status.includes('Valid') ? '#10b981' : '#ef4444';
            scList += `
                <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid ${statusColor};">
                    <h5 style="margin-top: 0; color: #c4b5fd; margin-bottom: 10px; font-size: 1.05em;">${sc.name}</h5>
                    <div style="margin-bottom: 8px;"><strong>Teoretis:</strong> <span style="color: #d1d5db;">${formatLinks(sc.theoretical)}</span></div>
                    <div style="margin-bottom: 8px;"><strong>Metodologis:</strong> <span style="color: #d1d5db;">${formatLinks(sc.methodological)}</span></div>
                    <div style="margin-bottom: 8px;"><strong>Praktis:</strong> <span style="color: #d1d5db;">${formatLinks(sc.practical)}</span></div>
                    <div><span style="background: ${statusColor}40; color: ${statusColor}; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; font-weight: 500;">Status: ${sc.status}</span></div>
                </div>
            `;
        });
        html = wrapCard('Justifikasi Batasan / Scope Riset (3 Lapis)', scList);

    } else if (status === 'M2_STEP5_WAITING_APPROVAL' && session.research_questions) {
        let rqList = '<ul style="list-style: none; padding: 0;">';
        session.research_questions.forEach((rq, idx) => {
            const warning = rq.is_orphan ? '<span style="color: #fca5a5; font-size: 0.8em; margin-left: 10px;">[⚠️ ORPHAN]</span>' : '';
            
            let traceHtml = '';
            if (rq.traceability) {
                traceHtml = `
                    <div style="margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 4px;">
                        <div style="margin-bottom: 4px;"><strong>Gap:</strong> <span style="color: #d1d5db;">${rq.traceability.gap || '-'}</span></div>
                        <div style="margin-bottom: 4px;"><strong>Prior Reviews:</strong> <span style="color: #d1d5db;">${rq.traceability.prior_reviews || '-'}</span></div>
                        <div style="margin-bottom: 4px;"><strong>PICO:</strong> <span style="color: #d1d5db;">${rq.traceability.pico || '-'}</span></div>
                        <div><strong>Scope:</strong> <span style="color: #d1d5db;">${rq.traceability.scope || '-'}</span></div>
                    </div>
                `;
            }

            rqList += `
                <li style="margin-bottom: 1rem; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 4px; border-left: 4px solid ${rq.is_orphan ? '#ef4444' : '#0d9488'};">
                    <h5 style="margin-top: 0; margin-bottom: 10px; color: #5eead4; font-size: 1.05em;">RQ ${idx + 1} <span style="color: #5eead4; font-size: 0.85em; font-weight: normal; margin-left: 10px;">(${rq.type})</span> ${warning}</h5>
                    <div style="margin-bottom: 10px; font-size: 1.1em;">${rq.question}</div>
                    <small style="color: #9ca3af;">Traceability:</small>
                    ${traceHtml}
                </li>
            `;
        });
        rqList += '</ul>';
        html = wrapCard('Research Questions', rqList);

    } else if (status === 'M2_STEP6_WAITING_APPROVAL' && session.finer_novelty_check) {
        const finer = session.finer_novelty_check;
        const color = finer.is_pass ? '#4ade80' : '#fca5a5';
        html = wrapCard('FINER & Novelty Check', `
            <h3 style="color: ${color}; margin-top: 0;">Status: ${finer.is_pass ? 'PASSED' : 'FAILED'}</h3>
            <div style="margin-bottom: 10px;"><strong>Feasibility:</strong><br> ${formatMarkdown(finer.finer?.feasible)}</div>
            <div style="margin-bottom: 10px;"><strong>Interesting:</strong><br> ${formatMarkdown(finer.finer?.interesting)}</div>
            <div style="margin-bottom: 10px;"><strong>Novelty:</strong><br> ${formatMarkdown(finer.finer?.novel)}</div>
            <div style="margin-bottom: 10px;"><strong>Ethical:</strong><br> ${formatMarkdown(finer.finer?.ethical)}</div>
            <div style="margin-bottom: 10px;"><strong>Relevant:</strong><br> ${formatMarkdown(finer.finer?.relevant)}</div>
            <div style="margin-bottom: 10px;"><strong>Rekomendasi Utama:</strong><br> ${formatMarkdown(finer.internal_coherence?.recommendation)}</div>
            ${session.modul2_summary ? `<hr style="border-color: rgba(255,255,255,0.1);"><p><strong>Summary:</strong><br>${formatMarkdown(session.modul2_summary.markdown)}</p>` : ''}
        `);

    } else if (status === 'M3_STEP1_WAITING_APPROVAL' && session.database_selection) {
        const dbs = session.database_selection;
        
        let dbList = '';
        if (dbs.matriks_database) {
            dbs.matriks_database.forEach(db => {
                dbList += `
                    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #0d9488;">
                        <h5 style="margin-top: 0; color: #5eead4; font-size: 1.05em;">${db.database}</h5>
                        <div style="margin-bottom: 8px;"><strong>Coverage:</strong> ${db.coverage_strength}</div>
                        <div style="margin-bottom: 8px;"><strong>Limitation:</strong> ${db.limitation}</div>
                        <div><strong>Fit dengan Topik:</strong> ${db.fit_dengan_topik}</div>
                    </div>
                `;
            });
        }

        html = wrapCard('Database Selection', `
            <div style="margin-bottom: 15px;"><strong>Coverage Bidang:</strong><br> ${formatMarkdown(dbs.cek_coverage_bidang)}</div>
            <h5 style="color: #5eead4; margin-top: 20px;">Matriks Evaluasi Database</h5>
            ${dbList}
            <div style="margin-top: 15px; padding: 10px; background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; border-radius: 4px;">
                <strong>Decision:</strong> <span style="color: #4ade80;">${dbs.decision}</span>
            </div>
            <div style="margin-top: 15px;"><strong>Final Justification:</strong><br>${formatMarkdown(dbs.justifikasi_final)}</div>
        `);

    } else if (status === 'M3_STEP2_WAITING_APPROVAL' && session.keywords) {
        let kwList = '';
        if (session.keywords) {
            const keys = ['population', 'intervention', 'comparison', 'outcome'];
            keys.forEach(k => {
                const kw = session.keywords[k];
                if (kw) {
                    kwList += `
                        <div style="margin-bottom: 1rem; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; border-left: 4px solid #0d9488;">
                            <h5 style="margin-top: 0; color: #c4b5fd; text-transform: capitalize;">${k}</h5>
                            <strong>Canonical Term:</strong> ${kw.canonical_term || ''}<br>
                            <em>Synonyms:</em> ${kw.main_synonyms ? kw.main_synonyms.join(', ') : ''}<br>
                            <em>Alternative:</em> ${kw.alternative_terms ? kw.alternative_terms.join(', ') : ''}<br>
                            <em style="color: #fca5a5;">Avoid:</em> ${kw.avoid_list ? kw.avoid_list.join(', ') : ''}
                            ${kw.reasoning ? `<div style="margin-top: 5px; font-size: 0.9em; color: #a1a1aa;"><strong>Reasoning:</strong> ${kw.reasoning}</div>` : ''}
                        </div>
                    `;
                }
            });
        }
        html = wrapCard('Keywords Development', kwList);

    } else if (status === 'M3_STEP3_WAITING_APPROVAL' && session.search_string) {
        const ss = session.search_string;
        let filters = '<ul>';
        if (ss.filters) {
            ss.filters.forEach(f => {
                filters += `<li><strong>${f.filter} (${f.value}):</strong> ${f.justification}</li>`;
            });
        }
        filters += '</ul>';
        
        let adaptedHtml = '';
        if (ss.adapted_strings && ss.adapted_strings.length > 0) {
            adaptedHtml = '<h5 style="color: #5eead4; margin-top: 20px;">Adapted Strings (Other Databases)</h5>';
            ss.adapted_strings.forEach(ad => {
                adaptedHtml += `
                    <div style="margin-bottom: 15px;">
                        <strong>${ad.database}</strong>
                        <div style="background: #1e1e1e; padding: 10px; border-radius: 4px; font-family: monospace; color: #5eead4; font-size: 0.9em; margin-top: 5px; overflow-x: auto;">
                            ${ad.query}
                        </div>
                    </div>
                `;
            });
        }
        
        html = wrapCard('Search String (Scopus Utama)', `
            <div style="background: #1e1e1e; padding: 15px; border-radius: 6px; font-family: monospace; color: #5eead4; margin-bottom: 1rem; overflow-x: auto;">
                ${ss.scopus_query}
            </div>
            ${adaptedHtml}
            <p><strong>Filters Applied:</strong></p>
            ${filters}
        `);

    } else if (status === 'M3_STEP4_WAITING_EXECUTION') {
        let execHtml = `
            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="color: #5eead4;">Aksi Diperlukan: Eksekusi Manual Database</h4>
                
                ${session.search_string && session.search_string.pre_validation ? `
                <div style="background: rgba(234, 179, 8, 0.1); border-left: 4px solid #eab308; padding: 10px 15px; margin-bottom: 1rem; border-radius: 4px;">
                    <h5 style="color: #eab308; margin-top: 0; margin-bottom: 8px;">⚠️ Hasil Pre-Validasi (Penting)</h5>
                    <div style="font-size: 0.9em;">
                        ${formatMarkdown(session.search_string.pre_validation)}
                    </div>
                </div>
                ` : ''}

                <p><strong>Query Scopus:</strong></p>
                <div style="background: #1e1e1e; padding: 15px; border-radius: 6px; font-family: monospace; color: #5eead4; margin-bottom: 1rem; overflow-x: auto;">
                    ${session.search_string ? session.search_string.scopus_query : 'Kueri tidak ditemukan.'}
                </div>
                ${session.search_string && session.search_string.adapted_strings ? session.search_string.adapted_strings.map(ad => {
                    let dbLink = '';
                    if (ad.database.toLowerCase().includes('ieee')) dbLink = ' <a href="https://ieeexplore.ieee.org/search/advanced/command" target="_blank" style="color: #5eead4; text-decoration: underline; font-size: 0.9em; font-weight: normal;">(Buka IEEE Command Search ↗)</a>';
                    else if (ad.database.toLowerCase().includes('pubmed')) dbLink = ' <a href="https://pubmed.ncbi.nlm.nih.gov/advanced/" target="_blank" style="color: #5eead4; text-decoration: underline; font-size: 0.9em; font-weight: normal;">(Buka PubMed Advanced Search ↗)</a>';
                    else if (ad.database.toLowerCase().includes('web of science')) dbLink = ' <a href="https://www.webofscience.com/wos/alldb/advanced-search" target="_blank" style="color: #5eead4; text-decoration: underline; font-size: 0.9em; font-weight: normal;">(Buka WoS Advanced Search ↗)</a>';
                    return `
                    <p style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px;">
                        <strong>Query ${ad.database}:</strong>
                        ${dbLink}
                    </p>
                    <div style="background: #1e1e1e; padding: 10px; border-radius: 4px; font-family: monospace; color: #5eead4; font-size: 0.9em; margin-bottom: 1rem; overflow-x: auto;">
                        ${ad.query}
                    </div>
                    `;
                }).join('') : ''}
                <p>Silakan buka <a href="https://www.scopus.com/pages/search/publications?type=advanced" target="_blank" style="color: #5eead4; text-decoration: underline;">Scopus Advanced Search ↗</a> (serta database lain yang telah Anda pilih), jalankan query masing-masing, aplikasikan filter di bawah ini. Lalu laporkan hasilnya pada kolom yang tersedia:</p>
                
                <div style="background: rgba(167, 139, 250, 0.1); border-left: 4px solid #5eead4; padding: 10px 15px; margin-bottom: 1rem; border-radius: 4px; font-size: 0.9em;">
                    <strong style="color: #5eead4;">Filter yang Wajib Diterapkan:</strong>
                    <ul style="margin-top: 5px; margin-bottom: 0; padding-left: 20px; color: #d1d5db;">
                        <li><strong>Rentang Tahun:</strong> ${session.scope_filters?.rentang_tahun || 'Semua tahun'}</li>
                        <li><strong>Geografis:</strong> ${session.scope_filters?.geografis || 'Global'}</li>
                        <li><strong>Bahasa:</strong> ${session.scope_filters?.bahasa || 'Semua bahasa'}</li>
                        <li><strong>Sektor:</strong> ${session.scope_filters?.sektor || '-'}</li>
                        <li><strong>Lainnya:</strong> ${session.scope_filters?.lainnya || '-'}</li>
                    </ul>
                </div>
                
                <form id="form-scopus-hits">
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Scopus (Total Hits)</label>
                        <input type="text" class="input-db-hit" data-db="Scopus" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" placeholder="Misal: 145 dokumen" required>
                    </div>
                    ${session.search_string?.adapted_strings ? session.search_string.adapted_strings.map(ad => `
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label>${ad.database} (Total Hits)</label>
                            <input type="text" class="input-db-hit" data-db="${ad.database}" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" placeholder="Misal: 50 dokumen" required>
                        </div>
                    `).join('') : ''}
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Grey Literature / Tambahan (Opsional)</label>
                        <input type="text" class="input-db-hit" data-db="Lainnya" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" placeholder="Misal: arXiv: 20 dokumen">
                    </div>

                    <button type="submit" class="btn btn-primary">Simpan Hits & Lanjut Evaluasi</button>
                </form>

                <hr style="border-color: rgba(255,255,255,0.1); margin: 2rem 0;">
                <h5 style="color: #fca5a5;">Apakah ada query yang error di database (Scopus/IEEE/PubMed)?</h5>
                <p style="font-size: 0.9em; color: #d1d5db;">Jika query di atas mengalami syntax error saat dijalankan, beri tahu LLM untuk memperbaikinya.</p>
                <form id="form-scopus-revision">
                    <textarea id="m3-revision" class="input-modern" rows="3" placeholder="Misal: Query IEEE Xplore error karena ada masalah pada tanda kurung di bagian..."></textarea>
                    <button type="submit" class="btn btn-warning" style="margin-top: 10px;">Revisi Keyword (Kembali ke M3.3)</button>
                </form>
            </div>
        `;
        area.insertAdjacentHTML('beforeend', execHtml);
        
        setTimeout(() => {
            const formHits = document.getElementById('form-scopus-hits');
            if (formHits) {
                formHits.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const hitInputs = document.querySelectorAll('.input-db-hit');
                    let hitsData = [];
                    hitInputs.forEach(input => {
                        if (input.value.trim() !== '') {
                            hitsData.push(`${input.getAttribute('data-db')}: ${input.value}`);
                        }
                    });
                    const hits = hitsData.join('\\n');
                    
                    try {
                        const btn = e.target.querySelector('button');
                        btn.textContent = "Menyimpan...";
                        btn.disabled = true;
                        
                        const res = await API.updateSession(session.id, { 
                                feedback: hits,
                                status: 'M3_STEP4_EVALUATION'
                        });
                        
                        // Sukses, muntahkan pesan respons ke user lalu tunggu klik OK
                        alert("Berhasil! Server merespons: " + (res.message || "Data Hits Tersimpan."));
                        window.location.reload();
                    } catch (error) {
                        alert("Gagal update hits: " + error.message);
                        const btn = e.target.querySelector('button');
                        btn.textContent = "Simpan Hits & Lanjut Evaluasi";
                        btn.disabled = false;
                    }
                });
            }

            const formRev = document.getElementById('form-scopus-revision');
            if (formRev) {
                formRev.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const revText = document.getElementById('m3-revision').value.trim();
                    if (!revText) {
                        alert("Harap isi pesan revisi terlebih dahulu!");
                        return;
                    }
                    try {
                        const btn = e.target.querySelector('button');
                        btn.textContent = "Mengirim Revisi...";
                        btn.disabled = true;
                        
                        const res = await API.reviseStep(session.id, revText, 'M3_STEP3_NEEDS_REVISION');
                        
                        alert("Revisi terkirim! Status kembali ke pemrosesan M3.3.");
                        window.location.reload();
                    } catch (error) {
                        alert("Gagal mengirim revisi: " + error.message);
                        const btn = e.target.querySelector('button');
                        btn.textContent = "Revisi Keyword (Kembali ke M3.3)";
                        btn.disabled = false;
                    }
                });
            }
        }, 100);
        return true;

    } else if (status === 'M3_STEP4_WAITING_APPROVAL' && session.search_log) {
        html = wrapCard('Search Log & Summary', `
            <p><strong>Total Hits:</strong> ${JSON.stringify(session.search_log.total_hits)}</p>
            <p><strong>Update Policy:</strong> ${session.search_log.update_policy}</p>
            ${session.modul3_summary ? `<hr style="border-color: rgba(255,255,255,0.1);"><p><strong>Summary Modul 3:</strong><br>${formatMarkdown(session.modul3_summary.markdown)}</p>` : ''}
        `);

    } else if (status === 'M4_STEP1_WAITING_INPUT') {
        const ssInfo = session.search_log ? `
            <div style="background: rgba(13, 148, 136, 0.1); border-left: 4px solid #0d9488; padding: 15px; margin-bottom: 1.5rem; border-radius: 4px;">
                <h5 style="color: #5eead4; margin-top: 0; margin-bottom: 8px;"><span class="ico ico-info"></span> Referensi Search String (Final)</h5>
                <p style="font-size: 0.9em; margin-bottom: 8px;">Silakan <em>copy-paste</em> kueri di bawah ini ke <a href="https://www.scopus.com/pages/search/publications?type=advanced" target="_blank" style="color: #5eead4; font-weight: bold; text-decoration: underline;">Scopus Advanced Search ↗</a> untuk mengeksekusi pencarian akhir:</p>
                <div style="background: #1e1e1e; padding: 10px; border-radius: 4px; font-family: monospace; color: #5eead4; font-size: 0.9em; margin-bottom: 10px; overflow-x: auto; white-space: pre-wrap;">
                    ${session.search_string?.scopus_query || session.search_log.search_string_final}
                </div>
                <div style="font-size: 0.85em; color: #d1d5db;">
                    <strong>Filter yang Berlaku:</strong> ${session.search_log.filters_applied ? session.search_log.filters_applied.map(f => `${f.filter} (${f.value})`).join(' | ') : '-'}
                </div>
            </div>
        ` : '';

        let initHtml = `
            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="color: #5eead4;">M4: Finalisasi Eksekusi Scopus & Sanity Check</h4>
                ${ssInfo}
                <p>Setelah Anda melakukan pencarian di Scopus, mohon lengkapi formulir di bawah ini dengan data aktual:</p>
                <form id="form-m4-init">
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Database Utama</label>
                        <input type="text" id="m4-db" class="input-modern" value="${session.data_mining_log?.initial_sample?.database || 'Scopus'}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Total Hits Pre-Filter</label>
                        <input type="text" id="m4-pre" class="input-modern" value="${session.data_mining_log?.initial_sample?.total_hits_pre_filter || ''}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Total Hits Post-Filter</label>
                        <input type="text" id="m4-post" class="input-modern" value="${session.data_mining_log?.initial_sample?.total_hits_post_filter || ''}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>20-50 Judul Pertama (Pisahkan dengan baris baru)</label>
                        <textarea id="m4-titles" class="input-modern" rows="5">${(session.data_mining_log?.initial_sample?.sample_titles || []).join('\n')}</textarea>
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Paper Kunci yang DITEMUKAN (Pisahkan dengan baris baru)</label>
                        <textarea id="m4-found" class="input-modern" rows="3">${(session.data_mining_log?.initial_sample?.key_papers_found || []).join('\n')}</textarea>
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Paper Kunci yang TIDAK DITEMUKAN / MISSED (Tulis NIHIL jika tidak ada)</label>
                        <textarea id="m4-missing" class="input-modern" rows="3">${(session.data_mining_log?.initial_sample?.key_papers_missing || []).join('\n')}</textarea>
                    </div>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <button type="submit" class="btn btn-primary">Lakukan Sanity Check</button>
                        <button type="button" id="btn-escape-m3" class="btn btn-danger">Revisi Kueri (Kembali ke Modul 3)</button>
                    </div>
                </form>
            </div>
        `;
        area.insertAdjacentHTML('beforeend', initHtml);
        
        setTimeout(() => {
            const formInit = document.getElementById('form-m4-init');
            if (formInit) {
                formInit.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const newDataMiningLog = { ...session.data_mining_log };
                    if (!newDataMiningLog.initial_sample) newDataMiningLog.initial_sample = {};
                    
                    newDataMiningLog.initial_sample.database = document.getElementById('m4-db').value;
                    newDataMiningLog.initial_sample.total_hits_pre_filter = document.getElementById('m4-pre').value;
                    newDataMiningLog.initial_sample.total_hits_post_filter = document.getElementById('m4-post').value;
                    newDataMiningLog.initial_sample.sample_titles = document.getElementById('m4-titles').value.split('\n').filter(t => t.trim() !== '');
                    newDataMiningLog.initial_sample.key_papers_found = document.getElementById('m4-found').value.split('\n').filter(t => t.trim() !== '');
                    newDataMiningLog.initial_sample.key_papers_missing = document.getElementById('m4-missing').value.split('\n').filter(t => t.trim() !== '');
                    
                    try {
                        const btn = e.target.querySelector('button');
                        btn.textContent = "Menyimpan...";
                        btn.disabled = true;
                        
                        await API.updateSession(session.id, { 
                                data_mining_log: newDataMiningLog,
                                status: 'M4_STEP1_EVALUATE'
                        });
                        
                        window.location.reload();
                    } catch (error) {
                        alert("Gagal update data: " + error.message);
                        const btn = e.target.querySelector('button');
                        btn.textContent = "Lakukan Sanity Check";
                        btn.disabled = false;
                    }
                });
            }

            const btnEscapeM3 = document.getElementById('btn-escape-m3');
            if (btnEscapeM3) {
                btnEscapeM3.addEventListener('click', async () => {
                    const reason = prompt("Masukkan alasan revisi Kueri (opsional):", "Kembali ke Modul 3 untuk memperbaiki Kueri.");
                    if (reason !== null) {
                        try {
                            btnEscapeM3.textContent = "Memproses...";
                            btnEscapeM3.disabled = true;
                            await API.reviseStep(session.id, reason, "M3_STEP3_NEEDS_REVISION");
                            window.location.reload();
                        } catch(err) {
                            alert(err.message);
                            btnEscapeM3.textContent = "Revisi Kueri (Kembali ke Modul 3)";
                            btnEscapeM3.disabled = false;
                        }
                    }
                });
            }
        }, 100);
        return true;

    } else if (status === 'M4_STEP1_WAITING_APPROVAL' && session.data_mining_log && session.data_mining_log.sanity_check) {
        const sc = session.data_mining_log.sanity_check;
        html = wrapCard('Sanity Check Results', `
            <p><strong>Decision:</strong> <span style="color: ${sc.decision === 'PROCEED' ? '#4ade80' : '#fca5a5'}; font-weight: bold;">${sc.decision}</span></p>
            <p><strong>Volume Analysis:</strong> ${sc.volume_analysis}</p>
            <p><strong>Recommendation:</strong> ${sc.recommendation}</p>
            <p><em>Jika REVISE, tekan revisi dan sistem otomatis mengembalikan Anda ke M3_STEP3.</em></p>
        `);

    } else if (status === 'M4_STEP2_WAITING_IMPORT') {
        let scopusQuery = session.search_log?.search_string_final || session.search_string?.scopus_query || 'Tidak tersedia';
        let filterText = session.search_log?.filters_applied ? session.search_log.filters_applied.map(f => `${f.filter} (${f.value})`).join(' | ') : '-';
        
        let adaptedHtml = '';
        let hasIEEE = false;
        if (session.search_string && session.search_string.adapted_strings) {
            adaptedHtml = session.search_string.adapted_strings.map(ad => {
                if (ad.database.toLowerCase().includes('ieee')) hasIEEE = true;
                let dbLink = ad.database;
                if (ad.database.toLowerCase().includes('pubmed')) {
                    dbLink = `<a href="https://pubmed.ncbi.nlm.nih.gov/advanced/" target="_blank" style="color: #5eead4; text-decoration: underline;">${ad.database} ↗</a>`;
                } else if (ad.database.toLowerCase().includes('ieee')) {
                    dbLink = `<a href="https://ieeexplore.ieee.org/search/advanced/command" target="_blank" style="color: #5eead4; text-decoration: underline;">${ad.database} ↗</a>`;
                }
                return `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <strong style="color: #d6d3d1;">${dbLink}</strong>
                    <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; font-family: monospace; color: #5eead4; font-size: 0.85em; margin: 4px 0; overflow-x: auto; white-space: pre-wrap;">${ad.query}</div>
                </div>
            `}).join('');
        }
        
        if (!hasIEEE && scopusQuery && scopusQuery !== 'Tidak tersedia') {
            // Generate fallback IEEE from Scopus query by removing TITLE-ABS-KEY
            let ieeeFallback = scopusQuery.replace(/^TITLE-ABS-KEY\s*\(/i, '');
            if (ieeeFallback.endsWith(')')) ieeeFallback = ieeeFallback.slice(0, -1);
            
            // IEEE limit is 10 wildcards. We remove ALL wildcards to be safe, as IEEE auto-stems.
            ieeeFallback = ieeeFallback.replace(/\*/g, '');
            
            adaptedHtml += `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <strong style="color: #d6d3d1;"><a href="https://ieeexplore.ieee.org/search/advanced/command" target="_blank" style="color: #5eead4; text-decoration: underline;">IEEE Xplore ↗</a> (Auto-adapted)</strong>
                    <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; font-family: monospace; color: #5eead4; font-size: 0.85em; margin: 4px 0; overflow-x: auto; white-space: pre-wrap;">${ieeeFallback}</div>
                    <div style="font-size: 0.8em; color: #9ca3af; margin-top: 4px;"><em>Catatan: Simbol wildcard (*) telah dihapus otomatis karena batasan maksimal 10 wildcard dari IEEE. IEEE sudah memiliki fitur auto-stemming.</em></div>
                </div>
            `;
        }

        let refHtml = `
            <div style="background: rgba(13, 148, 136, 0.1); border-left: 4px solid #0d9488; padding: 15px; margin-bottom: 1.5rem; border-radius: 4px;">
                <h5 style="color: #5eead4; margin-top: 0; margin-bottom: 8px;"><span class="ico ico-info"></span> Referensi Kueri & Panduan Ekspor</h5>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #d6d3d1;"><a href="https://www.scopus.com/pages/search/publications?type=advanced" target="_blank" style="color: #5eead4; text-decoration: underline;">Scopus ↗</a></strong>
                    <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; font-family: monospace; color: #5eead4; font-size: 0.85em; margin: 4px 0; overflow-x: auto; white-space: pre-wrap;">${scopusQuery}</div>
                    <div style="font-size: 0.8em; color: #9ca3af;"><em>Export: Select All > Export > CSV (centang Citation, Abstract, dsb)</em></div>
                </div>
                ${adaptedHtml}
                
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <strong style="color: #d6d3d1;">Filter yang Berlaku (Gunakan ini di semua database):</strong>
                    <div style="font-size: 0.85em; color: #d1d5db; margin-top: 4px;">${filterText}</div>
                </div>
                
                <div style="margin-top: 15px; font-size: 0.85em; color: #9ca3af;">
                    <strong>Panduan Ekspor Lainnya:</strong><br>
                    - <a href="https://ieeexplore.ieee.org/search/advanced/command" target="_blank" style="color: #5eead4; text-decoration: underline;">IEEE Xplore ↗</a>: Command Search > Export > CSV<br>
                    - <a href="https://pubmed.ncbi.nlm.nih.gov/advanced/" target="_blank" style="color: #5eead4; text-decoration: underline;">PubMed ↗</a>: Advanced Search > Save > Format: CSV / PubMed (NBIB)<br>
                </div>
            </div>
        `;

        let importHtml = `
            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="color: #5eead4;">M4: Import Data (Multi-Database)</h4>
                ${refHtml}
                <div style="background: rgba(234, 179, 8, 0.1); border-left: 4px solid #eab308; padding: 15px; margin-bottom: 1.5rem; border-radius: 4px;">
                    <h5 style="color: #eab308; margin-top: 0; margin-bottom: 8px;">⚠️ Peringatan Penting</h5>
                    <p style="font-size: 0.9em; margin: 0;">Mengunggah file di sini akan <strong>menghapus dan menggantikan</strong> seluruh data paper (slr_papers) yang ada di sesi ini. Pastikan Anda mengunggah <strong>SEMUA</strong> file (Scopus, IEEE, dll) sekaligus dalam satu waktu untuk menghindari hilangnya data.</p>
                </div>
                <p>Silakan unggah file hasil export Anda (mendukung format <strong>.csv</strong>, <strong>.bib</strong>, dan format <strong>PubMed .nbib/.txt</strong>). Anda dapat memilih beberapa file sekaligus.</p>
                
                <form id="form-import-csv" style="margin-top: 15px;">
                    <div style="border: 2px dashed rgba(255,255,255,0.2); border-radius: 8px; padding: 2rem; text-align: center; margin-bottom: 1rem;">
                        <input type="file" id="csv-files" multiple accept=".csv,.bib,.nbib,.txt,.bibtex" style="width: 100%; color: #d1d5db; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                    </div>
                    <button type="submit" class="btn btn-primary" id="btn-import-csv">Mulai Import & Deduplikasi</button>
                </form>
            </div>
        `;
        area.insertAdjacentHTML('beforeend', importHtml);
        
        setTimeout(() => {
            const formImport = document.getElementById('form-import-csv');
            if (formImport) {
                formImport.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const fileInput = document.getElementById('csv-files');
                    if (fileInput.files.length === 0) {
                        alert("Harap pilih setidaknya 1 file untuk diunggah!");
                        return;
                    }

                    const formData = new FormData();
                    for (let i = 0; i < fileInput.files.length; i++) {
                        formData.append('files', fileInput.files[i]);
                    }

                    try {
                        const btn = document.getElementById('btn-import-csv');
                        btn.textContent = "Mengunggah & Memproses...";
                        btn.disabled = true;
                        
                        await API.importData(session.id, formData);
                        
                        window.location.reload();
                    } catch (error) {
                        alert("Gagal mengimpor file: " + error.message);
                        const btn = document.getElementById('btn-import-csv');
                        btn.textContent = "Mulai Import & Deduplikasi";
                        btn.disabled = false;
                    }
                });
            }
        }, 100);
        return true;

    } else if (status === 'M4_STEP2_WAITING_APPROVAL' && session.data_mining_log) {
        const dedup = session.data_mining_log.dedup || {};
        const pico = session.data_mining_log.pico_preview || {};
        const audit = session.data_mining_log.quality_audit || {};
        
        html = wrapCard('Quality Audit & Deduplication Results', `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <h5 style="color: #5eead4; margin-top: 0;">Basic Quality Audit</h5>
                    <p>Total Records: ${audit.total_records || 0}</p>
                    <p>Missing Abstract: ${audit.missing_abstract || 0} 
                        ${audit.missing_abstract_sources && Object.keys(audit.missing_abstract_sources).length > 0 
                            ? `<br><span style="font-size:0.85em; color:#9ca3af;">(Sumber: ${Object.entries(audit.missing_abstract_sources).map(([k,v]) => `${k}=${v}`).join(', ')})</span>` 
                            : ''}
                    </p>
                    ${audit.missing_abstract_details && audit.missing_abstract_details.length > 0 ? `
                        <details style="margin-top: 5px; margin-bottom: 10px; background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 4px; font-size: 0.85em;">
                            <summary style="cursor: pointer; color: #fca5a5; font-weight: bold;">Lihat Rincian Artikel Tanpa Abstrak</summary>
                            <ul style="margin: 5px 0 0 0; padding-left: 20px; max-height: 150px; overflow-y: auto; color: #d1d5db;">
                                ${audit.missing_abstract_details.map(d => `<li style="margin-bottom:4px;"><em>${d.title || 'Tanpa Judul'}</em> <span style="color:#9ca3af;">[${d.database}]</span></li>`).join('')}
                            </ul>
                        </details>
                    ` : ''}
                    <p>Missing DOI: ${audit.missing_doi || 0}</p>
                    ${audit.missing_doi_details && audit.missing_doi_details.length > 0 ? `
                        <details style="margin-top: 5px; background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 4px; font-size: 0.85em;">
                            <summary style="cursor: pointer; color: #fca5a5; font-weight: bold;">Lihat Rincian Artikel Tanpa DOI</summary>
                            <ul style="margin: 5px 0 0 0; padding-left: 20px; max-height: 150px; overflow-y: auto; color: #d1d5db;">
                                ${audit.missing_doi_details.map(d => `<li style="margin-bottom:4px;"><em>${d.title || 'Tanpa Judul'}</em> <span style="color:#9ca3af;">[${d.database}]</span></li>`).join('')}
                            </ul>
                        </details>
                    ` : ''}
                </div>
                <div>
                    <h5 style="color: #5eead4; margin-top: 0;">Deduplication</h5>
                    <p>Total Unique: <span style="color: #4ade80;">${dedup.total_unique || 0}</span></p>
                    <p>Duplicates Removed: <span style="color: #fca5a5;">${dedup.total_duplicates || 0}</span> (Primary/DOI: ${dedup.primary_match || 0}, Secondary/Title: ${dedup.secondary_match || 0})</p>
                    ${dedup.per_database_total && Object.keys(dedup.per_database_total).length > 0 ? `
                    <table style="width: 100%; margin-top: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; border-collapse: collapse; font-size: 0.9em;">
                        <thead>
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <th style="padding: 8px 10px; text-align: left; color: #d1d5db;">Database</th>
                                <th style="padding: 8px 10px; text-align: center; color: #d1d5db;">Total</th>
                                <th style="padding: 8px 10px; text-align: center; color: #d1d5db;">Unik</th>
                                <th style="padding: 8px 10px; text-align: center; color: #d1d5db;">Duplikat</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.keys(dedup.per_database_total).map(db => `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <td style="padding: 6px 10px; color: #e2e8f0;">${db}</td>
                                <td style="padding: 6px 10px; text-align: center; color: #d1d5db;">${dedup.per_database_total[db] || 0}</td>
                                <td style="padding: 6px 10px; text-align: center; color: #4ade80;">${(dedup.per_database_unique && dedup.per_database_unique[db]) || 0}</td>
                                <td style="padding: 6px 10px; text-align: center; color: #fca5a5;">${(dedup.per_database_dups && dedup.per_database_dups[db]) || 0}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ` : ''}
                </div>
            </div>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
            <h5 style="color: #5eead4; margin-top: 0;">LLM PICO Preview (20 Sampel)</h5>
            <p><strong>Match Ratio:</strong> ${pico.match_counts_pct || 0}%</p>
            <p><strong>Verdict:</strong> <span style="color: ${pico.verdict?.includes('PROCEED') ? '#4ade80' : '#fca5a5'};">${pico.verdict || ''}</span></p>
            <p><strong>Recommendation:</strong> ${pico.recommendation || ''}</p>
            ${pico.samples_analyzed && pico.samples_analyzed.length > 0 ? `
                <details style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                    <summary style="cursor: pointer; color: #5eead4; font-weight: bold; margin-bottom: 10px;">Lihat Rincian Penilaian Sampel (${pico.samples_analyzed.length} Paper)</summary>
                    <div style="max-height: 300px; overflow-y: auto; padding-right: 10px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                        ${pico.samples_analyzed.map((s, i) => {
                            let color = '#d1d5db'; // default
                            if (s.classification.includes('MATCH WHAT COUNTS')) color = '#4ade80';
                            else if (s.classification.includes("DOESN'T") || s.classification.includes('DOES NOT')) color = '#fca5a5';
                            else if (s.classification.includes('AMBIGU')) color = '#fcd34d';
                            else if (s.classification.includes('OFF-TOPIC')) color = '#9ca3af';
                            
                            return `
                            <div style="margin-bottom: 15px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 10px;">
                                <div style="font-size: 0.9em; font-weight: bold; margin-bottom: 4px;">${i+1}. ${s.title}</div>
                                <div style="font-size: 0.8em; margin-bottom: 4px;"><span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: ${color};">${s.classification}</span></div>
                                <div style="font-size: 0.85em; color: #9ca3af;"><em>Alasan AI:</em> ${s.reasoning}</div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </details>
            ` : ''}
            ${session.pico_definitions ? `
                <details style="margin-top: 10px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                    <summary style="cursor: pointer; color: #5eead4; font-weight: bold; margin-bottom: 10px;">Lihat Kriteria PICO yang Berlaku</summary>
                    <div style="font-size: 0.85em; padding-right: 10px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                        ${['P', 'I', 'C', 'O'].map(k => {
                            const p = session.pico_definitions[k.toLowerCase()];
                            if (!p || !p.value) return '';
                            return `
                                <div style="margin-bottom: 10px;">
                                    <strong>${k} - ${p.value}</strong>
                                    <ul style="margin: 4px 0; padding-left: 20px; color: #d1d5db;">
                                        <li><span style="color:#4ade80;">What Counts:</span> ${p.operational_def?.what_counts || '-'}</li>
                                        <li><span style="color:#fca5a5;">What Doesn't Count:</span> ${p.operational_def?.what_doesnt_count || '-'}</li>
                                    </ul>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </details>
            ` : ''}
        `);

    } else if (status === 'M4_STEP3_WAITING_APPROVAL' && session.screening_setup) {
        const setup = session.screening_setup;
        html = wrapCard('Screening Setup Siap', `
            <p><strong>P-Canonical:</strong> ${setup.p_canonical}</p>
            <p><strong>P-What Counts:</strong> ${setup.p_what_counts}</p>
            <p><strong>Reason Codes:</strong> ${setup.reason_codes ? setup.reason_codes.join(', ') : ''}</p>
            ${session.modul4_summary ? `<hr style="border-color: rgba(255,255,255,0.1);"><p><strong>Summary Modul 4:</strong><br>${formatMarkdown(session.modul4_summary.markdown)}</p>` : ''}
        `);

    } else if (status === 'M5_STEP1_WAITING_APPROVAL' && session.screener_briefing) {
        const sb = session.screener_briefing;

        // Tampilkan banner error jika guard-rail menolak approve karena API belum siap
        let configBanner = '';
        if (session.system_error) {
            configBanner = `
                <div style="background: rgba(234, 179, 8, 0.15); padding: 15px; border-radius: 8px; border-left: 4px solid #eab308; margin-bottom: 15px;">
                    <h4 style="color: #fcd34d; margin-top: 0; margin-bottom: 8px;"><i class="fa fa-exclamation-triangle"></i> API Reviewer Belum Siap</h4>
                    <p style="color: #fef3c7; font-size: 0.9em; margin: 0;">${session.system_error}</p>
                    <div style="margin-top:10px;"><button onclick="window.openLLMDebug('${session.id}')" class="btn btn-secondary" style="padding:3px 10px;font-size:0.82em;" title="Lapor bug / lihat error LLM persis & uji coba (Reproducible Error)"><span class="ico ico-bug"></span> Lapor / Debug Bug</button></div>
                </div>
            `;
        }

        html = wrapCard('Screener Briefing Document', `
            ${configBanner}
            <p><strong>Decision:</strong> <span style="color: ${sb.decision === 'PROCEED' ? '#4ade80' : '#fca5a5'};">${sb.decision}</span></p>
            <p><strong>Validation Gap:</strong> ${sb.validation_gap}</p>
            <p><strong>Recommendation:</strong> ${sb.recommendation}</p>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
            <h5 style="color: #5eead4; margin-top: 0;">Briefing Document (Sent to Dual-Agents):</h5>
            <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; font-size: 0.85em; max-height: 200px; overflow-y: auto;">
                ${formatMarkdown(sb.briefing_doc)}
            </div>
        `);

    } else if (status === 'M5_STEP2_WAITING_APPROVAL' || status === 'M5_STEP2_WAITING_APPROVAL_ERROR') {
        const kal = session.kalibrasi_log ? session.kalibrasi_log[session.kalibrasi_log.length-1] : null;
        let info = '';
        let totalSampelTeks = "20"; // default

        // Deteksi data kalibrasi kosong (reviewer belum dikonfigurasi / semua gagal)
        if (!kal || (!kal.total_sample && !kal.agree_count && !kal.kappa)) {
            info = `
                <div style="background: rgba(234, 179, 8, 0.15); padding: 18px; border-radius: 8px; border-left: 4px solid #eab308; margin-bottom: 15px;">
                    <h4 style="color: #fcd34d; margin-top: 0; margin-bottom: 10px;">⚠️ Data Kalibrasi Kosong</h4>
                    <p style="color: #fef3c7; margin-bottom: 8px;">Tidak ada hasil kalibrasi (keputusan INCLUDE/EXCLUDE) yang tercatat dari AI Reviewer. Kemungkinan penyebab:</p>
                    <ul style="color: #fef3c7; font-size: 0.9em; padding-left: 20px; margin-bottom: 12px;">
                        <li>API Key untuk <strong>Reviewer 1</strong> dan/atau <strong>Reviewer 2</strong> belum dikonfigurasi</li>
                        <li>Semua panggilan LLM gagal karena timeout, rate limit, atau provider sedang down</li>
                        <li>Provider API dinonaktifkan (<code>is_active: false</code>) di database</li>
                    </ul>
                    <p style="color: #fef3c7; font-size: 0.9em; margin-bottom: 0;">Silakan buka <strong><span class="ico ico-settings"></span> Pengaturan</strong> → konfigurasikan API Key pada <em>Reviewer 1</em> dan <em>Reviewer 2</em>, lalu kirim instruksi revisi kosong untuk mengulangi kalibrasi.</p>
                </div>
            `;
        } else if (kal) {
            totalSampelTeks = kal.total_sample ? kal.total_sample.toString() : "20";
            info = `<p><strong>Iterasi:</strong> ${kal.iterasi}</p>
                    <p><strong>Total Sampel Dievaluasi:</strong> ${kal.total_sample || '?'} paper</p>
                    <p><strong>Sepakat (Agree):</strong> <span style="color: #4ade80;">${kal.agree_count || '?'} paper</span></p>
                    <p><strong>Tidak Sepakat (Disagree):</strong> <span style="color: #fca5a5;">${kal.disagree_count || '?'} paper</span></p>
                    <p><strong>Agreement Pct:</strong> ${kal.agreement_pct ? kal.agreement_pct.toFixed(2) : '0'}%</p>
                    <p><strong>Cohen's Kappa:</strong> <span style="color: ${kal.passed ? '#4ade80' : '#fca5a5'}; font-size: 1.2em; font-weight: bold;">${kal.kappa ? kal.kappa.toFixed(3) : '0.000'}</span></p>
                    <p><strong>Status:</strong> ${kal.passed ? 'PASSED (>= 0.60 atau Agreemnt >= 90%)' : 'FAILED'}</p>
                    
                    <details style="margin-top: 10px; background: rgba(0,0,0,0.1); padding: 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                        <summary style="cursor: pointer; color: #9ca3af; font-size: 0.85em; font-weight: bold;">Lihat Transparansi Perhitungan Matematis (XAI)</summary>
                        <div style="font-size: 0.8em; margin-top: 10px; color: #d1d5db; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div>
                                <strong style="color: #5eead4;">Matriks Keputusan:</strong><br>
                                - Keduanya INCLUDE: ${kal.both_include || 0}<br>
                                - Keduanya EXCLUDE: ${kal.both_exclude || 0}<br>
                                - R1 INC / R2 EXC: ${kal.r1_inc_r2_exc || 0}<br>
                                - R1 EXC / R2 INC: ${kal.r1_exc_r2_inc || 0}
                            </div>
                            <div>
                                <strong style="color: #5eead4;">Variabel Cohen's Kappa:</strong><br>
                                - P(o) [Observed Agreement]: ${kal.po ? kal.po.toFixed(4) : '0.0000'}<br>
                                - P(e) [Expected Agreement]: ${kal.pe ? kal.pe.toFixed(4) : '0.0000'}<br>
                                - Rumus Kappa: (P(o) - P(e)) / (1 - P(e))
                            </div>
                        </div>
                    </details>`;
        }
        
        let errorBanner = '';
        if (session.system_error) {
            errorBanner = `
            <div style="background: rgba(220, 38, 38, 0.15); padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626; margin-bottom: 20px;">
                <h4 style="color: #f87171; margin-top: 0; margin-bottom: 5px;"><i class="fa fa-exclamation-triangle"></i> System Error Interruption</h4>
                <p style="color: #fca5a5; font-size: 0.9em; margin: 0;">Proses kalibrasi dihentikan paksa karena terjadi kegagalan teknis (misal: timeout koneksi LLM, API limit). Harap periksa log di bawah ini dan coba lagi dengan mengirim ulang instruksi revisi kosong untuk men-trigger ulang.</p>
                <div style="background: rgba(0,0,0,0.3); padding: 10px; margin-top: 10px; border-radius: 4px; font-family: monospace; font-size: 0.8em; color: #ef4444; max-height: 100px; overflow-y: auto;">
                    ${session.system_error}
                </div>
                <div style="margin-top:10px;"><button onclick="window.openLLMDebug('${session.id}')" class="btn btn-secondary" style="padding:3px 10px;font-size:0.82em;" title="Lapor bug / lihat error LLM persis & uji coba (Reproducible Error)"><span class="ico ico-bug"></span> Lapor / Debug Bug</button></div>
            </div>`;
        }

        let briefingHtml = '';
        if (session.screener_briefing) {
            briefingHtml = `
            <details style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                <summary style="cursor: pointer; color: #5eead4; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span>Lihat Screener Briefing Saat Ini</span>
                    <button id="btn-download-briefing" class="btn" style="padding: 4px 10px; font-size: 0.8em; background: #6b21a8; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Download Screener Briefing Markdown">
                        <i class="fa fa-download"></i> Download .md
                    </button>
                </summary>
                <div style="font-size: 0.85em; margin-top: 10px; max-height: 250px; overflow-y: auto;">
                    ${formatMarkdown(session.screener_briefing.briefing_doc)}
                </div>
            </details>
            `;
        }

        html = wrapCard(`Hasil Kalibrasi Dual-Review (${totalSampelTeks} Sampel)`, `
            ${errorBanner}
            ${info}
            ${briefingHtml}
            <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
            <div id="disagreements-container-m5s2" style="background: rgba(239, 68, 68, 0.05); padding: 15px; border-radius: 6px; border-left: 3px solid #ef4444;">
                <em><i class="fa fa-spinner fa-spin"></i> Memuat Disagreements (Root-Cause Analysis)...</em>
            </div>
        `);

        setTimeout(async () => {
            // Attach event listener for briefing download
            const btnDownloadBriefing = document.getElementById('btn-download-briefing');
            if (btnDownloadBriefing && session.screener_briefing) {
                btnDownloadBriefing.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const blob = new Blob([session.screener_briefing.briefing_doc], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Screener_Briefing_${session.id}.md`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            }

            const container = document.getElementById('disagreements-container-m5s2');
            if (!container) return;
            try {
                const data = await API.getDisagreements(session.id);
                if (data.disagreements && data.disagreements.length > 0) {
                    let dHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h5 style="color: #fca5a5; margin: 0;">Reviewer Disagreements (${data.disagreements.length} cases)</h5>
                        <button id="btn-download-disagreements" class="btn" style="padding: 4px 10px; font-size: 0.8em; background: #b91c1c; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Download Hasil Disagreements JSON">
                            <i class="fa fa-download"></i> Download JSON
                        </button>
                    </div>`;
                    
                    data.disagreements.forEach((d, i) => {
                        dHtml += `
                        <details style="margin-bottom: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; padding: 10px;">
                            <summary style="cursor: pointer; font-weight: bold; font-size: 0.9em; color: #fcd34d;">
                                Kasus ${i+1}: ${d.Title}
                            </summary>
                            <div style="font-size: 0.85em; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                                <p style="color: #9ca3af; margin-bottom: 10px;"><strong>Abstract:</strong> ${d.Abstract}</p>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                    <div style="background: rgba(13, 148, 136, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #0d9488;">
                                        <strong style="color: #5eead4;">R1 Decision (Z-AI):</strong> ${d.Screener_1_Decision}<br>
                                        <div style="margin-top: 5px; color: #d1d5db;">${d.Screener_1_Notes}</div>
                                    </div>
                                    <div style="background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #10b981;">
                                        <strong style="color: #6ee7b7;">R2 Decision (Groq):</strong> ${d.Screener_2_Decision}<br>
                                        <div style="margin-top: 5px; color: #d1d5db;">${d.Screener_2_Notes}</div>
                                    </div>
                                </div>
                                ${d.Conflict_Resolution ? (typeof d.Conflict_Resolution === 'object' ? `
                                <div style="margin-top: 10px; background: rgba(167, 139, 250, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #5eead4;">
                                    <strong style="color: #c4b5fd;">AI Arbitrator Advice:</strong> ${d.Conflict_Resolution.advice}<br>
                                    <div style="margin-top: 5px; color: #e5e7eb;">${d.Conflict_Resolution.analysis}</div>
                                </div>
                                ` : `
                                <div style="margin-top: 10px; background: rgba(167, 139, 250, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #5eead4;">
                                    <strong style="color: #c4b5fd;">AI Supervisor:</strong><br>
                                    <div style="margin-top: 5px; color: #e5e7eb; white-space: pre-wrap;">${d.Conflict_Resolution}</div>
                                </div>
                                `) : ''}
                            </div>
                        </details>
                        `;
                    });
                    container.innerHTML = dHtml;

                    const btnDownloadDisagreements = document.getElementById('btn-download-disagreements');
                    if (btnDownloadDisagreements) {
                        btnDownloadDisagreements.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const blob = new Blob([JSON.stringify(data.disagreements, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Disagreements_Kalibrasi_${session.id}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        });
                    }

                } else {
                    container.innerHTML = `<span style="color: #4ade80;">Semua sampel sudah sepakat (Tidak ada Disagree)!</span>`;
                }
            } catch (err) {
                container.innerHTML = `<span style="color: #ef4444;">Gagal memuat disagreements: ${err.message}</span>`;
            }
        }, 0);

    } else if (status === 'M5_STEP3_WAITING_RESOLUTION') {
        const bLog = session.screening_results_log ? session.screening_results_log[session.screening_results_log.length-1] : null;
        let info = '';
        if (bLog) {
            info = `<p><strong>Batch Number:</strong> ${bLog.batch_number}</p>
                    <p><strong>Processed:</strong> ${bLog.processed_records}</p>
                    <p><strong>Disagreement Cases:</strong> <span style="color: #fca5a5;">${bLog.disagreement_cases}</span></p>
                    <p><strong>Current Kappa:</strong> ${bLog.current_kappa.toFixed(3)} ${bLog.drift_detected ? '<span style="color:#fca5a5;">(DRIFT WARNING)</span>' : ''}</p>`;
        }
        let briefingHtml = '';
        if (session.screener_briefing) {
            briefingHtml = `
            <details style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                <summary style="cursor: pointer; color: #5eead4; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa fa-file-text"></i> Lihat Screener Briefing (Kriteria xAI)</span>
                    <button id="btn-download-briefing-m5s3" class="btn" style="padding: 4px 10px; font-size: 0.8em; background: #6b21a8; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Download Screener Briefing Markdown">
                        <i class="fa fa-download"></i> Download .md
                    </button>
                </summary>
                <div style="font-size: 0.85em; margin-top: 10px; max-height: 250px; overflow-y: auto;">
                    ${formatMarkdown(session.screener_briefing.briefing_doc)}
                </div>
            </details>
            <details style="margin-top: 10px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                <summary style="cursor: pointer; color: #5eead4; font-weight: bold;">
                    <span><i class="fa fa-info-circle"></i> Cara Kerja AI Supervisor (Neuro Symbolic)</span>
                </summary>
                <div style="font-size: 0.85em; margin-top: 10px; color: #d1d5db; line-height: 1.5;">
                    <p>Dalam kerangka <strong>Neuro-Symbolic AI</strong>, AI Supervisor berfungsi murni sebagai arbitrator rasional. Ia diberikan <em>Screener Briefing</em> (aturan simbolik absolut) dan catatan dari kedua AI Screener (R1 yang liberal & R2 yang ketat). Supervisor kemudian dilatih untuk mencari akar masalah (root cause) dari konflik tersebut dan memberikan rekomendasi logis <em>(Explainable AI)</em> tanpa memiliki otoritas untuk mengambil keputusan mutlak.</p>
                    <p>Otoritas keputusan mutlak <em>(Final Decision)</em> tetap berada sepenuhnya di tangan Anda sebagai <strong>Human in the Loop (HITL)</strong> untuk memastikan kepatuhan metodologi (PRISMA).</p>
                </div>
            </details>
            `;
        }
        
        html = wrapCard('Batch Screening Selesai (HitL Resolution Required)', `
            ${info}
            ${briefingHtml}
            <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
            <div id="disagreements-container-m5s3" style="background: rgba(239, 68, 68, 0.05); padding: 15px; border-radius: 6px; border-left: 3px solid #ef4444;">
                <em><i class="fa fa-spinner fa-spin"></i> Memuat Disagreements...</em>
            </div>
            <p style="margin-top: 15px; font-size: 0.9em;"><em>Note: Silakan pilih keputusan akhir Anda dan berikan catatan resolusi pada setiap kasus di atas.</em></p>
        `);

        setTimeout(async () => {
            const container = document.getElementById('disagreements-container-m5s3');
            if (!container) return;
            try {
                const data = await API.getDisagreements(session.id);
                if (data.disagreements && data.disagreements.length > 0) {
                    let dHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h5 style="color: #fca5a5; margin: 0;">Menunggu Keputusan Anda (${data.disagreements.length} cases)</h5>
                        <div style="display: flex; gap: 8px;">
                            <button id="btn-download-m5s3-md" class="btn" style="padding: 4px 10px; font-size: 0.8em; background: #15803d; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Download daftar kasus + kriteria sebagai Markdown (untuk dinilai pihak lain)">
                                <i class="fa fa-download"></i> Download .md
                            </button>
                            <button id="btn-download-m5s3-disagreements" class="btn" style="padding: 4px 10px; font-size: 0.8em; background: #b91c1c; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Download Hasil Disagreements JSON">
                                <i class="fa fa-download"></i> Download JSON
                            </button>
                        </div>
                    </div>`;
                    data.disagreements.forEach((d, i) => {
                        const pid = typeof d._id === 'object' ? (d._id.$oid || d._id) : d._id;
                        dHtml += `
                        <details style="margin-bottom: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; padding: 10px;">
                            <summary style="cursor: pointer; font-weight: bold; font-size: 0.9em; color: #fcd34d;">
                                Kasus ${i+1}: ${d.Title}
                            </summary>
                            <div style="font-size: 0.85em; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                                <p style="color: #9ca3af; margin-bottom: 10px;"><strong>Abstract:</strong> ${d.Abstract}</p>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                    <div style="background: rgba(13, 148, 136, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #0d9488;">
                                        <strong style="color: #5eead4;">R1 Decision:</strong> ${d.Screener_1_Decision}<br>
                                        <div style="margin-top: 5px; color: #d1d5db;">${d.Screener_1_Notes}</div>
                                    </div>
                                    <div style="background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #10b981;">
                                        <strong style="color: #6ee7b7;">R2 Decision:</strong> ${d.Screener_2_Decision}<br>
                                        <div style="margin-top: 5px; color: #d1d5db;">${d.Screener_2_Notes}</div>
                                    </div>
                                </div>
                                ${d.Conflict_Resolution ? (typeof d.Conflict_Resolution === 'object' ? `
                                <div style="margin-top: 10px; background: rgba(167, 139, 250, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #5eead4;">
                                    <strong style="color: #c4b5fd;">AI Arbitrator Advice:</strong> ${d.Conflict_Resolution.advice}<br>
                                    <div style="margin-top: 5px; color: #e5e7eb;">${d.Conflict_Resolution.analysis}</div>
                                </div>
                                ` : `
                                <div style="margin-top: 10px; background: rgba(167, 139, 250, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #5eead4;">
                                    <strong style="color: #c4b5fd;">AI Supervisor:</strong><br>
                                    <div style="margin-top: 5px; color: #e5e7eb; white-space: pre-wrap;">${d.Conflict_Resolution}</div>
                                </div>
                                `) : ''}
                                
                                <div class="conflict-resolution-form" data-paperid="${pid}" style="margin-top: 15px; padding: 15px; background: rgba(0,0,0,0.5); border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);">
                                    <h6 style="color: #5eead4; margin-top: 0; margin-bottom: 10px;">Resolusi Anda (HitL)</h6>
                                    <div style="display: flex; gap: 15px; margin-bottom: 10px;">
                                        <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;">
                                            <input type="radio" name="fd_${pid}" value="INCLUDE"> <strong style="color:#4ade80">INCLUDE</strong>
                                        </label>
                                        <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;">
                                            <input type="radio" name="fd_${pid}" value="EXCLUDE"> <strong style="color:#fca5a5">EXCLUDE</strong>
                                        </label>
                                    </div>
                                    <textarea class="cr-notes" placeholder="Tuliskan catatan/alasan keputusan akhir Anda di sini..." style="width: 100%; padding: 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.1); resize: vertical; min-height: 60px;"></textarea>
                                </div>
                            </div>
                        </details>
                        `;
                    });
                    container.innerHTML = dHtml;

                    // Build a self-contained Markdown of all pending cases + the screening
                    // criteria, so a third party can review and advise using only this file.
                    const buildM5ResolutionMarkdown = (sess, cases) => {
                        const v = (o, ...keys) => {
                            for (const k of keys) {
                                if (o && o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== '') return o[k];
                            }
                            return '';
                        };
                        const L = [];
                        L.push(`# Resolusi Skrining Title/Abstract — Sesi ${sess.id}`, '');
                        L.push(`Total kasus menunggu keputusan: **${cases.length}**`, '');
                        L.push('Tahap: Modul 5 (Title/Abstract Screening). Untuk SETIAP kasus, tentukan **INCLUDE** atau **EXCLUDE** beserta alasan singkat pada bagian "Rekomendasi penilai".', '');
                        L.push('> R1 = reviewer liberal, R2 = reviewer ketat. "AI Arbitrator" hanya memberi saran, bukan keputusan akhir (keputusan tetap di tangan penilai manusia / PRISMA HITL).', '');
                        if (sess.screener_briefing && sess.screener_briefing.briefing_doc) {
                            L.push('## Kriteria Skrining (acuan keputusan)', '');
                            L.push(String(sess.screener_briefing.briefing_doc).trim(), '');
                        }
                        L.push('---', '');
                        cases.forEach((d, i) => {
                            L.push(`## Kasus ${i + 1}: ${v(d, 'Title', 'title') || '(tanpa judul)'}`, '');
                            const authors = v(d, 'Authors', 'authors'), year = v(d, 'Year', 'year');
                            const journal = v(d, 'Journal', 'journal'), doi = v(d, 'DOI', 'doi');
                            if (authors) L.push(`- Penulis: ${authors}`);
                            if (year) L.push(`- Tahun: ${year}`);
                            if (journal) L.push(`- Jurnal: ${journal}`);
                            if (doi) L.push(`- DOI: ${doi}`);
                            L.push('', '**Abstract:**', '', String(v(d, 'Abstract', 'abstract') || '(tidak tersedia)').trim(), '');
                            const r1rc = v(d, 'Screener_1_Reason_Code');
                            L.push(`**Reviewer 1 (R1): ${v(d, 'Screener_1_Decision') || 'UNCERTAIN'}${r1rc ? ' — ' + r1rc : ''}**`);
                            const n1 = v(d, 'Screener_1_Notes'); if (n1) L.push('', String(n1).trim());
                            L.push('');
                            const r2rc = v(d, 'Screener_2_Reason_Code');
                            L.push(`**Reviewer 2 (R2): ${v(d, 'Screener_2_Decision') || 'UNCERTAIN'}${r2rc ? ' — ' + r2rc : ''}**`);
                            const n2 = v(d, 'Screener_2_Notes'); if (n2) L.push('', String(n2).trim());
                            L.push('');
                            const cr = d.Conflict_Resolution;
                            if (cr) {
                                if (typeof cr === 'object') {
                                    L.push(`**Saran AI Arbitrator:** ${cr.advice || ''}`);
                                    if (cr.analysis) L.push('', String(cr.analysis).trim());
                                } else {
                                    L.push('**Saran AI Arbitrator:**', '', String(cr).trim());
                                }
                                L.push('');
                            }
                            L.push('**Rekomendasi penilai (pilih satu): INCLUDE / EXCLUDE**', '', '**Alasan:**', '', '---', '');
                        });
                        return L.join('\n');
                    };

                    const downloadText = (text, filename, mime) => {
                        const blob = new Blob([text], { type: mime });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    };

                    // Attach event listener for briefing download if it exists
                    setTimeout(() => {
                        const btnDownloadBriefing = document.getElementById('btn-download-briefing-m5s3');
                        if (btnDownloadBriefing && session.screener_briefing) {
                            btnDownloadBriefing.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const blob = new Blob([session.screener_briefing.briefing_doc], { type: 'text/markdown' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Screener_Briefing_${session.id}.md`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            });
                        }

                        const btnDownloadM5S3Md = document.getElementById('btn-download-m5s3-md');
                        if (btnDownloadM5S3Md) {
                            btnDownloadM5S3Md.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const md = buildM5ResolutionMarkdown(session, data.disagreements);
                                downloadText(md, `Resolusi_Skrining_${session.id}.md`, 'text/markdown');
                            });
                        }

                        const btnDownloadM5S3 = document.getElementById('btn-download-m5s3-disagreements');
                        if (btnDownloadM5S3) {
                            btnDownloadM5S3.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                downloadText(JSON.stringify(data.disagreements, null, 2), `Menunggu_Keputusan_${session.id}.json`, 'application/json');
                            });
                        }
                    }, 100);
                } else {
                    container.innerHTML = `<span style="color: #4ade80;">Tidak ada konflik tersisa untuk diresolusi di batch ini.</span>`;
                }
            } catch (err) {
                container.innerHTML = `<span style="color: #ef4444;">Gagal memuat disagreements: ${err.message}</span>`;
            }
        }, 0);

    } else if (status === 'M5_STEP4_WAITING_APPROVAL' || status === 'M5_DONE') {
        let summaryMd = 'Menunggu data...';
        if (session.modul5_summary && session.modul5_summary.markdown) {
            summaryMd = session.modul5_summary.markdown;
        }

        // PICO-consistency audit correction panel: papers flagged as false-INCLUDE that
        // still await a decision. Module 5 cannot close until all are resolved.
        const slipped = (session.pico_audit_log && session.pico_audit_log.slipped) || [];
        const pendingSlip = slipped.filter(s => !s.actioned);
        let auditPanel = '';
        if (pendingSlip.length > 0) {
            let items = '';
            pendingSlip.forEach((s, i) => {
                // xAI provenance: every signal that flagged this paper (rule/LLM + evidence).
                const flags = Array.isArray(s.flags) ? s.flags : [];
                const srcLabel = (src) => ({
                    'rule:reviewer-exclude': '⚖ Aturan: reviewer EXCLUDE',
                    'rule:strict-exclude': '⚖ Aturan: interpretasi STRICT EXCLUDE',
                    'rule:keyword': '🔤 Aturan: kata-pemicu eksklusi',
                    'llm-audit': '🧠 LLM audit'
                }[src] || src);
                const flagsHtml = flags.length
                    ? `<ul style="margin:6px 0 8px 0; padding-left:18px; font-size:0.82em; color:#d6d3d1;">` +
                        flags.map(f => `<li><strong style="color:#fcd34d;">${srcLabel(f.source)}:</strong> ${f.detail || ''}</li>`).join('') +
                      `</ul>`
                    : `<div style="font-size:0.85em; color:#d6d3d1; margin:6px 0;">Alasan audit: ${s.reason || ''}</div>`;
                items += `
                <div class="pico-audit-form" data-paperid="${s.paper_id}" style="margin-bottom:10px; padding:12px; background:rgba(0,0,0,0.4); border-radius:4px; border:1px solid rgba(239,68,68,0.4);">
                    <div style="font-weight:bold; color:#fcd34d; font-size:0.9em;">${i + 1}. [${s.reason_code || '?'}] ${s.title || '(tanpa judul)'}</div>
                    <div style="font-size:0.78em; color:#a8a29e; margin:4px 0;">Ditandai oleh ${flags.length || 1} sinyal (xAI):</div>
                    ${flagsHtml}
                    <div style="display:flex; gap:15px; margin-bottom:8px; flex-wrap:wrap;">
                        <label style="cursor:pointer;"><input type="radio" name="pa_${s.paper_id}" value="EXCLUDE"> <strong style="color:#fca5a5">EXCLUDE (terima audit)</strong></label>
                        <label style="cursor:pointer;"><input type="radio" name="pa_${s.paper_id}" value="KEEP"> <strong style="color:#4ade80">KEEP INCLUDE (tolak audit)</strong></label>
                    </div>
                    <textarea class="pa-note" placeholder="Catatan/justifikasi (WAJIB bila KEEP)..." style="width:100%; padding:8px; border-radius:4px; background:rgba(255,255,255,0.05); color:white; border:1px solid rgba(255,255,255,0.1); resize:vertical; min-height:48px;"></textarea>
                </div>`;
            });
            auditPanel = `
            <div style="background:rgba(239,68,68,0.08); padding:15px; border-radius:6px; border-left:3px solid #ef4444; margin-bottom:15px;">
                <h5 style="color:#fca5a5; margin:0 0 8px 0;">⚠ Koreksi PICO Audit — ${pendingSlip.length} paper kemungkinan salah-INCLUDE</h5>
                <p style="font-size:0.85em; color:#d6d3d1; margin:0 0 12px 0;">Audit konsistensi PICO (cakupan ${(session.pico_audit_log && session.pico_audit_log.coverage) || 'penuh'}) menandai paper berikut sebagai kemungkinan salah-INCLUDE. <strong>Modul 5 tidak dapat ditutup sampai semua diputuskan.</strong> EXCLUDE = terima audit (paper dikeluarkan); KEEP = pertahankan INCLUDE dengan justifikasi.</p>
                ${items}
                <button id="btn-pico-audit-save" class="btn btn-success" style="margin-top:6px;"><span class="ico ico-save"></span> Simpan Koreksi Audit & Hitung Ulang</button>
            </div>`;
        }

        // HITL: revisi aturan scope PICO (klarifikasi batas) lalu audit ulang konsisten.
        const scopeEditor = `
            <details style="margin-bottom:15px; background:rgba(13, 148, 136,0.06); padding:12px; border-radius:6px; border-left:3px solid #0d9488;">
                <summary style="cursor:pointer; color:#5eead4; font-weight:bold;"><span class="ico ico-settings"></span> Revisi Aturan Scope PICO (untuk audit konsisten)</summary>
                <p style="font-size:0.83em; color:#d6d3d1; margin:8px 0;">Tulis klarifikasi batas kriteria yang akan diterapkan SERAGAM ke seluruh paper saat audit ulang (mis. "Klasifikasi penyakit klinis dari sinyal otak DIHITUNG sebagai decoding"; "Denoising/super-resolution/harmonisasi DIKECUALIKAN"). Aturan ini milik sesi Anda — sistem tidak meng-hardcode kriteria apa pun.</p>
                <textarea id="audit-scope-rules" placeholder="Satu aturan per baris..." style="width:100%; min-height:90px; padding:8px; border-radius:4px; background:rgba(255,255,255,0.05); color:white; border:1px solid rgba(255,255,255,0.1); resize:vertical;">${(session.audit_scope_rules || '').replace(/</g, '&lt;')}</textarea>
                <button id="btn-audit-scope-save" class="btn btn-primary" style="margin-top:8px;"><span class="ico ico-save"></span> Simpan Aturan & Audit Ulang Konsisten</button>
            </details>`;

        html = wrapCard('Screening Selesai (Modul 5 Summary)', `
            ${auditPanel}
            ${scopeEditor}
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; font-size: 0.9em; max-height: 400px; overflow-y: auto;">
                ${formatMarkdown(summaryMd)}
            </div>
            ${pendingSlip.length === 0 ? `<p style="margin-top: 15px; font-size: 0.9em; color: #4ade80;">
                <em>Semua paper telah diproses melalui kriteria Inklusi/Eksklusi dan lolos audit konsistensi PICO. Tahap Modul 5 selesai. Silakan lanjut ke Modul 6 untuk mencari Full-Text PDF.</em>
            </p>` : ''}
        `);

        setTimeout(() => {
            const btnScope = document.getElementById('btn-audit-scope-save');
            if (btnScope) {
                btnScope.addEventListener('click', async () => {
                    const rules = (document.getElementById('audit-scope-rules')?.value || '').trim();
                    const cov = (session.pico_audit_log && session.pico_audit_log.coverage) ? ` (cakupan ${session.pico_audit_log.coverage})` : '';
                    if (!confirm(`Aturan scope ini akan diterapkan SERAGAM ke seluruh paper INCLUDE${cov} dan menjalankan audit ulang (memakai LLM). Lanjutkan?`)) return;
                    try {
                        btnScope.disabled = true;
                        btnScope.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Menyimpan & audit ulang...';
                        await API.saveAuditScope(session.id, rules);
                        window.location.reload();
                    } catch (err) {
                        alert('Gagal menyimpan aturan scope: ' + err.message);
                        btnScope.disabled = false;
                        btnScope.innerHTML = '<span class="ico ico-save"></span> Simpan Aturan & Audit Ulang Konsisten';
                    }
                });
            }
        }, 0);

        if (pendingSlip.length > 0) {
            setTimeout(() => {
                const btn = document.getElementById('btn-pico-audit-save');
                if (!btn) return;
                btn.addEventListener('click', async () => {
                    const forms = document.querySelectorAll('.pico-audit-form');
                    const resolutions = [];
                    for (const f of forms) {
                        const pid = f.getAttribute('data-paperid');
                        const rb = f.querySelector(`input[name="pa_${pid}"]:checked`);
                        const note = (f.querySelector('.pa-note').value || '').trim();
                        if (!rb) { alert('Pilih EXCLUDE atau KEEP untuk SEMUA paper audit.'); return; }
                        if (rb.value === 'KEEP' && !note) { alert('Justifikasi WAJIB diisi untuk paper yang dipertahankan (KEEP).'); return; }
                        resolutions.push({ paper_id: pid, decision: rb.value, note });
                    }
                    try {
                        btn.disabled = true;
                        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Menyimpan & menghitung ulang...';
                        await API.resolvePICOAudit(session.id, { resolutions });
                        window.location.reload();
                    } catch (err) {
                        alert('Gagal menyimpan koreksi audit: ' + err.message);
                        btn.disabled = false;
                        btn.innerHTML = '<span class="ico ico-save"></span> Simpan Koreksi Audit & Hitung Ulang';
                    }
                });
            }, 0);
        }

    } else if (status === 'M6_STEP2_WAITING_RESOLUTION') {
        const lastLog = session.fulltext_screening_log ? session.fulltext_screening_log[session.fulltext_screening_log.length - 1] : null;
        const kappaInfo = lastLog
            ? `Batch ${lastLog.batch_number} | Kappa: <strong style="color:${lastLog.current_kappa >= 0.6 ? '#4ade80' : '#fca5a5'}">${(lastLog.current_kappa || 0).toFixed(3)}</strong> | Disagreements: ${lastLog.disagreement_cases}`
            : 'Memuat ringkasan batch...';
        html = wrapCard('Full-Text Screening — Resolusi Konflik (Modul 6 L2)', `
            <p style="font-size:0.9em;color:#d6d3d1;margin-top:0;">${kappaInfo}</p>
            <p style="font-size:0.85em;color:#a8a29e;">Putuskan kasus DISAGREE / UNCERTAIN / pending-RAG di bawah lalu klik <strong>Simpan Resolusi</strong>. Atau klik <strong>Setuju & Lanjut</strong> untuk memproses batch berikutnya / menyelesaikan tahap.</p>
            <div id="ft-disagreements" style="background: rgba(239,68,68,0.05); padding: 12px; border-radius:6px; border-left:3px solid #ef4444; margin-top:10px;">
                <em><i class="fa fa-spinner fa-spin"></i> Memuat kasus konflik full-text...</em>
            </div>
            <button id="btn-ft-resolve" class="btn btn-success" style="margin-top:12px; display:none;"><span class="ico ico-save"></span> Simpan Resolusi Full-text</button>
        `);
        setTimeout(async () => {
            const cont = document.getElementById('ft-disagreements');
            if (!cont) return;
            try {
                const data = await API.getDisagreements(session.id, 'fulltext');
                const cases = data.disagreements || [];
                if (cases.length === 0) {
                    cont.innerHTML = '<span style="color:#4ade80;">✅ Tidak ada konflik tersisa. Klik "Setuju & Lanjut".</span>';
                    return;
                }
                let formHtml = `<h5 style="color:#fca5a5;margin:0 0 10px;">${cases.length} kasus butuh keputusan akhir</h5>`;
                cases.forEach((p) => {
                    const pid = (p._id && p._id.$oid) ? p._id.$oid : (p._id || p.id);
                    const title = p.Title || p.title || '(tanpa judul)';
                    const cr = p.Conflict_Resolution_Full || '';
                    const r1 = p.Screener_1_Decision_Full || '-';
                    const r2 = p.Screener_2_Decision_Full || '-';
                    const rc1 = p.Screener_1_Reason_Code_Full || '-';
                    const rc2 = p.Screener_2_Reason_Code_Full || '-';
                    const n1 = p.Screener_1_Notes_Full || '(tidak ada catatan)';
                    const n2 = p.Screener_2_Notes_Full || '(tidak ada catatan)';
                    
                    let crHtml = '';
                    if (cr) {
                        crHtml = `
                        <div style="margin-top: 10px; background: rgba(167, 139, 250, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #5eead4;">
                            <strong style="color: #c4b5fd;">AI Supervisor:</strong><br>
                            <div style="margin-top: 5px; color: #e5e7eb; white-space: pre-wrap; font-size: 0.9em;">${cr}</div>
                        </div>`;
                    }

                    formHtml += `
                    <div class="ft-res-form" data-pid="${pid}" style="background:rgba(0,0,0,0.2);padding:15px;border-radius:6px;margin-bottom:15px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:0.95em;margin-bottom:10px;color:#fcd34d;"><strong>${title}</strong></div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85em;">
                            <div style="background: rgba(13, 148, 136, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #0d9488;">
                                <strong style="color: #5eead4;">R1 Decision:</strong> ${r1} <span style="color:#a8a29e">(Reason: ${rc1})</span><br>
                                <div style="margin-top: 5px; color: #d1d5db; white-space: pre-wrap;">${n1}</div>
                            </div>
                            <div style="background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #10b981;">
                                <strong style="color: #6ee7b7;">R2 Decision:</strong> ${r2} <span style="color:#a8a29e">(Reason: ${rc2})</span><br>
                                <div style="margin-top: 5px; color: #d1d5db; white-space: pre-wrap;">${n2}</div>
                            </div>
                        </div>
                        
                        ${crHtml}

                        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1);">
                            <strong style="font-size:0.85em; color:#a8a29e;">Keputusan Anda (HitL):</strong><br>
                            <label style="margin-right:15px; cursor:pointer;"><input type="radio" name="ftfd_${pid}" value="INCLUDE"> <span style="color:#4ade80;font-weight:bold;">INCLUDE</span></label>
                            <label style="cursor:pointer;"><input type="radio" name="ftfd_${pid}" value="EXCLUDE"> <span style="color:#fca5a5;font-weight:bold;">EXCLUDE</span></label>
                            <textarea class="ft-notes" rows="2" placeholder="Catatan resolusi..." style="width:100%;margin-top:8px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;padding:8px;font-family:inherit;"></textarea>
                        </div>
                    </div>`;
                });
                cont.innerHTML = formHtml;
                const btn = document.getElementById('btn-ft-resolve');
                if (btn) {
                    btn.style.display = 'inline-block';
                    btn.addEventListener('click', async () => {
                        const forms = document.querySelectorAll('.ft-res-form');
                        const resolutions = [];
                        for (const f of forms) {
                            const pid = f.getAttribute('data-pid');
                            const rb = f.querySelector(`input[name="ftfd_${pid}"]:checked`);
                            const ta = f.querySelector('.ft-notes');
                            if (!rb) { alert('Pilih INCLUDE/EXCLUDE untuk semua kasus!'); return; }
                            resolutions.push({ paper_id: pid, final_decision: rb.value, conflict_resolution: (ta.value || '').trim() });
                        }
                        try {
                            btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Menyimpan...';
                            await API.resolveConflicts(session.id, { stage: 'fulltext', resolutions });
                            window.location.reload();
                        } catch (err) { alert('Gagal: ' + err.message); btn.disabled = false; btn.innerHTML = '<span class="ico ico-save"></span> Simpan Resolusi Full-text'; }
                    });
                }
            } catch (e) {
                cont.innerHTML = '<span style="color:#ef4444;">Gagal memuat: ' + e.message + '</span>';
            }
        }, 0);

    } else if (status.endsWith('_WAITING_EMBED')) {
        // Gerbang embed dipakai di M6 (screening full-text) DAN M9 (penulisan manuskrip pakai
        // RAG bukti/sitasi). Konteks judul & alasan menyesuaikan modul agar tak membingungkan.
        const isM9 = status.startsWith('M9');
        const reason = session.embed_error || 'Endpoint embedding (BGE-M3) tidak aktif.';
        const gateTitle = isM9
            ? '⏸️ Penulisan Manuskrip Dijeda — Endpoint Embedding Mati (Modul 9)'
            : '⏸️ Screening Dijeda — Endpoint Embedding Mati (Modul 6 L2)';
        const gateWhy = isM9
            ? 'Penulisan manuskrip memakai <strong>RAG</strong> (top-k semantik) untuk menarik bukti & sitasi dari full-text. Tanpa embedding, penulisan <strong>tidak</strong> dilanjutkan agar klaim tetap tertaut bukti — bukan diam-diam degrade.'
            : 'Screening <strong>tidak</strong> dilanjutkan tanpa embedding (top-k semantik) agar kualitas tetap terjaga — bukan diam-diam degrade.';
        html = wrapCard(gateTitle, `
            <div style="background: rgba(239,68,68,0.08); padding: 14px; border-radius:6px; border-left:3px solid #ef4444;">
                <p style="margin:0 0 6px;color:#fca5a5;"><strong>Penyebab:</strong> ${reason}</p>
                <p style="margin:0;font-size:0.88em;color:#d6d3d1;">${gateWhy}</p>
            </div>
            <div style="margin-top:12px;">
                <a href="https://colab.research.google.com/github/ifcoid/pede/blob/main/notebooks/embed_server_colab.ipynb" target="_blank" rel="noopener"
                   style="display:inline-block;background:#f9ab00;color:#1a1a1a;font-weight:bold;padding:8px 14px;border-radius:6px;text-decoration:none;">
                    ▶ Buka Notebook di Google Colab
                </a>
                <a href="https://raw.githubusercontent.com/ifcoid/pede/main/notebooks/embed_server_colab.ipynb" target="_blank" rel="noopener"
                   style="margin-left:10px;color:#a8a29e;font-size:0.85em;">unduh .ipynb</a>
            </div>
            <ol style="font-size:0.88em;color:#d6d3d1;margin-top:12px;padding-left:18px;">
                <li>Klik tombol di atas (bisa di <strong>Chrome Android</strong> juga) → Runtime GPU → <strong>Run all</strong>.</li>
                <li>Salin <code>EMBED_ENDPOINT</code>, <code>EMBED_API_KEY</code> dari output sel terakhir.</li>
                <li>Tempel di bawah → <strong>Simpan Endpoint & Lanjut</strong>.</li>
            </ol>
            <div style="display:grid;gap:8px;margin-top:8px;max-width:560px;">
                <input id="embed-endpoint" class="input" placeholder="EMBED_ENDPOINT (mis. https://xxxx.trycloudflare.com/v1)" style="padding:8px;border-radius:6px;width:100%;" />
                <input id="embed-key" class="input" placeholder="EMBED_API_KEY (kosongkan = pertahankan yang lama)" style="padding:8px;border-radius:6px;width:100%;" />
                <input id="embed-model" class="input" placeholder="EMBED_MODEL (default BAAI/bge-m3)" style="padding:8px;border-radius:6px;width:100%;" />
                <span id="embed-msg" style="font-size:0.82em;color:#a8a29e;"></span>
            </div>
            <p style="font-size:0.8em;color:#a8a29e;margin-top:10px;">
                <em>Catatan Colab: endpoint dipakai sebentar saja di <strong>awal tiap batch</strong>. Sesi Colab gratis putus ~90 menit idle / maks ~12 jam — jaga tetap hidup saat screening, atau restart lalu masukkan endpoint baru saat dijeda lagi.</em>
            </p>
        `);

    } else if (status === 'M6_STEP3_WAITING_APPROVAL') {
        const summaryMd = (session.modul6_summary && session.modul6_summary.markdown) || 'Menunggu data...';
        const inacc = (session.inaccessible_impact && session.inaccessible_impact.markdown) || '';
        const ready = (session.extraction_readiness && session.extraction_readiness.markdown) || '';
        html = wrapCard('Modul 6 Selesai — Full-Text Screening Summary', `
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; font-size: 0.9em; max-height: 360px; overflow-y: auto;">
                ${formatMarkdown(summaryMd)}
            </div>
            ${ready ? `<details style="margin-top:12px;"><summary style="cursor:pointer;color:#6ee7b7;font-weight:bold;">Extraction Readiness Checklist</summary><div style="font-size:0.88em;margin-top:8px;">${formatMarkdown(ready)}</div></details>` : ''}
            ${inacc ? `<details style="margin-top:8px;"><summary style="cursor:pointer;color:#fca5a5;font-weight:bold;">Inaccessible Impact</summary><div style="font-size:0.88em;margin-top:8px;">${formatMarkdown(inacc)}</div></details>` : ''}
            <details id="recode-panel" style="margin-top:8px;">
                <summary style="cursor:pointer;color:#fcd34d;font-weight:bold;"><span class="ico ico-copy"></span> Re-code Alasan Eksklusi (rapikan tabel PRISMA)</summary>
                <div style="font-size:0.85em;margin-top:8px;">
                    <p style="color:#d6d3d1;margin:0 0 8px 0;">Ganti kode kabur (mis. "OTHER") ke kode spesifik berdasar bukti tiap paper. Menyimpan akan <strong>menyusun ulang</strong> ringkasan Modul 6 dengan kode baru.</p>
                    <button id="btn-load-recode" class="btn" style="background:#6366f1;color:#fff;">Muat Daftar Eksklusi</button>
                    <div id="recode-container" style="margin-top:10px;"></div>
                </div>
            </details>
            <p style="margin-top: 12px; font-size: 0.9em; color:#4ade80;"><em>Setujui untuk menutup Modul 6 dan lanjut ke Modul 7 (Data Extraction).</em></p>
        `);

    } else if (status === 'M7_STEP1_WAITING_APPROVAL' && session.framework_selection) {
        const fw = session.framework_selection;
        // HITL: kolom framework editable langsung (tambah/hapus/edit) — bukan menebak
        // lewat feedback ke LLM. Tambah kolom delta TERPISAH (delta_accuracy/delta_itr)
        // untuk nilai peningkatan agar tidak tercampur metrik absolut.
        const escAttr = (v) => String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const inputCell = (cls, val, ph, color) => `<td style="padding:4px;"><input class="${cls}" value="${escAttr(val)}" placeholder="${ph}" style="width:100%;padding:5px;border-radius:4px;background:rgba(255,255,255,0.05);color:${color};border:1px solid rgba(255,255,255,0.1);"></td>`;
        const rowHtml = (c) => `<tr class="fw-col-row">${inputCell('fw-col-key', c.key, 'key', 'white')}${inputCell('fw-col-cat', c.category, 'Output', '#5eead4')}${inputCell('fw-col-desc', c.desc, 'deskripsi', '#d6d3d1')}<td style="padding:4px;"><button type="button" class="fw-col-del btn btn-danger" style="padding:4px 9px;"><span class="ico ico-close"></span> </button></td></tr>`;
        const rows = (fw.columns || []).map(rowHtml).join('');
        html = wrapCard('Modul 7 L1 — Framework & Template Ekstraksi', `
            <p><strong>Framework:</strong> <span style="color:#6ee7b7;">${fw.framework}</span></p>
            ${fw.system_prompt ? `
            <details style="margin-bottom:15px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">
                <summary style="cursor:pointer; color:#5eead4; font-weight:bold; font-size: 0.85em;"><span class="ico ico-search"></span> xAI: Lihat Prompt Dibalik Keputusan Ini</summary>
                <div style="margin-top:10px; font-size:0.8em; color:#d6d3d1; max-height: 250px; overflow-y: auto;">
                    ${fw.model_used ? `<p style="color:#fcd34d; margin-bottom:5px;"><strong><span class="ico ico-ai"></span> LLM Model:</strong> ${fw.model_used}</p>` : ''}
                    <strong>System Prompt (Instruksi Agent):</strong><br>
                    <pre style="white-space: pre-wrap; font-family: monospace; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; margin-top: 5px; margin-bottom: 10px;">${(fw.system_prompt || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                    <strong>User Prompt (Konteks Riset Anda):</strong><br>
                    <pre style="white-space: pre-wrap; font-family: monospace; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; margin-top: 5px;">${(fw.user_prompt || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                </div>
            </details>
            ` : ''}
            <p style="font-size:0.9em;color:#d6d3d1;">${fw.justification || ''}</p>
            <p style="font-size:0.82em;color:#fcd34d;margin-top:10px;">✎ Kolom bisa diedit langsung (HITL). Untuk nilai peningkatan, buat kolom delta TERPISAH (mis. <code>delta_accuracy</code>, <code>delta_itr</code>) agar tak tercampur metrik absolut. Klik <strong>Simpan Kolom</strong>, lalu <strong>Setuju</strong> untuk mulai ekstraksi.</p>
            <table style="width:100%;border-collapse:collapse;font-size:0.85em;margin-top:8px;">
                <tr><th style="text-align:left;padding:6px;color:#9ca3af;">Kolom (key)</th><th style="text-align:left;padding:6px;color:#9ca3af;">Kat.</th><th style="text-align:left;padding:6px;color:#9ca3af;">Deskripsi</th><th style="width:36px;"></th></tr>
                <tbody id="fw-cols-body">${rows}</tbody>
            </table>
            <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" id="btn-fw-add-col" class="btn btn-secondary" style="padding:5px 10px;"><span class="ico ico-plus"></span> Tambah Kolom</button>
                <button type="button" id="btn-fw-save-cols" class="btn btn-primary" style="padding:5px 10px;"><span class="ico ico-save"></span> Simpan Kolom</button>
                <button type="button" onclick="window.openScreeningCorrection('${session.id}')" class="btn" style="padding:5px 10px;background:rgba(245,158,11,0.18);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);" title="Koreksi keputusan include/exclude tanpa mengubah protokol ekstraksi"><span class="ico ico-back"></span> Koreksi Include/Exclude</button>
            </div>
            <p style="font-size:0.78em;color:#a8a29e;margin:6px 0 0;">Merasa paper kurang/keliru? "Koreksi Include/Exclude" memperbaiki keputusan full-text <strong>tanpa mengubah protokol</strong> (paper baru diekstrak inkremental). Untuk menyusun ULANG protokol dari awal, pakai "Drop/Reset Modul 7" (amendemen — re-ekstrak semua).</p>
        `);

        setTimeout(() => {
            const body = document.getElementById('fw-cols-body');
            if (!body) return;
            const addBtn = document.getElementById('btn-fw-add-col');
            const saveBtn = document.getElementById('btn-fw-save-cols');
            if (addBtn) addBtn.addEventListener('click', () => {
                body.insertAdjacentHTML('beforeend', rowHtml({ key: '', category: 'Output', desc: '' }));
                body.querySelector('tr.fw-col-row:last-child .fw-col-key')?.focus();
            });
            body.addEventListener('click', (e) => {
                if (e.target.classList.contains('fw-col-del')) e.target.closest('tr')?.remove();
            });
            if (saveBtn) saveBtn.addEventListener('click', async () => {
                const cols = [];
                body.querySelectorAll('tr.fw-col-row').forEach((tr) => {
                    const key = (tr.querySelector('.fw-col-key')?.value || '').trim();
                    if (!key) return;
                    cols.push({
                        key,
                        category: (tr.querySelector('.fw-col-cat')?.value || '').trim(),
                        desc: (tr.querySelector('.fw-col-desc')?.value || '').trim(),
                    });
                });
                if (cols.length === 0) { showToast('Minimal satu kolom dengan key terisi.', 'error'); return; }
                try {
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = '<span class="ico ico-save"></span> Menyimpan...';
                    await API.saveFrameworkColumns(session.id, cols);
                    showToast(`✅ ${cols.length} kolom tersimpan. Klik Setuju untuk mulai ekstraksi.`);
                } catch (err) {
                    showToast('Gagal menyimpan kolom: ' + err.message, 'error');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<span class="ico ico-save"></span> Simpan Kolom';
                }
            });
        }, 0);

    } else if (status === 'M7_STEP2_VERIFY_BLOCKED') {
        // Gerbang HITL: pipeline DIJEDA karena provider Reviewer 2 (QA silang) tak bisa dipakai.
        // Tampilkan error PENUH + langkah perbaikan, beri user waktu mengganti provider, lalu
        // 'Ulangi Verifikasi'. (Ekstraksi sudah tersimpan & aman — tidak hilang.)
        const l = session.extraction_log || {};
        const detail = (session.system_error || l.verifier_error || 'Provider Reviewer 2 tidak bisa dihubungi (mungkin 404 model salah / 401 API key / 429 kuota).');
        const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html = wrapCard('⛔ Pipeline Dijeda — QA Reviewer 2 Perlu Diperbaiki', `
            <div style="padding:14px 16px;background:rgba(239,68,68,0.12);border-left:4px solid #ef4444;border-radius:8px;color:#fca5a5;margin-bottom:14px;">
                <strong style="font-size:1.05em;">QA silang (Reviewer 2) tidak bisa dijalankan.</strong>
                <p style="margin:8px 0 0;color:#fecaca;">Pipeline sengaja <strong>berhenti di sini</strong> agar Anda sempat memperbaiki provider sebelum lanjut. Data ekstraksi <strong>${l.total_extracted || 0} paper</strong> sudah <strong>TERSIMPAN &amp; AMAN</strong> — tidak akan hilang.</p>
            </div>
            <div style="margin-bottom:14px;">
                <strong style="color:#fcd34d;"><span class="ico ico-search"></span> Detail error (yang harus diperbaiki):</strong>
                <pre style="white-space:pre-wrap;font-family:monospace;font-size:0.82em;background:rgba(0,0,0,0.35);padding:10px;border-radius:6px;margin-top:6px;color:#fecaca;max-height:260px;overflow-y:auto;">${esc(detail)}</pre>
                ${l.model_refine_protocol ? `<p style="font-size:0.82em;color:#a8a29e;margin-top:4px;">Model Reviewer 2 saat ini: <strong style="color:#d6d3d1;">${esc(l.model_refine_protocol)}</strong></p>` : ''}
            </div>
            <div style="padding:10px 12px;background:rgba(13, 148, 136,0.1);border:1px solid rgba(13, 148, 136,0.3);border-radius:8px;margin-bottom:14px;font-size:0.88em;color:#d6d3d1;">
                <strong style="color:#5eead4;">Langkah perbaikan:</strong>
                <ol style="margin:6px 0 0;padding-left:20px;line-height:1.6;">
                    <li>Buka <strong>Pengaturan</strong> → role <strong>Reviewer 2</strong>, perbaiki API key / nama model / base URL.</li>
                    <li>Klik <strong><span class="ico ico-flask"></span> Test Model</strong> sampai hijau (✓).</li>
                    <li>Kembali ke sini, klik <strong><span class="ico ico-repeat"></span> Ulangi Verifikasi</strong>.</li>
                </ol>
                <p style="margin:8px 0 0;color:#a8a29e;">Penyebab umum: nama model salah/terkunci (404), API key salah (401), atau kuota habis (429).</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                <button onclick="window.testRoleModel('reviewer2')" class="btn btn-secondary" style="flex:1;min-width:150px;"><span class="ico ico-flask"></span> Test model Reviewer 2</button>
                <button onclick="window.openLLMDebug('${session.id}')" class="btn btn-secondary" style="flex:1;min-width:150px;" title="Lapor bug / lihat prompt+error persis & uji coba (Reproducible Error)"><span class="ico ico-bug"></span> Lapor / Debug Bug</button>
                <button onclick="document.getElementById('btn-settings')?.click()" class="btn btn-secondary" style="flex:1;min-width:150px;"><span class="ico ico-settings"></span> Buka Pengaturan</button>
                <button onclick="window.reverifyExtraction('${session.id}')" class="btn btn-primary" style="flex:1;min-width:150px;"><span class="ico ico-repeat"></span> Ulangi Verifikasi</button>
            </div>
            <div style="margin-top:10px;text-align:center;">
                <button onclick="window.skipVerification('${session.id}')" class="btn" style="background:rgba(245,158,11,0.15);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);font-size:0.82em;padding:4px 12px;" title="Lanjut tanpa QA dual-rater; akan dicatat sebagai limitation metodologis"><span class="ico ico-skip"></span> Lanjut tanpa verifikasi (catat sebagai limitation)</button>
            </div>
        `);
    } else if (status === 'M7_STEP3_QA_BLOCKED') {
        // Gerbang HITL: penilaian QA (dual-rater) DIJEDA karena rater provider gagal sistemik
        // (rate-limit/overload/ResourceExhausted, context overflow, endpoint tak terjangkau) —
        // akan berulang identik di tiap paper. Tampilkan error PENUH + nama model + langkah
        // perbaikan, lalu 'Ulangi QA' (re-attempt HANYA paper ERROR; rating & kalibrasi aman).
        const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const detail = (session.system_error || 'Rater provider gagal sistemik (kemungkinan rate-limit/overload 429/503, kuota habis, ResourceExhausted, atau endpoint tak terjangkau).');
        html = wrapCard('⛔ Penilaian QA Dijeda — Rater Provider Perlu Diperbaiki', `
            <div style="padding:14px 16px;background:rgba(239,68,68,0.12);border-left:4px solid #ef4444;border-radius:8px;color:#fca5a5;margin-bottom:14px;">
                <strong style="font-size:1.05em;">Penilaian kualitas (QA dual-rater) tidak bisa dilanjutkan.</strong>
                <p style="margin:8px 0 0;color:#fecaca;">Pipeline sengaja <strong>berhenti di sini</strong> (bukan "sedang merevisi") agar Anda sempat memperbaiki/ganti provider rater sebelum lanjut. Rating yang sudah selesai &amp; hasil kalibrasi <strong>TERSIMPAN &amp; AMAN</strong> — saat Anda 'Ulangi QA', hanya paper yang <strong>ERROR</strong> yang dinilai ulang.</p>
            </div>
            <div style="margin-bottom:14px;">
                <strong style="color:#fcd34d;"><span class="ico ico-search"></span> Detail error (yang harus diperbaiki):</strong>
                <pre style="white-space:pre-wrap;font-family:monospace;font-size:0.82em;background:rgba(0,0,0,0.35);padding:10px;border-radius:6px;margin-top:6px;color:#fecaca;max-height:260px;overflow-y:auto;">${esc(detail)}</pre>
            </div>
            <div style="padding:10px 12px;background:rgba(13, 148, 136,0.1);border:1px solid rgba(13, 148, 136,0.3);border-radius:8px;margin-bottom:14px;font-size:0.88em;color:#d6d3d1;">
                <strong style="color:#5eead4;">Langkah perbaikan:</strong>
                <ol style="margin:6px 0 0;padding-left:20px;line-height:1.6;">
                    <li>Buka <strong>Pengaturan</strong> → role <strong>Reviewer 1</strong> &amp; <strong>Reviewer 2</strong> (rater QA). Ganti ke provider yang stabil / tak kena rate-limit, atau perbaiki API key / nama model / base URL.</li>
                    <li>Klik <strong><span class="ico ico-flask"></span> Test Model</strong> untuk tiap rater sampai hijau (✓).</li>
                    <li>Kembali ke sini, klik <strong><span class="ico ico-repeat"></span> Ulangi QA</strong>.</li>
                </ol>
                <p style="margin:8px 0 0;color:#a8a29e;">Penyebab umum: kuota/rate-limit habis (429), provider overload (503/ResourceExhausted), nama model salah/terkunci (404), API key salah (401), atau endpoint provider tak berjalan.</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                <button onclick="window.testRoleModel('reviewer1')" class="btn btn-secondary" style="flex:1;min-width:150px;"><span class="ico ico-flask"></span> Test Reviewer 1</button>
                <button onclick="window.testRoleModel('reviewer2')" class="btn btn-secondary" style="flex:1;min-width:150px;"><span class="ico ico-flask"></span> Test Reviewer 2</button>
                <button onclick="window.openLLMDebug('${session.id}')" class="btn btn-secondary" style="flex:1;min-width:150px;" title="Lapor bug / lihat prompt+error persis & uji coba (Reproducible Error)"><span class="ico ico-bug"></span> Lapor / Debug Bug</button>
                <button onclick="document.getElementById('btn-settings')?.click()" class="btn btn-secondary" style="flex:1;min-width:150px;"><span class="ico ico-settings"></span> Buka Pengaturan</button>
                <button onclick="window.retryQABlocked('${session.id}')" class="btn btn-primary" style="flex:1;min-width:150px;"><span class="ico ico-repeat"></span> Ulangi QA</button>
            </div>
        `);

    } else if (status === 'M7_STEP2_WAITING_APPROVAL') {
        const l = session.extraction_log || {};
        const rate = (l.disagreement_rate || 0).toFixed(1);
        const rateColor = (l.disagreement_rate || 0) > 15 ? '#ef4444' : ((l.disagreement_rate || 0) >= 5 ? '#eab308' : '#4ade80');
        let fwHtml = '';
        if (session.framework_selection) {
            let fwRows = '';
            (session.framework_selection.columns || []).forEach((c) => {
                fwRows += `<tr><td style="padding:6px;border-bottom:1px solid rgba(255,255,255,0.05);"><strong>${c.key}</strong></td><td style="padding:6px;border-bottom:1px solid rgba(255,255,255,0.05);color:#5eead4;">${c.category || ''}</td><td style="padding:6px;border-bottom:1px solid rgba(255,255,255,0.05);color:#d6d3d1;">${c.desc || ''}</td></tr>`;
            });
            fwHtml = `
            <details style="margin-bottom:15px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">
                <summary style="cursor:pointer; color:#6ee7b7; font-weight:bold;"><span class="ico ico-copy"></span> Lihat Protokol Ekstraksi Saat Ini</summary>
                <div style="margin-top:10px; font-size:0.9em;">
                    <p><strong>Framework:</strong> ${session.framework_selection.framework}</p>
                    <table style="width:100%;border-collapse:collapse;font-size:0.85em;margin-top:8px;">
                        <tr><th style="text-align:left;padding:6px;color:#9ca3af;">Kolom</th><th style="text-align:left;padding:6px;color:#9ca3af;">Kat.</th><th style="text-align:left;padding:6px;color:#9ca3af;">Deskripsi</th></tr>
                        ${fwRows}
                    </table>
                </div>
            </details>`;
        }

        let xaiHtml = `
            <details style="margin-bottom:15px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">
                <summary style="cursor:pointer; color:#5eead4; font-weight:bold; font-size: 0.85em;"><span class="ico ico-search"></span> xAI: Lihat Langkah AI, Prompt & Model Dibalik Ekstraksi Ini</summary>
                <div style="margin-top:10px; font-size:0.8em; color:#d6d3d1; max-height: 400px; overflow-y: auto;">
                    <div style="margin-bottom:15px; padding-bottom:10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <strong style="color:#5eead4; display:block; margin-bottom:5px;"><span class="ico ico-copy"></span> Langkah-Langkah yang Dilakukan Agent AI (Step 2):</strong>
                        <ol style="margin:0; padding-left:20px; color:#a8a29e; line-height: 1.4;">
                            <li style="margin-bottom:4px;"><strong>Persiapan RAG:</strong> AI memuat indeks vektor teks penuh (full-text) dari PDF yang telah diunduh di Modul 6.</li>
                            <li style="margin-bottom:4px;"><strong>Ekstraksi Massal (Reviewer 1):</strong> Model Ekstraksi membaca secara iteratif setiap paper dan mengekstrak data spesifik berdasarkan definisi operasional dan struktur framework (Prompt).</li>
                            <li style="margin-bottom:4px;"><strong>Penanganan Data Kosong:</strong> Jika informasi tak ditemukan dalam teks, AI dilarang menebak dan diwajibkan mengisinya dengan [NOT REPORTED].</li>
                            <li style="margin-bottom:4px;"><strong>Spot-Verification (Reviewer 2):</strong> Model Refine Protocol (AI Kedua) mengambil sampel acak 20% dan me-review field yang terindikasi "AMBIGUOUS" untuk dibandingkan secara ketat dengan isi teks asli.</li>
                            <li><strong>Kalkulasi Disagreement:</strong> Tingkat kerancuan dihitung untuk menentukan apakah ekstraksi dapat dilanjutkan atau memerlukan perbaikan manual (Refine Protocol).</li>
                        </ol>
                    </div>
                    ${l.model_extraction ? `<p style="color:#fcd34d; margin-bottom:5px;"><strong><span class="ico ico-ai"></span> LLM Model Ekstraksi (Reviewer 1):</strong> ${l.model_extraction}</p>` : ''}
                    ${l.model_refine_protocol ? `<p style="color:#fcd34d; margin-bottom:5px;"><strong><span class="ico ico-ai"></span> LLM Model Refine Protocol (Reviewer 2):</strong> ${l.model_refine_protocol}</p>` : ''}
                    ${l.system_prompt ? `
                    <strong style="margin-top:10px; display:block;">System Prompt (Instruksi Agent Ekstraksi):</strong>
                    <pre style="white-space: pre-wrap; font-family: monospace; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; margin-top: 5px; margin-bottom: 10px;">${(l.system_prompt || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                    ` : '<p style="color:#a8a29e; font-style:italic;">Data prompt tidak direkam pada sesi lama.</p>'}
                </div>
            </details>
        `;

        // Verifikasi (Reviewer 2) gagal total: jangan biarkan "0% (hijau)" menyesatkan.
        const verifyFailed = (l.total_extracted || 0) > 0 && (l.verified_sample || 0) === 0;
        const verifyBanner = verifyFailed ? `
            <div style="padding:10px 12px;background:rgba(239,68,68,0.12);border-left:3px solid #ef4444;border-radius:6px;color:#fca5a5;margin-bottom:12px;">
                <strong>⚠️ Pengecekan kualitas (Reviewer 2) TIDAK berjalan</strong> — 0 paper berhasil diverifikasi. Tingkat perbedaan di bawah <strong>bukan</strong> hasil valid. ${l.nr_note || 'Periksa provider Reviewer 2 (mungkin model terkunci/404 atau kuota).'}
                <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="window.testRoleModel('reviewer2')" class="btn btn-secondary" style="padding:3px 10px;font-size:0.82em;"><span class="ico ico-flask"></span> Test model Reviewer 2</button>
                    <button onclick="window.openLLMDebug('${session.id}')" class="btn btn-secondary" style="padding:3px 10px;font-size:0.82em;" title="Lapor bug / lihat prompt+error persis & uji coba"><span class="ico ico-bug"></span> Lapor / Debug Bug</button>
                    <button onclick="document.getElementById('btn-settings')?.click()" class="btn btn-secondary" style="padding:3px 10px;font-size:0.82em;"><span class="ico ico-settings"></span> Buka Pengaturan</button>
                    <button onclick="window.reverifyExtraction('${session.id}')" class="btn btn-primary" style="padding:3px 10px;font-size:0.82em;"><span class="ico ico-repeat"></span> Ulangi Verifikasi (tanpa re-ekstrak)</button>
                </div>
            </div>` : '';
        html = wrapCard('Modul 7 L2 — Hasil Ekstraksi Data (Full-Text)', `
            ${fwHtml}
            ${verifyBanner}
            ${xaiHtml}
            <p><strong>Total Paper:</strong> ${l.total_extracted || 0} paper berhasil dibaca dan diekstrak datanya oleh AI (Reviewer 1).</p>
            <p><strong>Pengecekan Kualitas (Cross-check):</strong> AI kedua (Reviewer 2) ${verifyFailed ? '<span style="color:#fca5a5;">GAGAL memverifikasi (0 paper)</span>' : `telah mengambil sampel acak ${l.verified_sample || 0} paper untuk diperiksa ulang`}. <br>
            <strong>Tingkat Perbedaan Pemahaman:</strong> <a href="#" onclick="window.showExtractionModal(true); return false;" style="color:${rateColor};font-weight:bold;text-decoration:underline;cursor:pointer;" title="Klik untuk memfilter dan HANYA melihat paper yang rancu/kuning di Tabel Ekstraksi">${rate}%</a></p>
            <p><strong>Temuan Kerancuan:</strong> Terdapat ${l.ambiguous_count || 0} isian data (seperti metodologi, hasil, atau variabel lainnya) yang ditandai ambigu/membingungkan oleh Reviewer 2. Isian yang ambigu ini akan ditandai dengan <strong>warna kuning</strong> pada Tabel Ekstraksi di bawah.</p>
            ${(l.failed_count || 0) > 0 ? `<p style="padding:8px 12px;background:rgba(239,68,68,0.12);border-left:3px solid #ef4444;border-radius:6px;color:#fca5a5;"><strong>⚠️ ${l.failed_count} paper gagal/kosong</strong> (ERROR / hasil kosong / tanpa full-text). Klik <strong><span class="ico ico-repeat"></span> Ekstrak Ulang Paper Gagal/Kosong</strong> di bawah untuk mengulang HANYA paper ini (paper baik dipertahankan, hemat kuota).</p>` : ''}
            <p style="font-size:0.85em;color:#a8a29e;">${l.nr_note || ''}</p>
            <div style="margin-top: 15px; text-align: center; display: flex; gap: 10px; justify-content: center; flex-wrap:wrap;">
                <button class="btn btn-secondary" onclick="window.showExtractionModal()" style="flex:1;min-width:160px;"><span class="ico ico-chart"></span> Lihat Tabel Ekstraksi</button>
                <button class="btn btn-primary" id="btn-dl-ext-md" onclick="window.downloadExtractionMarkdown('${session.id}')" style="flex:1;min-width:160px;"><span class="ico ico-import"></span> Download Laporan (MD)</button>
                <button class="btn" onclick="window.openScreeningCorrection('${session.id}')" style="flex:1;min-width:160px;background:rgba(245,158,11,0.18);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);" title="Koreksi include/exclude tanpa mengubah protokol"><span class="ico ico-back"></span> Koreksi Include/Exclude</button>
            </div>
        `);

    } else if (status === 'M7_STEP3_QA_TOOL_WAITING_APPROVAL' && session.qa_threshold_justification) {
        const q = session.qa_threshold_justification;
        html = wrapCard('Modul 7 L3 — QA Tool Selection', `
            <p>Sistem telah merekomendasikan alat ukur kualitas (QA Tool) berikut berdasarkan desain studi Anda:</p>
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <p><strong>Tool:</strong> <span style="color:#6ee7b7; font-weight:bold;">${q.tool}</span></p>
                <p><strong>Kategorisasi:</strong> ${q.categorization || '-'}</p>
                <p><strong>Rekomendasi Threshold:</strong> &ge; ${q.threshold}%</p>
                <p style="margin-top:10px;"><strong>Justifikasi Tool:</strong><br><span style="color:#d6d3d1;">${(q.tool_justification || '').replace(/\n/g, '<br>')}</span></p>
            </div>
            <p style="font-size:0.85em;color:#a8a29e;">Klik <strong>Setuju & Lanjut</strong> untuk memulai penilaian kualitas pada semua paper menggunakan tool ini, atau berikan revisi (contoh: "Tolong ganti ke JBI Tool dengan threshold 80%").</p>
        `);

    } else if (status === 'M7_STEP3_QA_CALIBRATION_WAITING_APPROVAL' && session.qa_calibration) {
        const cal = session.qa_calibration;
        const anchors = cal.anchors || [];
        const pilots = cal.pilot_results || [];
        const kappaColor = (cal.pilot_kappa >= 0.6) ? '#4ade80' : '#fca5a5';
        const passedBadge = cal.calibration_passed
            ? '<span style="background:#065f46;color:#6ee7b7;padding:2px 8px;border-radius:4px;font-size:0.85em;">PASSED</span>'
            : '<span style="background:#7f1d1d;color:#fca5a5;padding:2px 8px;border-radius:4px;font-size:0.85em;">NOT PASSED</span>';

        let pilotRows = pilots.map(p => `
            <tr>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);">${p.title || p.paper_id || '-'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${p.r1_score ?? '-'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${p.r1_category || '-'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${p.r2_score ?? '-'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${p.r2_category || '-'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;font-weight:bold;">${p.final_category || '-'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${p.disagreement ? '<span style="color:#fca5a5;">Yes</span>' : '<span style="color:#6ee7b7;">No</span>'}</td>
            </tr>
        `).join('');

        let anchorCards = anchors.map(a => `
            <div style="background:rgba(0,0,0,0.2);padding:10px 14px;border-radius:6px;border-left:3px solid ${a.category === 'HIGH' ? '#4ade80' : a.category === 'MODERATE' ? '#fbbf24' : '#fca5a5'};">
                <div style="font-weight:bold;color:${a.category === 'HIGH' ? '#4ade80' : a.category === 'MODERATE' ? '#fbbf24' : '#fca5a5'};margin-bottom:4px;">${a.category} (Score: ${a.score})</div>
                <div style="font-size:0.85em;color:#d6d3d1;">${a.description || ''}</div>
                ${a.reasoning ? `<div style="font-size:0.8em;color:#a8a29e;margin-top:4px;"><em>${a.reasoning}</em></div>` : ''}
            </div>
        `).join('');

        html = wrapCard('Modul 7 L3 — QA Calibration Results', `
            <div style="display:flex;gap:12px;margin-bottom:15px;flex-wrap:wrap;align-items:center;">
                <div style="background:rgba(255,255,255,0.05);padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:0.75em;color:#a8a29e;text-transform:uppercase;letter-spacing:0.05em;">Pilot Kappa</div>
                    <div style="font-size:1.1em;font-weight:bold;color:${kappaColor};">${(cal.pilot_kappa || 0).toFixed(3)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:0.75em;color:#a8a29e;text-transform:uppercase;letter-spacing:0.05em;">Calibration</div>
                    <div style="margin-top:4px;">${passedBadge}</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:0.75em;color:#a8a29e;text-transform:uppercase;letter-spacing:0.05em;">Attempts</div>
                    <div style="font-size:1.1em;font-weight:bold;color:#fff;">${cal.attempts || 0}</div>
                </div>
            </div>

            <h5 style="color:#5eead4;margin-bottom:8px;">Pilot Results</h5>
            <div style="overflow-x:auto;margin-bottom:15px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.85em;">
                    <thead>
                        <tr style="border-bottom:2px solid rgba(255,255,255,0.1);">
                            <th style="padding:8px;text-align:left;color:#a8a29e;">Paper</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">R1 Score</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">R1 Cat</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">R2 Score</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">R2 Cat</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">Final</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">Disagree</th>
                        </tr>
                    </thead>
                    <tbody>${pilotRows}</tbody>
                </table>
            </div>

            <h5 style="color:#5eead4;margin-bottom:8px;">Anchors</h5>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:15px;">
                ${anchorCards}
            </div>

            <p style="font-size:0.85em;color:#a8a29e;">Klik <strong>Setuju & Lanjut</strong> jika kalibrasi sudah memuaskan, atau berikan revisi.</p>
        `);

    } else if (status === 'M7_STEP3_QA_CALIBRATION_LOW_KAPPA' && session.qa_calibration) {
        const cal = session.qa_calibration;
        const pilots = cal.pilot_results || [];
        const kappaColor = (cal.pilot_kappa >= 0.6) ? '#4ade80' : '#fca5a5';

        let pilotRows = pilots.map(p => `
            <tr>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);">${escHtml(p.title || p.paper_id || '-')}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${p.r1_score ?? '-'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${escHtml(p.r1_category || '-')}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${p.r2_score ?? '-'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${escHtml(p.r2_category || '-')}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;font-weight:bold;">${escHtml(p.final_category || '-')}</td>
                <td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">${p.disagreement ? '<span style="color:#fca5a5;">Yes</span>' : '<span style="color:#6ee7b7;">No</span>'}</td>
            </tr>
        `).join('');

        html = wrapCard('Modul 7 L3 — QA Calibration: Low Kappa', `
            <div style="background:rgba(239,68,68,0.15);border:1px solid #fca5a5;border-radius:8px;padding:15px;margin-bottom:15px;">
                <p style="color:#fca5a5;font-weight:bold;margin:0 0 8px 0;">&#9888; Inter-rater agreement (kappa) terlalu rendah</p>
                <p style="color:#fecaca;margin:0;font-size:0.9em;">Nilai kappa pilot: <strong>${(cal.pilot_kappa || 0).toFixed(3)}</strong> (minimum 0.6 diperlukan). Sistem perlu melakukan kalibrasi ulang agar hasil QA konsisten antar reviewer.</p>
            </div>

            <div style="display:flex;gap:12px;margin-bottom:15px;flex-wrap:wrap;align-items:center;">
                <div style="background:rgba(255,255,255,0.05);padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:0.75em;color:#a8a29e;text-transform:uppercase;letter-spacing:0.05em;">Pilot Kappa</div>
                    <div style="font-size:1.1em;font-weight:bold;color:${kappaColor};">${(cal.pilot_kappa || 0).toFixed(3)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:0.75em;color:#a8a29e;text-transform:uppercase;letter-spacing:0.05em;">Calibration</div>
                    <div style="margin-top:4px;"><span style="background:#7f1d1d;color:#fca5a5;padding:2px 8px;border-radius:4px;font-size:0.85em;">NOT PASSED</span></div>
                </div>
                <div style="background:rgba(255,255,255,0.05);padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:0.75em;color:#a8a29e;text-transform:uppercase;letter-spacing:0.05em;">Attempts</div>
                    <div style="font-size:1.1em;font-weight:bold;color:#fff;">${cal.attempts || 0} / ${cal.max_attempts || 3}</div>
                </div>
            </div>

            <h5 style="color:#5eead4;margin-bottom:8px;">Pilot Results</h5>
            <div style="overflow-x:auto;margin-bottom:15px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.85em;">
                    <thead>
                        <tr style="border-bottom:2px solid rgba(255,255,255,0.1);">
                            <th style="padding:8px;text-align:left;color:#a8a29e;">Paper</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">R1 Score</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">R1 Cat</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">R2 Score</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">R2 Cat</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">Final</th>
                            <th style="padding:8px;text-align:center;color:#a8a29e;">Disagree</th>
                        </tr>
                    </thead>
                    <tbody>${pilotRows}</tbody>
                </table>
            </div>

            ${cal.refinement_note ? `
            <div style="background:rgba(0,0,0,0.2);padding:12px 15px;border-radius:6px;border-left:3px solid #5eead4;margin-bottom:15px;">
                <div style="font-size:0.75em;color:#a8a29e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Refinement Note from Brain</div>
                <div style="color:#d6d3d1;font-size:0.9em;">${escHtml(cal.refinement_note)}</div>
            </div>
            ` : ''}

            ${(cal.r1_model || cal.r2_model || cal.brain_model) ? `
            <div style="margin-bottom:15px;">
                <h5 style="color:#5eead4;margin-bottom:8px;">&#129302; Model yang Digunakan</h5>
                <div style="background:rgba(255,255,255,0.05);border-radius:6px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
                    <table style="width:100%;border-collapse:collapse;font-size:0.85em;">
                        <tbody>
                            ${cal.r1_model ? `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                <td style="padding:8px 12px;color:#a8a29e;font-weight:500;width:100px;">Rater 1</td>
                                <td style="padding:8px 12px;color:#e2e8f0;">${escHtml(cal.r1_model)}</td>
                            </tr>` : ''}
                            ${cal.r2_model ? `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                <td style="padding:8px 12px;color:#a8a29e;font-weight:500;width:100px;">Rater 2</td>
                                <td style="padding:8px 12px;color:#e2e8f0;">${escHtml(cal.r2_model)}</td>
                            </tr>` : ''}
                            ${cal.brain_model ? `<tr>
                                <td style="padding:8px 12px;color:#a8a29e;font-weight:500;width:100px;">Brain</td>
                                <td style="padding:8px 12px;color:#e2e8f0;">${escHtml(cal.brain_model)}</td>
                            </tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}

            ${cal.system_prompt ? `
            <div style="margin-bottom:15px;">
                <details style="background:rgba(255,255,255,0.02);padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
                    <summary style="cursor:pointer;color:#5eead4;font-weight:500;">&#9642; System Prompt yang Dikirim ke Rater</summary>
                    <div style="margin-top:10px;background:rgba(0,0,0,0.3);padding:12px;border-radius:4px;border:1px solid rgba(255,255,255,0.05);max-height:400px;overflow-y:auto;">
                        <pre style="white-space:pre-wrap;word-break:break-word;font-size:0.8em;color:#d6d3d1;margin:0;font-family:'Fira Code',monospace;">${escHtml(cal.system_prompt)}</pre>
                    </div>
                </details>
            </div>
            ` : ''}

            ${cal.action_items ? `
            <div style="margin-bottom:15px;">
                <h5 style="color:#5eead4;margin-bottom:8px;">&#127919; Langkah Selanjutnya</h5>
                <div style="background:rgba(0,0,0,0.2);padding:12px 15px;border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
                    <div style="color:#d6d3d1;font-size:0.88em;line-height:1.6;white-space:pre-wrap;">${escHtml(cal.action_items)}</div>
                </div>
            </div>
            ` : ''}

            <div style="display:flex;gap:10px;justify-content:center;">
                <button class="btn btn-primary" id="btn-retry-calibration">&#128260; Retry Kalibrasi</button>
                <button class="btn btn-secondary" id="btn-force-proceed" style="border-color:#eab308;color:#fef08a;">&#9889; Lanjutkan (Force Proceed)</button>
            </div>
        `);

        setTimeout(() => {
            const btnRetry = document.getElementById('btn-retry-calibration');
            const btnForce = document.getElementById('btn-force-proceed');
            if (btnRetry) {
                btnRetry.addEventListener('click', async () => {
                    setButtonLoading(btnRetry, true);
                    try {
                        await API.reviseStep(session.id, 'Retry calibration with refined anchors', 'M7_STEP3_QA_CALIBRATION_RETRY');
                        showToast('Kalibrasi ulang dimulai...');
                    } catch (err) {
                        showToast(err.message, 'error');
                    } finally {
                        setButtonLoading(btnRetry, false, '\u{1F504} Retry Kalibrasi');
                    }
                });
            }
            if (btnForce) {
                btnForce.addEventListener('click', async () => {
                    setButtonLoading(btnForce, true);
                    try {
                        await API.reviseStep(session.id, 'Force proceed despite low kappa', 'M7_STEP3_QA_CALIBRATION_FORCE_PROCEED');
                        showToast('Melanjutkan tanpa kalibrasi ulang...');
                    } catch (err) {
                        showToast(err.message, 'error');
                    } finally {
                        setButtonLoading(btnForce, false, '\u26A1 Lanjutkan (Force Proceed)');
                    }
                });
            }
        }, 0);

    } else if (status === 'M7_STEP3_WAITING_APPROVAL' && session.qa_threshold_justification) {
        const q = session.qa_threshold_justification;
        const sens = (session.sensitivity_analysis && session.sensitivity_analysis.markdown) || '';
        html = wrapCard('Modul 7 L3 — Quality Appraisal & Sensitivity', `
            <div style="display:flex; gap:12px; margin-bottom:15px; flex-wrap:wrap;">
                <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 0.75em; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.05em;">Appraisal Tool</div>
                    <div style="font-size: 1.1em; font-weight: bold; color: #fff;">${q.tool}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); flex: 1;">
                    <div style="font-size: 0.75em; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.05em;">Threshold & Kategorisasi</div>
                    <div style="font-size: 1.1em; font-weight: bold; color: #38bdf8;">Batas Lulus: &ge; ${q.threshold}%</div>
                    <div style="font-size: 0.75em; color: #a8a29e; margin-top: 4px;">${q.categorization || ''}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);" title="Jika 0.000, kemungkinan belum cukup sampel untuk cross-check, atau rater kedua belum selesai.">
                    <div style="font-size: 0.75em; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px;">Dual-rater κ <span style="cursor:help; font-size: 1.2em;"><span class="ico ico-info"></span> </span></div>
                    <div style="font-size: 1.1em; font-weight: bold; color: ${q.kappa >= 0.6 ? '#4ade80' : '#fca5a5'};">${(q.kappa || 0).toFixed(3)}</div>
                </div>
            </div>

            <div style="font-size:0.88em; color:#d6d3d1; line-height: 1.6; background: rgba(0,0,0,0.15); padding: 12px; border-left: 3px solid #38bdf8; border-radius: 4px; margin-bottom: 12px;">
                ${(q.tool_justification || '').replace(/\n/g, '<br>')}
            </div>



            <details style="margin-bottom:15px; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                <summary style="cursor:pointer; color:#5eead4; font-weight: 500;">Justifikasi threshold 3-lapis</summary>
                <div style="font-size:0.85em; margin-top:10px; color:#d6d3d1; display:flex; flex-direction:column; gap:8px;">
                    <div><strong style="color:#fff;">Literatur:</strong> ${q.layer_literature || '-'}</div>
                    <div><strong style="color:#fff;">Developer tool:</strong> ${q.layer_developer || '-'}</div>
                    <div><strong style="color:#fff;">Feasibility:</strong> ${q.layer_feasibility || '-'}</div>
                </div>
            </details>

            ${q.kappa_details ? `
            <details style="margin-bottom:15px; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                <summary style="cursor:pointer; color:#fca5a5; font-weight: 500;">xAI: Transparansi Dual-Rater Kappa</summary>
                <div style="font-size:0.85em; margin-top:10px; color:#d6d3d1; display:flex; flex-direction:column; gap:8px;">
                    <div><strong style="color:#fff;">Total Pasangan Dinilai (Valid):</strong> ${q.kappa_details.total_rated} paper <span style="color:#a8a29e;">(Jika 0, rater ke-2 gagal merespons atau belum aktif)</span></div>
                    <div><strong style="color:#fff;">Keduanya Sepakat Lolos (HIGH/MODERATE):</strong> ${q.kappa_details.both_pass} paper</div>
                    <div><strong style="color:#fff;">Keduanya Sepakat Gagal (LOW):</strong> ${q.kappa_details.both_fail} paper</div>
                    <div><strong style="color:#fff;">Hanya Rater 1 yang Meloloskan:</strong> ${q.kappa_details.r1_pass_r2_fail} paper</div>
                    <div><strong style="color:#fff;">Hanya Rater 2 yang Meloloskan:</strong> ${q.kappa_details.r1_fail_r2_pass} paper</div>
                    ${q.kappa_details.total_rated > 0 && q.kappa === 0 ? `<div style="margin-top: 8px; font-style: italic; color: #fbbf24;">* ⚠️ Jika Kappa bernilai 0.000 padahal Total Valid > 0, itu terjadi karena fenomena matematis "Cohen's Kappa Paradox" di mana probabilitas kesepakatan homogen sama persis dengan probabilitas tebakan acak. Kesepakatan aktual tetap berlaku.</div>` : ''}
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px;">
                        <button class="btn btn-secondary" onclick="window.showQAXAIModal(this)" style="padding:6px 12px; font-size:0.9em; width:fit-content;"><span class="ico ico-search"></span> Buka Detail Keputusan Rater (xAI)</button>
                        <button class="btn btn-secondary" onclick="window.downloadQAXAIMarkdown(this)" style="padding:6px 12px; font-size:0.9em; width:fit-content;"><span class="ico ico-download"></span> Download Detail Keputusan (Markdown)</button>
                    </div>
                </div>
            </details>
            ` : ''}


            
            ${sens ? `<div class="sensitivity-table-wrapper" style="margin-top:15px; font-size:0.88em; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px;">${formatMarkdown(sens).replace(/Verdict:\s*(SENSITIVE|ROBUST)/i, (m, v) => {
                const color = v.toUpperCase() === 'SENSITIVE' ? '#fbbf24' : '#4ade80';
                const bg = v.toUpperCase() === 'SENSITIVE' ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)';
                return `Verdict: <span style="background:${bg}; color:${color}; padding: 4px 10px; border-radius: 12px; font-weight: bold; margin-left: 6px; display: inline-block;">${v.toUpperCase()}</span>`;
            })}</div>` : ''}

            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
                <button id="btn-m7-recalc-qa" class="btn" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);" title="Recalculate ERROR papers yang memiliki skor R1+R2 valid tanpa mengulang seluruh proses QA"><span class="ico ico-refresh"></span> Recalculate ERROR Papers</button>
                <button id="btn-m7-rerun-qa" class="btn" style="background: rgba(13, 148, 136, 0.2); color: #5eead4; border: 1px solid rgba(13, 148, 136, 0.4);" title="Jalankan ULANG seluruh proses QA dari awal (pilih tool → kalibrasi → rating) untuk memperbaiki panduan rater & kappa. Data ekstraksi PDF DIPERTAHANKAN (beda dari Drop Modul 7)."><span class="ico ico-repeat"></span> Jalankan Ulang Seluruh Proses QA</button>
                <button id="btn-m7-download-md" class="btn" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);" title="Unduh laporan QA & Sensitivitas dalam format Markdown untuk dibagikan ke LLM lain"><span class="ico ico-download"></span> Unduh Report (.md)</button>
                <button id="btn-m7-resume-qa" class="btn" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4);" title="Klik ini jika Anda baru saja menghapus & re-upload PDF untuk melanjutkan penilaian QA pada paper yang tersisa saja.">▶️ Lanjutkan QA (Hanya Sisa PDF)</button>
                <button class="btn" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4);" onclick="if(confirm('Anda yakin ingin men-drop Modul 7 dan mengulang dari nol? Semua data ekstraksi PDF dan skor QA akan dihapus permanen!')) window.resetModul7()"><span class="ico ico-warn"></span> Drop Modul 7</button>
            </div>
        `);
        
        setTimeout(() => {
            const btnRecalcQA = document.getElementById('btn-m7-recalc-qa');
            if (btnRecalcQA) {
                btnRecalcQA.addEventListener('click', async () => {
                    if (!confirm('Recalculate semua paper ERROR yang memiliki skor R1+R2 valid? Ini akan menghitung ulang kategori final tanpa mengulang rating.')) return;
                    try {
                        btnRecalcQA.disabled = true;
                        btnRecalcQA.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Recalculating...';
                        const resp = await fetch(`${getBaseURL()}/sessions/${session.id}/m7/recalculate-qa`, {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
                        });
                        const data = await resp.json();
                        if (!resp.ok) throw new Error(data.error || 'Unknown error');
                        alert(`${data.message}\n\nKappa baru: ${(data.kappa || 0).toFixed(3)}`);
                        window.location.reload();
                    } catch(e) {
                        alert("Gagal recalculate: " + e.message);
                        btnRecalcQA.disabled = false;
                        btnRecalcQA.innerHTML = '<span class="ico ico-refresh"></span> Recalculate ERROR Papers';
                    }
                });
            }

            const btnRerunQA = document.getElementById('btn-m7-rerun-qa');
            if (btnRerunQA) {
                btnRerunQA.addEventListener('click', async () => {
                    if (!confirm('Jalankan ULANG seluruh proses QA dari awal?\n\nIni akan MENGHAPUS semua skor QA, kalibrasi, dan threshold saat ini, lalu memulai lagi dari pemilihan tool → kalibrasi → rating.\n\nData ekstraksi PDF (framework + hasil ekstraksi) TETAP DIPERTAHANKAN.\n\nGunakan ini untuk memperbaiki panduan rater & kappa. Lanjutkan?')) return;
                    try {
                        btnRerunQA.disabled = true;
                        btnRerunQA.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memulai ulang QA...';
                        const data = await API.rerunQA(session.id);
                        alert(data.message || 'Proses QA dijalankan ulang. Pantau Live Log.');
                        window.location.reload();
                    } catch(e) {
                        alert("Gagal menjalankan ulang QA: " + (e.message || e));
                        btnRerunQA.disabled = false;
                        btnRerunQA.innerHTML = '<span class="ico ico-repeat"></span> Jalankan Ulang Seluruh Proses QA';
                    }
                });
            }

            const btnResumeQA = document.getElementById('btn-m7-resume-qa');
            if (btnResumeQA) {
                btnResumeQA.addEventListener('click', async () => {
                    try {
                        btnResumeQA.disabled = true;
                        btnResumeQA.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Melanjutkan...';
                        await API.reviseStep(session.id, 'Melanjutkan QA sisa paper yang baru diupload', 'M7_STEP3_QA');
                        window.location.reload();
                    } catch(e) {
                        alert("Gagal melanjutkan QA: " + e.message);
                        btnResumeQA.disabled = false;
                        btnResumeQA.innerHTML = '▶️ Lanjutkan QA (Hanya Sisa PDF)';
                    }
                });
            }
            
            const btnDownloadMd = document.getElementById('btn-m7-download-md');
            if (btnDownloadMd) {
                btnDownloadMd.addEventListener('click', () => {
                    const md = `# Quality Appraisal & Sensitivity Report

## Appraisal Tool
- **Tool**: ${q.tool || '-'}
- **Threshold**: >= ${q.threshold || 0}%
- **Kategorisasi**: ${q.categorization || '-'}
- **Dual-Rater Kappa**: ${(q.kappa || 0).toFixed(3)}

## Justification
${q.tool_justification || '-'}

### Threshold 3-Layer Justification
- **Literature**: ${q.layer_literature || '-'}
- **Developer Tool**: ${q.layer_developer || '-'}
- **Feasibility**: ${q.layer_feasibility || '-'}

## Dual-Rater Agreement Details (xAI)
- **Total Valid Pairs**: ${q.kappa_details ? q.kappa_details.total_rated : 0}
- **Both Pass (HIGH/MODERATE)**: ${q.kappa_details ? q.kappa_details.both_pass : 0}
- **Both Fail (LOW)**: ${q.kappa_details ? q.kappa_details.both_fail : 0}
- **Rater 1 Pass, Rater 2 Fail**: ${q.kappa_details ? q.kappa_details.r1_pass_r2_fail : 0}
- **Rater 1 Fail, Rater 2 Pass**: ${q.kappa_details ? q.kappa_details.r1_fail_r2_pass : 0}

## Sensitivity Analysis
${sens || 'Tidak tersedia'}
`;
                    const blob = new Blob([md], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'Quality_Appraisal_Report.md';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            }
        }, 0);

    } else if (status === 'M7_STEP4_WAITING_APPROVAL') {
        const sumMd = (session.modul7_summary && session.modul7_summary.markdown) || 'Menunggu data...';
        const sp = session.synthesis_prep || {};
        html = wrapCard('Modul 7 L4 — Synthesis Prep & Summary', `
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; font-size: 0.9em; max-height: 340px; overflow-y: auto;">
                ${formatMarkdown(sumMd)}
            </div>
            <p style="margin-top:10px;font-size:0.9em;"><strong>Heterogeneity:</strong> ${sp.heterogeneity_verdict || '-'} | <strong>Meta-analysis:</strong> <span style="color:#6ee7b7;">${sp.meta_feasibility || '-'}</span></p>
            ${sumMd.includes('ERROR') ? `<div style="margin-top: 12px;"><button id="btn-m7-retry-qa" class="btn" style="background:#fbbf24; color:#1c1917; width:100%; border:none; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer;"><span class="ico ico-refresh"></span> Ulangi Penilaian QA untuk Studi yang ERROR</button></div>` : ''}
            <details style="margin-top:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border-left:3px solid #5eead4;">
                <summary style="cursor:pointer; color:#5eead4; font-weight:bold; font-size:0.85em;"><span class="ico ico-search"></span> xAI: Lihat Model & Prompt Synthesis Prep</summary>
                <div style="margin-top:10px; font-size:0.8em; color:#d6d3d1; max-height:250px; overflow-y:auto;">
                    ${sp.model_used ? `<p style="color:#fcd34d; margin-bottom:5px;"><strong><span class="ico ico-ai"></span> LLM Model:</strong> ${sp.model_used}</p>` : ''}
                    <strong>System Prompt (Instruksi Agent):</strong><br>
                    <pre style="white-space:pre-wrap; font-family:monospace; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; margin-top:5px;">${(sp.system_prompt || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                </div>
            </details>
            <p style="margin-top: 8px; font-size: 0.9em; color:#4ade80;"><em>Setujui untuk menutup Modul 7 dan lanjut ke Modul 8 (Synthesis).</em></p>
        `);

    } else if (status === 'M7_STEP5_WAITING_APPROVAL') {
        const gs = session.graph_extraction_summary || {};
        const totalGraphed = gs.total_graphed || 0;
        const totalEligible = gs.total_eligible || 0;
        const neo4jConnected = gs.neo4j_connected || false;
        const neo4jStatus = neo4jConnected
            ? '<span style="color:#4ade80;">● Connected</span>'
            : '<span style="color:#f87171;">● Disconnected</span>';
        const graphSysPrompt = `Anda adalah ahli neuro-symbolic AI yang bertugas membangun Knowledge Graph dari literatur ilmiah.
Tugas Anda adalah membaca hasil ekstraksi sebuah paper, dan mengubahnya menjadi Nodes (simpul) dan Edges (relasi).

ATURAN NODES:
- Wajib sertakan minimal node Paper.
  Node Paper: Label "Paper", ID (DOI atau Title yang di-slug), Props minimal {title, doi}.
- Buat Nodes untuk Entitas penting: "Author", "Method", "Dataset", "Metric", "Conclusion".
- Gunakan ID yang sangat konsisten untuk entitas yang sama (contoh: id="dataset-adni", label="Dataset", props={name: "ADNI"}).

ATURAN EDGES:
- Hubungkan Paper dengan entitas lain.
- Tipe Relasi valid contohnya: WRITTEN_BY, USES_METHOD, USES_DATASET, EVALUATES_METRIC, CONCLUDES.
- Tiap edge butuh source_id, target_id, source_label, target_label, type, dan props.`;

        html = wrapCard('Modul 7 L5 — Knowledge Graph Extraction (Neo4j)', `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:6px; text-align:center;">
                    <div style="font-size:2em; font-weight:bold; color:#6ee7b7;">${totalGraphed}</div>
                    <div style="font-size:0.85em; color:#9ca3af;">Paper berhasil di-graph</div>
                </div>
                <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:6px; text-align:center;">
                    <div style="font-size:2em; font-weight:bold; color:#5eead4;">${totalEligible}</div>
                    <div style="font-size:0.85em; color:#9ca3af;">Total paper eligible</div>
                </div>
            </div>
            <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:6px; margin-bottom:12px;">
                <p style="margin:0 0 6px; font-size:0.9em;"><strong>Neo4j AuraDB Status:</strong> ${neo4jStatus}</p>
                <p style="margin:0; font-size:0.85em; color:#d6d3d1;">Knowledge Graph dari ${totalGraphed} paper telah berhasil diekstrak dan disimpan ke Neo4j AuraDB. Graph berisi nodes (Paper, Author, Method, Dataset, Metric, Conclusion) dan edges (relasi antar entitas) yang siap untuk query dan visualisasi.</p>
            </div>
            <details style="margin-top:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border-left:3px solid #5eead4;">
                <summary style="cursor:pointer; color:#5eead4; font-weight:bold; font-size:0.85em;"><span class="ico ico-search"></span> xAI: Lihat System Prompt Graph Extraction</summary>
                <div style="margin-top:10px; font-size:0.8em; color:#d6d3d1; max-height:300px; overflow-y:auto;">
                    <strong>System Prompt (Instruksi Agent untuk Graph Extraction):</strong><br>
                    <pre style="white-space:pre-wrap; font-family:monospace; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; margin-top:5px;">${graphSysPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                </div>
            </details>
            <p style="margin-top: 8px; font-size: 0.9em; color:#4ade80;"><em>Setujui untuk melanjutkan ke Modul 8 (Synthesis & GRADE).</em></p>
        `);

    } else if (status === 'M8_STEP1_WAITING_APPROVAL' && session.descriptive_analysis) {
        const d = session.descriptive_analysis;
        const figs = (d.figures || []).map(f => `<div style="background:#fff;border-radius:6px;margin:8px 0;overflow:hidden;">${f.svg || ''}</div>${f.url ? `<div style="font-size:0.8em;margin:-4px 0 8px;"><a href="${f.url}" target="_blank" style="color:#5eead4;">${f.name} ↗ (GitHub Pages)</a></div>` : ''}`).join('');
        html = wrapCard('Modul 8 L1 — Descriptive Analysis + Heterogeneity', `
            <div style="font-size:0.9em;">${formatMarkdown(d.markdown || '')}</div>
            <p style="margin-top:8px;"><strong>Heterogeneity:</strong> <span style="color:#5eead4;">${d.heterogeneity_verdict || '-'}</span></p>
            <p style="font-size:0.88em;color:#d6d3d1;">${d.heterogeneity_narrative || ''}</p>
            <details style="margin-top:8px;"><summary style="cursor:pointer;color:#6ee7b7;font-weight:bold;">Lihat ${(d.figures||[]).length} figur (SVG)</summary>${figs}</details>
            <button id="btn-enrich-metadata" class="btn" style="margin-top:10px;background:#0ea5e9;color:#fff;"><i class="fa fa-sync-alt"></i> Perkaya & Analisis Ulang (CrossRef)</button>
        `);
        setTimeout(() => {
            const btnEnrich = document.getElementById('btn-enrich-metadata');
            if (btnEnrich) btnEnrich.addEventListener('click', async () => {
                if (!confirm('Enrich metadata dari CrossRef lalu analisis ulang otomatis?')) return;
                try {
                    btnEnrich.disabled = true;
                    btnEnrich.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memperkaya metadata & menganalisis ulang...';

                    // Step 1: Trigger enrichment (async di background)
                    const resp = await fetch(`${getBaseURL()}/sessions/${session.id}/m7/enrich-metadata`, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('auth_token') }
                    });
                    if (!resp.ok) throw new Error((await resp.json()).error || resp.statusText);

                    // Step 2: Wait for background enrichment to complete (poll or fixed delay)
                    btnEnrich.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Menunggu enrichment selesai...';
                    await new Promise(r => setTimeout(r, 10000)); // 10 detik buffer untuk background process

                    // Step 3: Auto-trigger revision to re-run M8 Step 1
                    btnEnrich.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Menganalisis ulang...';
                    await API.reviseStep(session.id, 'Auto-retry setelah enrich metadata CrossRef', 'M8_STEP1_DESCRIPTIVE');

                    // Step 4: Reload page to show fresh results
                    window.location.reload();
                } catch (err) {
                    alert('Gagal: ' + err.message);
                    btnEnrich.disabled = false;
                    btnEnrich.innerHTML = '<i class="fa fa-sync-alt"></i> Perkaya & Analisis Ulang (CrossRef)';
                }
            });
        }, 100);

    } else if (status === 'M8_STEP2_WAITING_APPROVAL' && session.synthesis_results) {
        const dec = session.synthesis_path_decision || {};
        const sr = session.synthesis_results || {};
        const fps = sr.forest_plot_script ? `<details style="margin-top:8px;"><summary style="cursor:pointer;color:#fbbf24;font-weight:bold;">Skrip Forest Plot (R/metafor)</summary><pre style="white-space:pre-wrap;font-size:0.78em;background:#0b1220;padding:10px;border-radius:6px;overflow-x:auto;">${(sr.forest_plot_script||'').replace(/</g,'&lt;')}</pre></details>` : '';

        // xAI transparency section (purple left border, collapsible)
        const decModel = dec.model_used || sr.model_used || '';
        const decPrompt = dec.system_prompt || '';
        const srPrompt = sr.system_prompt || '';
        let xaiSection = '';
        if (decModel || decPrompt || srPrompt) {
            xaiSection = `
            <details style="margin-top:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border-left:3px solid #5eead4;">
                <summary style="cursor:pointer; color:#5eead4; font-weight:bold; font-size:0.85em;"><span class="ico ico-search"></span> xAI: Lihat Model & Prompt Synthesis (Kaidah xAI)</summary>
                <div style="margin-top:10px; font-size:0.8em; color:#d6d3d1; max-height:350px; overflow-y:auto;">
                    ${decModel ? `<p style="color:#fcd34d; margin-bottom:5px;"><strong><span class="ico ico-ai"></span> LLM Model:</strong> ${decModel}</p>` : ''}
                    ${decPrompt ? `<div style="margin-bottom:12px;"><strong style="color:#5eead4;">System Prompt (Path Decision Agent):</strong><pre style="white-space:pre-wrap; font-family:monospace; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; margin-top:5px;">${decPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>` : ''}
                    ${srPrompt ? `<div><strong style="color:#5eead4;">System Prompt (Synthesis Agent):</strong><pre style="white-space:pre-wrap; font-family:monospace; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; margin-top:5px;">${srPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>` : ''}
                    ${!decPrompt && !srPrompt ? `<p style="color:#a8a29e; font-style:italic;">Data prompt tidak direkam pada sesi lama.</p>` : ''}
                </div>
            </details>`;
        }

        html = wrapCard('Modul 8 L2 — Synthesis Path + Results', `
            <p><strong>Path:</strong> <span style="color:#6ee7b7;font-weight:bold;">${dec.verdict || sr.path || '-'}</span></p>
            <p style="font-size:0.85em;color:#a8a29e;"><strong>Kriteria:</strong> ${dec.criteria_check || '-'}</p>
            <p style="font-size:0.88em;color:#d6d3d1;"><strong>Rationale:</strong> ${dec.rationale || ''}</p>
            <hr style="border-color:rgba(255,255,255,0.1);">
            <div style="font-size:0.9em;max-height:340px;overflow-y:auto;">${formatMarkdown(sr.markdown || '')}</div>
            ${fps}
            ${xaiSection}
            <div style="margin-top:12px; text-align:center;">
                <button id="btn-dl-synthesis-md" class="btn btn-secondary" style="padding:8px 16px; font-size:0.9em;"><span class="ico ico-download"></span> Download Markdown</button>
            </div>
        `);
        setTimeout(() => {
            const btnDl = document.getElementById('btn-dl-synthesis-md');
            if (btnDl) btnDl.addEventListener('click', () => {
                let md = `# Modul 8 L2 — Synthesis Path + Results\n\n`;
                md += `## Path Decision\n- **Verdict:** ${dec.verdict || sr.path || '-'}\n- **Kriteria:** ${dec.criteria_check || '-'}\n- **Rationale:** ${dec.rationale || ''}\n\n`;
                if (decModel) md += `## Model (xAI)\n- **Model:** ${decModel}\n\n`;
                md += `## Synthesis Results\n${sr.markdown || ''}\n\n`;
                if (sr.forest_plot_script) md += `## Forest Plot Script (R/metafor)\n\`\`\`r\n${sr.forest_plot_script}\n\`\`\`\n`;
                if (decPrompt) md += `## System Prompt (Path Decision)\n\`\`\`\n${decPrompt}\n\`\`\`\n\n`;
                if (srPrompt) md += `## System Prompt (Synthesis)\n\`\`\`\n${srPrompt}\n\`\`\`\n`;
                const blob = new Blob([md], {type: 'text/markdown'});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'M8_L2_Synthesis_Results.md';
                a.click();
                URL.revokeObjectURL(a.href);
            });
        }, 100);

    } else if (status === 'M8_STEP3_WAITING_APPROVAL' && session.grade_evidence_table) {
        const g = session.grade_evidence_table;

        // xAI transparency section (purple left border, collapsible)
        const gradeModel = g.model_used || '';
        const gradePrompt = g.system_prompt || '';
        let xaiSection = '';
        if (gradeModel || gradePrompt) {
            xaiSection = `
            <details style="margin-top:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border-left:3px solid #5eead4;">
                <summary style="cursor:pointer; color:#5eead4; font-weight:bold; font-size:0.85em;"><span class="ico ico-search"></span> xAI: Lihat Model & Prompt GRADE (Kaidah xAI)</summary>
                <div style="margin-top:10px; font-size:0.8em; color:#d6d3d1; max-height:350px; overflow-y:auto;">
                    ${gradeModel ? `<p style="color:#fcd34d; margin-bottom:5px;"><strong><span class="ico ico-ai"></span> LLM Model:</strong> ${gradeModel}</p>` : ''}
                    ${gradePrompt ? `<div><strong style="color:#5eead4;">System Prompt (GRADE Agent):</strong><pre style="white-space:pre-wrap; font-family:monospace; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; margin-top:5px;">${gradePrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>` : ''}
                    ${!gradePrompt ? `<p style="color:#a8a29e; font-style:italic;">Data prompt tidak direkam pada sesi lama.</p>` : ''}
                </div>
            </details>`;
        }

        html = wrapCard('Modul 8 L3 — GRADE Evidence + Robustness', `
            <div style="font-size:0.88em;overflow-x:auto;">${formatMarkdown(g.table_markdown || '')}</div>
            <p style="margin-top:8px;"><strong>Robustness:</strong> <span style="color:#5eead4;">${g.robustness_verdict || '-'}</span></p>
            <p style="font-size:0.88em;color:#d6d3d1;">${g.robustness_summary || ''}</p>
            <details style="margin-top:8px;"><summary style="cursor:pointer;color:#6ee7b7;">Confidence statements</summary><div style="font-size:0.88em;margin-top:6px;">${formatMarkdown(g.confidence_statements || '')}</div></details>
            ${xaiSection}
            <div style="margin-top:12px; text-align:center;">
                <button id="btn-dl-grade-md" class="btn btn-secondary" style="padding:8px 16px; font-size:0.9em;"><span class="ico ico-download"></span> Download Laporan GRADE (Markdown)</button>
            </div>
        `);
        setTimeout(() => {
            const btnDl = document.getElementById('btn-dl-grade-md');
            if (btnDl) btnDl.addEventListener('click', () => {
                let md = `# Modul 8 L3 — GRADE Evidence + Robustness\n\n`;
                md += `## GRADE Evidence Table\n${g.table_markdown || ''}\n\n`;
                md += `## Robustness Verdict: ${g.robustness_verdict || '-'}\n${g.robustness_summary || ''}\n\n`;
                md += `## Confidence Statements\n${g.confidence_statements || ''}\n\n`;
                md += `## xAI: Model & Prompt\n`;
                md += `- Model: ${g.model_used || '-'}\n`;
                md += `- System Prompt: ${g.system_prompt || '-'}\n`;
                const blob = new Blob([md], {type: 'text/markdown'});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'M8_L3_GRADE_Evidence.md';
                a.click();
                URL.revokeObjectURL(a.href);
            });
        }, 100);

    } else if (status === 'M8_STEP4_WAITING_APPROVAL') {
        const sumMd = (session.modul8_summary && session.modul8_summary.markdown) || 'Menunggu data...';
        const ip = (session.interpretation_package && session.interpretation_package.markdown) || '';
        const ipModel = (session.interpretation_package && session.interpretation_package.model_used) || '';
        const ipPrompt = (session.interpretation_package && session.interpretation_package.system_prompt) || '';

        // xAI transparency section (purple left border, collapsible)
        let xaiSection = '';
        if (ipModel || ipPrompt) {
            xaiSection = `
            <details style="margin-top:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border-left:3px solid #5eead4;">
                <summary style="cursor:pointer; color:#5eead4; font-weight:bold; font-size:0.85em;"><span class="ico ico-search"></span> xAI: Lihat Model & Prompt Interpretation (Kaidah xAI)</summary>
                <div style="margin-top:10px; font-size:0.8em; color:#d6d3d1; max-height:350px; overflow-y:auto;">
                    ${ipModel ? `<p style="color:#fcd34d; margin-bottom:5px;"><strong><span class="ico ico-ai"></span> LLM Model:</strong> ${ipModel}</p>` : ''}
                    ${ipPrompt ? `<div><strong style="color:#5eead4;">System Prompt (Interpretation Agent):</strong><pre style="white-space:pre-wrap; font-family:monospace; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; margin-top:5px;">${ipPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>` : ''}
                    ${!ipPrompt ? `<p style="color:#a8a29e; font-style:italic;">Data prompt tidak direkam pada sesi lama.</p>` : ''}
                </div>
            </details>`;
        }

        html = wrapCard('Modul 8 L4 — Interpretation Package & Summary', `
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; font-size: 0.9em; max-height: 320px; overflow-y: auto;">
                ${formatMarkdown(sumMd)}
            </div>
            ${ip ? `<details style="margin-top:10px;"><summary style="cursor:pointer;color:#6ee7b7;font-weight:bold;">Interpretation Package (untuk Modul 9)</summary><div style="font-size:0.88em;margin-top:8px;max-height:300px;overflow-y:auto;">${formatMarkdown(ip)}</div></details>` : ''}
            ${xaiSection}
            <div style="margin-top:12px; text-align:center;">
                <button id="btn-dl-interp-md" class="btn btn-secondary" style="padding:8px 16px; font-size:0.9em;"><span class="ico ico-download"></span> Download Laporan Lengkap (Markdown)</button>
            </div>
            <div style="margin-top: 12px; background: rgba(13, 148, 136, 0.1); border: 1px solid rgba(13, 148, 136, 0.4); border-radius: 8px; padding: 12px 16px;">
                <p style="margin: 0 0 8px 0; font-size: 0.9em; color: #5eead4; font-weight: bold;"><span class="ico ico-chart"></span> Rekomendasi: Jalankan Bibliometric SLNA</p>
                <p style="margin: 0 0 10px 0; font-size: 0.85em; color: #d6d3d1; line-height: 1.5;">Sangat disarankan menjalankan analisis Bibliometric/SLNA (Science Landscape Network Analysis) sebelum lanjut ke Modul 9. SLNA memberikan validasi lintas-metode (triangulasi) terhadap temuan sintesis naratif Anda, memperkuat argumen di bagian Discussion, serta mengidentifikasi research gaps berbasis peta jejaring kolaborasi ilmiah.</p>
                <button id="btn-run-slna" class="btn" style="background:#0d9488;color:#fff;width:100%;padding:10px;font-weight:bold;font-size:0.95em;"><span class="ico ico-chart"></span> Jalankan Bibliometric SLNA (Sangat Direkomendasikan)</button>
            </div>
            <p style="margin-top: 10px; font-size: 0.85em; color:#a8a29e;"><em>Atau klik "Setuju & Lanjut" untuk langsung ke Modul 9 (Manuscript) tanpa SLNA.</em></p>
        `);
        setTimeout(() => {
            const btnDl = document.getElementById('btn-dl-interp-md');
            if (btnDl) btnDl.addEventListener('click', () => {
                let md = `# Modul 8 L4 — Interpretation Package & Summary\n\n`;
                md += `## Modul 8 Summary\n${sumMd}\n\n`;
                md += `## Interpretation Package\n${ip}\n\n`;
                md += `## xAI: Model & Prompt\n`;
                md += `- Model: ${ipModel || '-'}\n`;
                md += `- System Prompt: ${ipPrompt || '-'}\n`;
                const blob = new Blob([md], {type: 'text/markdown'});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'M8_L4_Interpretation_Package.md';
                a.click();
                URL.revokeObjectURL(a.href);
            });
            const b = document.getElementById('btn-run-slna');
            if (b) b.addEventListener('click', async () => {
                if (!confirm('Jalankan Bibliometric SLNA untuk memperkuat triangulasi temuan Anda?')) return;
                try {
                    b.disabled = true; b.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memulai SLNA...';
                    await API.reviseStep(session.id, 'Run Bibliometric SLNA', 'M8B_INIT');
                    window.location.reload();
                } catch (err) { alert('Gagal: ' + err.message); b.disabled = false; b.innerHTML = '<span class="ico ico-chart"></span> Jalankan Bibliometric SLNA (Sangat Direkomendasikan)'; }
            });
        }, 100);

    } else if (status === 'M8B_STEP1_WAITING_APPROVAL' && session.bibliometric_data) {
        const b = session.bibliometric_data;
        html = wrapCard('Modul 8b L1 — Data Prep + Thesaurus', `
            <div style="font-size:0.9em;">${formatMarkdown(b.log_markdown || '')}</div>
            <details style="margin-top:8px;"><summary style="cursor:pointer;color:#6ee7b7;font-weight:bold;">Thesaurus Keywords (format VOSviewer)</summary>
                <pre style="white-space:pre-wrap;font-size:0.8em;background:#0b1220;padding:10px;border-radius:6px;max-height:260px;overflow:auto;">${(b.thesaurus_keywords || '').replace(/</g, '&lt;')}</pre></details>
        `);

    } else if (status === 'M8B_STEP2_WAITING_VOSVIEWER' && session.vosviewer_parameters) {
        const v = session.vosviewer_parameters;
        html = wrapCard('Modul 8b L2 — VOSviewer (9-Parameter) + Input Hasil', `
            <p style="font-size:0.85em;color:#a8a29e;">Jalankan VOSviewer manual: Map based on bibliographic data → terapkan thesaurus → set 9 parameter (tabel) → generate Network/Overlay/Density → export SVG/PNG. Lalu paste ringkasan hasilnya di bawah.</p>
            <div style="font-size:0.88em;overflow-x:auto;">${formatMarkdown(v.table_markdown || '')}</div>
            <hr style="border-color:rgba(255,255,255,0.1);">
            <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:12px;margin-bottom:12px;">
                <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:15px;">
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        <label for="input-scopus-csv" class="btn" style="background:#0f766e;color:#fff;font-weight:bold;white-space:nowrap;cursor:pointer;margin:0;">&#x1F4E4; Upload Scopus CSV (untuk Keywords)</label>
                        <input type="file" id="input-scopus-csv" accept=".csv" style="display:none;">
                        <span id="scopus-csv-status" style="font-size:0.8em;color:#a8a29e;flex:1;">Export CSV dari Scopus &rarr; upload di sini &rarr; keywords otomatis tersimpan</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        <label for="input-ieee-csv" class="btn" style="background:#f59e0b;color:#fff;font-weight:bold;white-space:nowrap;cursor:pointer;margin:0;">&#x1F4E4; Upload IEEE CSV</label>
                        <input type="file" id="input-ieee-csv" accept=".csv" style="display:none;">
                        <span id="ieee-csv-status" style="font-size:0.8em;color:#a8a29e;flex:1;">Export CSV dari IEEE Xplore &rarr; upload di sini &rarr; keywords (Author Keywords + IEEE Terms) tersimpan</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        <label for="input-pubmed-txt" class="btn" style="background:#ec4899;color:#fff;font-weight:bold;white-space:nowrap;cursor:pointer;margin:0;">&#x1F4E4; Upload PubMed TXT</label>
                        <input type="file" id="input-pubmed-txt" accept=".txt" style="display:none;">
                        <span id="pubmed-txt-status" style="font-size:0.8em;color:#a8a29e;flex:1;">Export MEDLINE format dari PubMed &rarr; upload di sini &rarr; keywords (OT + MeSH) tersimpan</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        <button id="btn-download-bibtex" class="btn" style="background:#0d9488;color:#fff;font-weight:bold;white-space:nowrap;">&#x1F4E5; Download RIS (untuk VOSviewer)</button>
                        <span style="font-size:0.8em;color:#a8a29e;flex:1;">Download file .ris berisi semua paper + keywords. Import file ini ke VOSviewer.</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                        <button id="btn-download-thesaurus" class="btn" style="background:#0ea5e9;color:#fff;font-weight:bold;white-space:nowrap;">&#x1F4E5; Download Thesaurus (.txt)</button>
                        <span style="font-size:0.8em;color:#a8a29e;flex:1;">Download file thesaurus untuk merge sinonim keyword di VOSviewer. Load saat setup mapping.</span>
                    </div>
                </div>
                <div style="font-size:0.82em;color:#a7f3d0;">
                    <strong>Langkah-langkah:</strong><br>
                    0. (Opsional) Upload file CSV dari Scopus / IEEE Xplore, atau TXT dari PubMed &rarr; keywords otomatis tersimpan ke database<br>
                    1. Klik "Download RIS" &rarr; simpan file slr_papers.ris<br>
                    2. Buka VOSviewer &rarr; Create Map &rarr; Bibliographic data &rarr; Read from reference manager files &rarr; Tab RIS &rarr; pilih file .ris<br>
                    3. Klik "Download Thesaurus" &rarr; simpan file .txt &rarr; di VOSviewer klik tombol "Thesaurus..." di kiri bawah &rarr; load file<br>
                    4. Set 9-parameter sesuai tabel di atas (Type of analysis, Unit of analysis, Counting method, dll)<br>
                    5. Klik "Next" &rarr; atur threshold minimum occurrences &rarr; Generate network<br>
                    6. Catat hasilnya (total nodes, edges, clusters, top-3 clusters + label, bridge nodes, temporal trend)<br>
                    7. Paste ringkasan hasil di kotak input di bawah
                </div>
            </div>
            <label style="font-size:0.85em;">Paste hasil VOSviewer (nodes, edges, total clusters, top-3 clusters+label, bridge nodes, temporal trend):</label>
            <textarea id="vos-input" rows="6" style="width:100%;margin-top:6px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;padding:8px;" placeholder="Total nodes: ...&#10;Total edges: ...&#10;Clusters: ...&#10;Top-3 clusters: ...&#10;Bridge nodes: ...&#10;Temporal: ..."></textarea>
            <button id="btn-vos-submit" class="btn btn-success" style="margin-top:8px;">Submit Hasil VOSviewer → Interpretasi</button>
        `);
        setTimeout(() => {
            const inputCSV = document.getElementById('input-scopus-csv');
            const csvStatus = document.getElementById('scopus-csv-status');
            if (inputCSV) inputCSV.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const label = inputCSV.previousElementSibling;
                const originalText = label.innerHTML;
                label.style.opacity = '0.6';
                label.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Mengupload...';
                csvStatus.textContent = 'Mengupload dan memproses CSV...';
                try {
                    const url = `${getBaseURL()}/sessions/${session.id}/m8b/upload-scopus-csv`;
                    const token = localStorage.getItem('auth_token');
                    const formData = new FormData();
                    formData.append('file', file);
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + (token || '') },
                        body: formData
                    });
                    if (!resp.ok) {
                        const errData = await resp.json().catch(() => ({}));
                        throw new Error(errData.error || resp.statusText);
                    }
                    const data = await resp.json();
                    label.innerHTML = '&#x2705; CSV Terupload';
                    label.style.background = '#10b981';
                    label.style.opacity = '1';
                    csvStatus.innerHTML = `<strong style="color:#6ee7b7;">&#x2705; ${data.matched} paper matched, ${data.skipped} skipped</strong>`;
                } catch (err) {
                    alert('Gagal upload CSV: ' + err.message);
                    label.innerHTML = originalText;
                    label.style.opacity = '1';
                    csvStatus.textContent = 'Export CSV dari Scopus → upload di sini → keywords otomatis tersimpan';
                }
                inputCSV.value = '';
            });
            // IEEE CSV upload listener
            const inputIEEE = document.getElementById('input-ieee-csv');
            const ieeeStatus = document.getElementById('ieee-csv-status');
            if (inputIEEE) inputIEEE.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const label = inputIEEE.previousElementSibling;
                const originalText = label.innerHTML;
                label.style.opacity = '0.6';
                label.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Mengupload...';
                ieeeStatus.textContent = 'Mengupload dan memproses IEEE CSV...';
                try {
                    const url = `${getBaseURL()}/sessions/${session.id}/m8b/upload-ieee-csv`;
                    const token = localStorage.getItem('auth_token');
                    const formData = new FormData();
                    formData.append('file', file);
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + (token || '') },
                        body: formData
                    });
                    if (!resp.ok) {
                        const errData = await resp.json().catch(() => ({}));
                        throw new Error(errData.error || resp.statusText);
                    }
                    const data = await resp.json();
                    label.innerHTML = '&#x2705; IEEE CSV Terupload';
                    label.style.background = '#10b981';
                    label.style.opacity = '1';
                    ieeeStatus.innerHTML = `<strong style="color:#6ee7b7;">&#x2705; ${data.matched} paper matched, ${data.skipped} skipped</strong>`;
                } catch (err) {
                    alert('Gagal upload IEEE CSV: ' + err.message);
                    label.innerHTML = originalText;
                    label.style.opacity = '1';
                    ieeeStatus.textContent = 'Export CSV dari IEEE Xplore \u2192 upload di sini \u2192 keywords tersimpan';
                }
                inputIEEE.value = '';
            });
            // PubMed TXT upload listener
            const inputPubMed = document.getElementById('input-pubmed-txt');
            const pubmedStatus = document.getElementById('pubmed-txt-status');
            if (inputPubMed) inputPubMed.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const label = inputPubMed.previousElementSibling;
                const originalText = label.innerHTML;
                label.style.opacity = '0.6';
                label.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Mengupload...';
                pubmedStatus.textContent = 'Mengupload dan memproses PubMed TXT...';
                try {
                    const url = `${getBaseURL()}/sessions/${session.id}/m8b/upload-pubmed-txt`;
                    const token = localStorage.getItem('auth_token');
                    const formData = new FormData();
                    formData.append('file', file);
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + (token || '') },
                        body: formData
                    });
                    if (!resp.ok) {
                        const errData = await resp.json().catch(() => ({}));
                        throw new Error(errData.error || resp.statusText);
                    }
                    const data = await resp.json();
                    label.innerHTML = '&#x2705; PubMed TXT Terupload';
                    label.style.background = '#10b981';
                    label.style.opacity = '1';
                    pubmedStatus.innerHTML = `<strong style="color:#6ee7b7;">&#x2705; ${data.matched} paper matched, ${data.skipped} skipped</strong>`;
                } catch (err) {
                    alert('Gagal upload PubMed TXT: ' + err.message);
                    label.innerHTML = originalText;
                    label.style.opacity = '1';
                    pubmedStatus.textContent = 'Export MEDLINE format dari PubMed \u2192 upload di sini \u2192 keywords tersimpan';
                }
                inputPubMed.value = '';
            });
            const btnBib = document.getElementById('btn-download-bibtex');
            if (btnBib) btnBib.addEventListener('click', async () => {
                const originalText = btnBib.innerHTML;
                btnBib.disabled = true;
                btnBib.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Mengunduh RIS...';
                try {
                    const url = `${getBaseURL()}/sessions/${session.id}/m8b/export-ris`;
                    const token = localStorage.getItem('auth_token');
                    const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + (token || '') } });
                    if (!resp.ok) throw new Error('Download failed: ' + resp.statusText);
                    const blob = await resp.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const dl = document.createElement('a');
                    dl.href = blobUrl;
                    dl.download = 'slr_papers.ris';
                    document.body.appendChild(dl);
                    dl.click();
                    document.body.removeChild(dl);
                    URL.revokeObjectURL(blobUrl);
                    btnBib.innerHTML = '✅ RIS Terunduh';
                    btnBib.style.background = '#10b981';
                } catch (err) {
                    alert('Download gagal: ' + err.message);
                    btnBib.innerHTML = originalText;
                    btnBib.disabled = false;
                }
            });
            const btnThes = document.getElementById('btn-download-thesaurus');
            if (btnThes) btnThes.addEventListener('click', () => {
                const thesData = (session.bibliometric_data && session.bibliometric_data.thesaurus_keywords) || '';
                if (!thesData) { alert('Thesaurus belum tersedia. Jalankan Step 1 dulu.'); return; }
                const header = 'label\treplace by';
                const content = thesData.trimStart().startsWith('label\treplace by') ? thesData : header + '\n' + thesData;
                const blob = new Blob([content], {type: 'text/plain'});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'thesaurus_vosviewer.txt';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
                btnThes.innerHTML = '✅ Thesaurus Terunduh';
                btnThes.style.background = '#10b981';
                btnThes.disabled = true;
            });
            const btn = document.getElementById('btn-vos-submit');
            if (btn) btn.addEventListener('click', async () => {
                const data = (document.getElementById('vos-input').value || '').trim();
                if (!data) { alert('Paste hasil VOSviewer dulu!'); return; }
                try {
                    btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memproses...';
                    await API.submitVOSviewer(session.id, data);
                    window.location.reload();
                } catch (err) { alert('Gagal: ' + err.message); btn.disabled = false; btn.textContent = 'Submit Hasil VOSviewer → Interpretasi'; }
            });
        }, 0);

    } else if (status === 'M8B_STEP3_WAITING_APPROVAL' && session.cluster_interpretation) {
        const c = session.cluster_interpretation;
        html = wrapCard('Modul 8b L3 — Cluster Interpretation (Tier 1-4)', `
            <div style="font-size:0.88em;overflow-x:auto;">${formatMarkdown(c.table_markdown || '')}</div>
            <details style="margin-top:8px;"><summary style="cursor:pointer;color:#6ee7b7;">Interpretasi naratif + bridge + structural holes</summary>
                <div style="font-size:0.88em;margin-top:6px;">${formatMarkdown(c.markdown || '')}</div></details>
        `);

    } else if (status === 'M8B_STEP4_WAITING_APPROVAL') {
        const sumMd = (session.modul_bibliometric_summary && session.modul_bibliometric_summary.markdown) || 'Menunggu data...';
        const ig = session.slna_integration || {};
        html = wrapCard('Modul 8b L4 — SLNA Integration & Summary', `
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; font-size: 0.9em; max-height: 320px; overflow-y: auto;">${formatMarkdown(sumMd)}</div>
            ${ig.convergent_gaps ? `<details style="margin-top:10px;"><summary style="cursor:pointer;color:#fbbf24;font-weight:bold;">Convergent Gaps (Future Research)</summary><div style="font-size:0.88em;margin-top:8px;">${formatMarkdown(ig.convergent_gaps)}</div></details>` : ''}
            <p style="margin-top: 10px; font-size: 0.9em; color:#4ade80;"><em>Setujui untuk menutup Modul 8b dan lanjut ke Modul 9.</em></p>
        `);

    } else if (status === 'M9_GROUPA_WAITING_APPROVAL' && session.manuscript) {
        const ms = session.manuscript;
        const sec = (t, c) => `<details style="margin-top:8px;"><summary style="cursor:pointer;color:#5eead4;font-weight:bold;">${t} (${(c || '').length} char)</summary><div style="font-size:0.88em;margin-top:6px;max-height:340px;overflow:auto;">${formatMarkdown(c || '(kosong)')}</div></details>`;
        html = wrapCard('Modul 9 — Draft Grup A (Methods · Results · Discussion · Future Research)', `
            ${correctionsAuditHtml(session)}
            <div style="background:rgba(13, 148, 136,0.08);border:1px solid rgba(13, 148, 136,0.3);border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:0.82em;color:#5eead4;">
                <strong><span class="ico ico-ai"></span> xAI Info:</strong> Hasil ditulis oleh model Brain (lihat Pengaturan → Model Routing). Proses: 3-pass per section (Draft → Verification → Style Cleanup). Jika output tidak ada \\cite{}, kemungkinan model kurang capable — ganti Brain ke GPT-4o/Claude Sonnet/Gemini Pro.
            </div>
            ${renderClaimVerify(ms)}
            ${sec('Methods', ms.methods)}${sec('Results', ms.results)}${sec('Discussion', ms.discussion)}${sec('Future Research', ms.future_research)}
            <p style="margin-top:10px;font-size:0.9em;color:#4ade80;"><em>Approve untuk lanjut menulis Introduction/Conclusions/Abstract/Title; atau revisi untuk tulis ulang grup ini.</em></p>
        `);

    } else if (status === 'M9_GROUPB_WAITING_APPROVAL' && session.manuscript) {
        const ms = session.manuscript;
        const sec = (t, c) => `<details style="margin-top:8px;"><summary style="cursor:pointer;color:#5eead4;font-weight:bold;">${t} (${(c || '').length} char)</summary><div style="font-size:0.88em;margin-top:6px;max-height:340px;overflow:auto;">${formatMarkdown(c || '(kosong)')}</div></details>`;
        html = wrapCard('Modul 9 — Draft Grup B (Introduction · Conclusions · Abstract · Title)', `
            <div style="background:rgba(13, 148, 136,0.08);border:1px solid rgba(13, 148, 136,0.3);border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:0.82em;color:#5eead4;">
                <strong><span class="ico ico-ai"></span> xAI Info:</strong> Hasil ditulis oleh model Brain (lihat Pengaturan → Model Routing). Proses: 3-pass per section (Draft → Verification → Style Cleanup). Jika output tidak ada \\cite{}, kemungkinan model kurang capable — ganti Brain ke GPT-4o/Claude Sonnet/Gemini Pro.
            </div>
            ${renderClaimVerify(ms)}
            ${sec('Introduction', ms.introduction)}${sec('Conclusions', ms.conclusions)}${sec('Abstract', ms.abstract)}${sec('Title (alternatif)', ms.title)}
            <p style="margin-top:10px;font-size:0.9em;color:#4ade80;"><em>Approve untuk compile akhir (references Crossref + audit + PRISMA + .tex).</em></p>
        `);

    } else if (status === 'M10_STEP1_WAITING_APPROVAL' && session.audit_report) {
        const rep = session.audit_report;
        html = wrapCard('Modul 10 — Audit Pra-Submisi & Defensibility Gate', renderAuditReport(rep));
        setTimeout(() => {
            const wire = (id, name, content) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('click', () => {
                    const blob = new Blob([content || ''], { type: 'text/markdown;charset=utf-8' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = name;
                    document.body.appendChild(a); a.click();
                    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 0);
                });
            };
            wire('dl-protocol', `protokol_${session.id}.md`, rep.protocol_markdown);
            wire('dl-repro', `reproducibility_${session.id}.md`, rep.repro_package_markdown);
            const btnFix = document.getElementById('btn-m10-fix-errors');
            if (btnFix) {
                btnFix.addEventListener('click', async () => {
                    setButtonLoading(btnFix, true);
                    try {
                        const r = await API.fixQAErrors(session.id);
                        showToast(`Menilai ulang ${r.error_papers || ''} studi ERROR… pantau Live Log.`, 'success');
                        // status berubah ke M10_STEP1_FIXING_ERRORS → tracker poll akan tampilkan spinner,
                        // lalu audit dijalankan ulang otomatis.
                    } catch (e) {
                        setButtonLoading(btnFix, false, '<span class="ico ico-repeat"></span> Rate Ulang Studi ERROR');
                        showToast('Gagal: ' + e.message, 'error');
                    }
                });
            }
        }, 0);

    } else if (status === 'M9_COMPILE_WAITING_APPROVAL' && session.manuscript) {
        const ms = session.manuscript;
        html = wrapCard('Modul 9 — Compile Final (manuscript_final + .tex + .bib)', `
            ${correctionsAuditHtml(session)}
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                <button id="dl-tex" class="btn" style="background:#0d9488;color:#fff;font-weight:bold;"><span class="ico ico-import"></span> Download LaTeX (.tex)</button>
                <button id="dl-bib" class="btn" style="background:#0d9488;color:#fff;font-weight:bold;"><span class="ico ico-import"></span> Download BibTeX (.bib)</button>
                <button id="dl-final" class="btn" style="background:#10b981;color:#fff;font-weight:bold;"><span class="ico ico-import"></span> Download Markdown (.md)</button>
            </div>
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; font-size: 0.88em; max-height: 360px; overflow-y: auto;">${formatMarkdown(ms.final || 'Menunggu data...')}</div>
            <details style="margin-top:10px;border:1px solid rgba(99,102,241,0.3);border-radius:6px;padding:8px;">
                <summary style="cursor:pointer;color:#a5b4fc;font-weight:bold;"><span class="ico ico-ai"></span> xAI: 3-Pass Compilation Pipeline</summary>
                <div style="font-size:0.85em;margin-top:8px;color:#d6d3d1;line-height:1.6;">
                    <p><strong>Pass 1 — Draft Generation:</strong> AI generates each manuscript section (Methods, Results, Discussion, Future Research) independently based on extracted data, synthesis results, and research questions.</p>
                    <p style="margin-top:6px;"><strong>Pass 2 — Integration & Coherence:</strong> All sections are merged into a single document. A coherence audit checks logical flow, citation consistency, and cross-reference integrity across sections.</p>
                    <p style="margin-top:6px;"><strong>Pass 3 — Final Compilation:</strong> The integrated manuscript is compiled into LaTeX (.tex) with proper academic formatting, BibTeX (.bib) references are generated from Crossref metadata, and a PRISMA 2020 checklist is produced for transparency reporting.</p>
                </div>
            </details>
            <details style="margin-top:8px;border:1px solid rgba(110,231,183,0.3);border-radius:6px;padding:8px;">
                <summary style="cursor:pointer;color:#6ee7b7;font-weight:bold;">✅ Coherence Audit</summary>
                <div style="font-size:0.85em;margin-top:6px;max-height:300px;overflow:auto;">${formatMarkdown(ms.coherence_audit || '(Belum tersedia)')}</div>
            </details>
            <details style="margin-top:6px;border:1px solid rgba(110,231,183,0.3);border-radius:6px;padding:8px;">
                <summary style="cursor:pointer;color:#6ee7b7;font-weight:bold;"><span class="ico ico-copy"></span> PRISMA 2020 Checklist</summary>
                <div style="font-size:0.85em;margin-top:6px;max-height:300px;overflow:auto;">${formatMarkdown(ms.prisma_checklist || '(Belum tersedia)')}</div>
            </details>
            <p style="margin-top:10px;font-size:0.9em;color:#4ade80;"><em>Approve untuk menutup pipeline (COMPLETED).</em></p>
        `);
        setTimeout(() => {
            const token = localStorage.getItem('auth_token');
            const baseUrl = getBaseURL();

            // Download .tex via API
            const btnTex = document.getElementById('dl-tex');
            if (btnTex) btnTex.addEventListener('click', async () => {
                const originalText = btnTex.innerHTML;
                btnTex.disabled = true;
                btnTex.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Mengunduh .tex...';
                try {
                    const resp = await fetch(`${baseUrl}/sessions/${session.id}/manuscript/download-tex`, {
                        headers: { 'Authorization': 'Bearer ' + (token || '') }
                    });
                    if (!resp.ok) throw new Error('Download failed: ' + resp.statusText);
                    const blob = await resp.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = 'manuscript_final.tex';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                    btnTex.innerHTML = '✅ LaTeX Terunduh';
                    btnTex.style.background = '#10b981';
                } catch (err) {
                    alert('Download .tex gagal: ' + err.message);
                    btnTex.innerHTML = originalText;
                    btnTex.disabled = false;
                }
            });

            // Download .bib via API
            const btnBib = document.getElementById('dl-bib');
            if (btnBib) btnBib.addEventListener('click', async () => {
                const originalText = btnBib.innerHTML;
                btnBib.disabled = true;
                btnBib.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Mengunduh .bib...';
                try {
                    const resp = await fetch(`${baseUrl}/sessions/${session.id}/manuscript/download-bib`, {
                        headers: { 'Authorization': 'Bearer ' + (token || '') }
                    });
                    if (!resp.ok) throw new Error('Download failed: ' + resp.statusText);
                    const blob = await resp.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = 'reference.bib';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                    btnBib.innerHTML = '✅ BibTeX Terunduh';
                    btnBib.style.background = '#10b981';
                } catch (err) {
                    alert('Download .bib gagal: ' + err.message);
                    btnBib.innerHTML = originalText;
                    btnBib.disabled = false;
                }
            });

            // Download .md (from local manuscript data as blob)
            const btnFinal = document.getElementById('dl-final');
            if (btnFinal) btnFinal.addEventListener('click', async () => {
                const originalText = btnFinal.innerHTML;
                btnFinal.disabled = true;
                btnFinal.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Mengunduh .md...';
                try {
                    const content = ms.final || '';
                    if (!content) throw new Error('Manuscript final belum tersedia');
                    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = 'manuscript_final.md';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                    btnFinal.innerHTML = '✅ Markdown Terunduh';
                    btnFinal.style.background = '#059669';
                } catch (err) {
                    alert('Download .md gagal: ' + err.message);
                    btnFinal.innerHTML = originalText;
                    btnFinal.disabled = false;
                }
            });
        }, 0);
    }

    if (html !== '') {
        area.insertAdjacentHTML('beforeend', html);

        // States yang sudah merender tombol aksinya sendiri di dalam kartu.
        // Jangan tambahkan blok generik "Setuju & Lanjut" (backend tidak
        // menangani approve polos untuk state ini -- hanya retry/force-proceed).
        const SELF_CONTAINED_STATES = ['M7_STEP3_QA_CALIBRATION_LOW_KAPPA'];
        if (SELF_CONTAINED_STATES.includes(status)) {
            return true;
        }

        let extraBtn = '';
        let isDanger = false;
        let isHalted = false;
        
        // Special warning for M4_STEP2
        if (status === 'M4_STEP2_WAITING_APPROVAL') {
            if (session.data_mining_log?.pico_preview?.verdict?.includes('BACK')) {
                isDanger = true;
                extraBtn = `<button id="btn-revise-m2" class="btn btn-danger" style="margin-right: 0.5rem;">Kembali ke Modul 2 (Revisi PICO)</button>`;
                extraBtn += `<button id="btn-generic-revise" class="btn btn-danger">Kembali ke Modul 3 (Revisi Kueri)</button>`;
            }
            if (session.data_mining_log?.pico_preview?.verdict === 'HALTED_MISSING_DATA') {
                isDanger = true;
                isHalted = true;
            }
            extraBtn += ` <button id="btn-reimport" class="btn btn-warning">Ulangi Import CSV</button>`;
        }
        
        let picoHaltMsg = '';
        if (status === 'M5_STEP4_WAITING_APPROVAL') {
            extraBtn = `<button id="btn-m5-retry-step4" class="btn btn-warning" style="margin-right: 0.5rem;">Ulangi Pembuatan Rangkuman (Retry LLM)</button>`;
            extraBtn += `<button id="btn-m5-reaudit" class="btn btn-warning" style="margin-right: 0.5rem;"><span class="ico ico-repeat"></span> Audit Ulang (PICO, cakupan penuh)</button>`;
            // Hide the generic "Setuju & Lanjut" while PICO-audit corrections are pending;
            // closing is gated server-side, this keeps the UI honest.
            const paPending = ((session.pico_audit_log && session.pico_audit_log.slipped) || []).some(s => !s.actioned);
            if (paPending) {
                isHalted = true;
                isDanger = true;
                picoHaltMsg = 'PICO audit menandai paper salah-INCLUDE. Selesaikan panel "Koreksi PICO Audit" di atas (EXCLUDE/KEEP) sebelum Modul 5 ditutup.';
            }
        }

        if (status.endsWith('_WAITING_EMBED')) {
            isDanger = true;
            isHalted = true; // sembunyikan "Setuju & Lanjut" generik; pakai tombol simpan-endpoint
            extraBtn = `<button id="btn-embed-save" class="btn btn-success"><span class="ico ico-save"></span> Simpan Endpoint & Lanjut</button>`;
        }

        if (status === 'M7_STEP2_WAITING_APPROVAL') {
            extraBtn = `<button id="btn-m7-reextract-failed" class="btn btn-secondary" style="margin-right: 0.5rem;"><span class="ico ico-repeat"></span> Ekstrak Ulang Paper Gagal/Kosong</button>`
                + `<button id="btn-m7-revise" class="btn btn-warning" style="margin-right: 0.5rem;"><span class="ico ico-warn"></span> Refine Protocol & Ekstrak Ulang (Revisi)</button>`;
        }
        
        if (status === 'M5_STEP3_WAITING_RESOLUTION') {
            isDanger = true;
            isHalted = true;
            const bLog = session.screening_results_log ? session.screening_results_log[session.screening_results_log.length-1] : null;
            const hasDisagreements = bLog && bLog.disagreement_cases > 0;
            const btnText = hasDisagreements ? 'Simpan Keputusan & Lanjutkan' : 'Lanjut Batch Berikutnya / Selesai';
            extraBtn = `<button id="btn-m5-approve" class="btn btn-success">${btnText}</button>
                        <button id="btn-m5-retry-batch" class="btn btn-danger"><span class="ico ico-warn"></span> Ulangi Batch Ini (Hapus & Eksekusi Ulang)</button>`;
        }

        // Backward escape hatch: re-open Module 5 screening from any downstream module
        // gate (M6-M9) to resolve UNCERTAIN records or change inclusion decisions. This
        // invalidates the M6-M9 artifacts (manuscript dibuang; diregenerasi otomatis
        // setelah skrining ditutup ulang).
        const _mNum = parseInt((status.match(/^M(\d+)/) || [])[1], 10);
        if (_mNum >= 6 && _mNum <= 9 && status.includes('WAITING')) {
            extraBtn += ` <button id="btn-back-to-m5" class="btn btn-danger" style="margin-left:0.5rem;"><span class="ico ico-back"></span> Kembali ke Modul 5 (Resolusi Skrining)</button>`;
        }

        let warningText = 'Apakah Anda setuju dengan hasil di atas?';
        if (picoHaltMsg) {
            warningText = picoHaltMsg;
        } else if (isHalted) {
            warningText = status === 'M4_STEP2_WAITING_APPROVAL' ? 'Anda diwajibkan untuk mengulangi import CSV.' : 'Perhatian: Ada indikasi kegagalan AI. Anda bisa mengulangi batch atau melanjutkannya.';
        }
        
        area.insertAdjacentHTML('beforeend', `
            <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 4px solid ${isDanger ? '#ef4444' : '#0d9488'};">
                <p style="margin-bottom: 1rem;"><strong>Tindakan Anda:</strong> ${warningText}</p>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    ${!isHalted ? `<button id="btn-generic-approve" class="btn btn-success">Setuju & Lanjut</button>` : ''}
                    ${extraBtn}
                </div>
            </div>
        `);
        
        setTimeout(() => {
            // HITL re-code alasan eksklusi full-text (M6_STEP3) — rapikan tabel PRISMA.
            const btnLoadRecode = document.getElementById('btn-load-recode');
            if (btnLoadRecode) {
                btnLoadRecode.addEventListener('click', async () => {
                    btnLoadRecode.disabled = true; btnLoadRecode.textContent = 'Memuat...';
                    try {
                        const data = await API.getExcludedFulltext(session.id);
                        const codes = (data.reason_codes && data.reason_codes.length) ? data.reason_codes
                            : ['P-NOMATCH','I-NOMATCH','C-NOMATCH','O-NOMATCH','S-NOMATCH','STUDY-DESIGN','DATE-NOMATCH','LANGUAGE','DUPLICATE','OTHER'];
                        const papers = data.papers || [];
                        const cont = document.getElementById('recode-container');
                        if (!papers.length) { cont.innerHTML = '<span style="color:#4ade80;">Tidak ada paper EXCLUDE tahap full-text.</span>'; return; }
                        const esc = (s) => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        cont.innerHTML = papers.map((p, i) => {
                            const opts = codes.map(c => `<option value="${c}" ${c === p.reason_code ? 'selected' : ''}>${c}</option>`).join('');
                            return `<div data-paperid="${p.paper_id}" style="padding:8px;border-bottom:1px solid rgba(255,255,255,0.08);">
                                <div style="color:#e5e7eb;"><strong>${i + 1}.</strong> ${esc(p.title) || '(tanpa judul)'} <span style="color:#64748b;font-size:0.85em;">${esc(p.doi)}</span></div>
                                <div style="color:#a8a29e;font-size:0.9em;margin:3px 0;">Bukti: ${esc(p.evidence) || '(tak ada)'}</div>
                                <label style="color:#d6d3d1;">Kode: <select class="recode-sel" style="background:#1c1917;color:#fff;border:1px solid #44403c;border-radius:4px;padding:3px;">${opts}</select></label>
                                <div class="recode-rationale" style="color:#fcd34d;font-size:0.82em;margin-top:4px;"></div>
                            </div>`;
                        }).join('') + `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                                <button id="btn-ai-suggest" class="btn" style="background:#0d9488;color:#fff;"><span class="ico ico-ai"></span> Sarankan Kode (AI)</button>
                                <button id="btn-save-recode" class="btn btn-success"><span class="ico ico-save"></span> Simpan Re-code & Susun Ulang</button>
                            </div>
                            <p style="color:#a8a29e;font-size:0.8em;margin-top:6px;">AI mengusulkan kode + alasannya; Anda tinggal terima atau ubah, lalu Simpan.</p>`;
                        document.getElementById('btn-ai-suggest').addEventListener('click', async () => {
                            const btnAI = document.getElementById('btn-ai-suggest');
                            if (btnAI.disabled) return;                 // anti dobel-klik
                            btnAI.disabled = true; btnAI.textContent = '🤖 Memulai...';
                            const resetBtn = () => { btnAI.disabled = false; btnAI.textContent = '🤖 Sarankan Kode (AI)'; };
                            const applyAndFinish = (suggestions, model) => {
                                const map = {};
                                (suggestions || []).forEach(s => { map[s.paper_id] = s; });
                                let n = 0;
                                document.querySelectorAll('#recode-container [data-paperid]').forEach(div => {
                                    const s = map[div.getAttribute('data-paperid')];
                                    if (!s) return;
                                    const sel = div.querySelector('.recode-sel');
                                    if (s.suggested_code && [...sel.options].some(o => o.value === s.suggested_code)) { sel.value = s.suggested_code; n++; }
                                    const rat = div.querySelector('.recode-rationale');
                                    if (rat) rat.textContent = s.suggested_code ? `🤖 Saran (via ${s.model || model || 'AI'}): ${s.suggested_code} — ${s.rationale || ''}` : '';
                                });
                                if (n) showToast(`✅ ${n} saran diterapkan${model ? ' via ' + model : ''}. Tinjau lalu Simpan.`);
                                else showToast('AI tidak mengembalikan saran (cek role/kuota Auditor).', 'error');
                                resetBtn();
                            };
                            try {
                                const start = await API.suggestRecodes(session.id);
                                if (start && start.started === false) { showToast('Tidak ada paper EXCLUDE untuk dianalisis.', 'error'); resetBtn(); return; }
                                const total = (start && start.total) || 0;
                                showToast(`🤖 AI menganalisis ${total} paper — lihat progres di Live Log.`);
                                const poll = async () => {
                                    try {
                                        const r = await API.getRecodeResult(session.id);
                                        if (!r.found) { setTimeout(poll, 2000); return; }
                                        if (!r.done) { btnAI.textContent = `🤖 ${r.progress || 0}/${r.total || total}...`; setTimeout(poll, 2000); return; }
                                        applyAndFinish(r.suggestions, r.model);
                                    } catch (e) { showToast('Gagal cek hasil AI: ' + e.message, 'error'); resetBtn(); }
                                };
                                setTimeout(poll, 1500);
                            } catch (e) { showToast('Gagal mulai saran AI: ' + e.message, 'error'); resetBtn(); }
                        });
                        document.getElementById('btn-save-recode').addEventListener('click', async () => {
                            const recodes = [];
                            document.querySelectorAll('#recode-container [data-paperid]').forEach(div => {
                                recodes.push({ paper_id: div.getAttribute('data-paperid'), reason_code: div.querySelector('.recode-sel').value });
                            });
                            const btnS = document.getElementById('btn-save-recode');
                            btnS.disabled = true; btnS.textContent = 'Menyimpan...';
                            try {
                                await API.recodeExclusions(session.id, recodes);
                                alert('Re-code disimpan. Menyusun ulang ringkasan Modul 6...');
                                window.location.reload();
                            } catch (e) { alert('Gagal menyimpan: ' + e.message); btnS.disabled = false; btnS.innerHTML = '<span class="ico ico-save"></span> Simpan Re-code & Susun Ulang'; }
                        });
                    } catch (e) { alert('Gagal memuat: ' + e.message); }
                    finally { btnLoadRecode.disabled = false; btnLoadRecode.textContent = 'Muat Daftar Eksklusi'; }
                });
            }

            const btnApprove = document.getElementById('btn-generic-approve');
            if (btnApprove) {
                btnApprove.addEventListener('click', async () => {
                    setButtonLoading(btnApprove, true);
                    try {
                        await handleApproval({});
                    } catch(e) {
                        setButtonLoading(btnApprove, false, 'Setuju & Lanjut');
                    }
                });
            }

            const btnEmbedSave = document.getElementById('btn-embed-save');
            if (btnEmbedSave) {
                btnEmbedSave.addEventListener('click', async () => {
                    const endpoint = (document.getElementById('embed-endpoint')?.value || '').trim();
                    const apiKey = (document.getElementById('embed-key')?.value || '').trim();
                    const model = (document.getElementById('embed-model')?.value || '').trim();
                    const msg = document.getElementById('embed-msg');
                    if (!endpoint) {
                        if (msg) { msg.style.color = '#fca5a5'; msg.textContent = 'EMBED_ENDPOINT wajib diisi.'; }
                        return;
                    }
                    btnEmbedSave.disabled = true;
                    if (msg) { msg.style.color = '#a8a29e'; msg.textContent = 'Menyimpan endpoint & melanjutkan...'; }
                    try {
                        await API.updateEmbedConfig({ endpoint, api_key: apiKey, model });
                        await handleApproval({}); // resume: WAITING_EMBED -> FULLTEXT_SCREENING + jalankan
                    } catch (e) {
                        btnEmbedSave.disabled = false;
                        if (msg) { msg.style.color = '#ef4444'; msg.textContent = 'Gagal: ' + e.message; }
                    }
                });
            }
            
            const btnM5Approve = document.getElementById('btn-m5-approve');
            if (btnM5Approve) {
                btnM5Approve.addEventListener('click', async () => {
                    const forms = document.querySelectorAll('.conflict-resolution-form');
                    const resolutions = [];
                    for (const form of forms) {
                        const pid = form.getAttribute('data-paperid');
                        const rb = form.querySelector(`input[name="fd_${pid}"]:checked`);
                        const ta = form.querySelector('.cr-notes');
                        if (!rb) {
                            alert("Mohon pilih INCLUDE atau EXCLUDE untuk semua kasus konflik!");
                            return;
                        }
                        if (!ta.value.trim()) {
                            alert("Mohon isi kolom catatan pada semua kasus resolusi konflik!");
                            return;
                        }
                        resolutions.push({
                            paper_id: pid,
                            final_decision: rb.value,
                            conflict_resolution: ta.value.trim()
                        });
                    }
                    if (resolutions.length > 0) {
                        try {
                            btnM5Approve.disabled = true;
                            btnM5Approve.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Menyimpan...';
                            await API.resolveConflicts(session.id, { resolutions });
                            window.location.reload();
                        } catch (err) {
                            alert("Gagal menyimpan resolusi: " + err.message);
                            btnM5Approve.disabled = false;
                            btnM5Approve.innerHTML = 'Simpan Keputusan & Lanjutkan';
                        }
                    } else {
                        // Jika tidak ada form (semua sudah disepakati)
                        setButtonLoading(btnM5Approve, true);
                        try {
                            await handleApproval({});
                        } catch(e) {
                            setButtonLoading(btnM5Approve, false, 'Simpan Keputusan & Lanjutkan');
                        }
                    }
                });
            }

            const btnBackToM5 = document.getElementById('btn-back-to-m5');
            if (btnBackToM5) {
                btnBackToM5.addEventListener('click', async () => {
                    if (!confirm("Kembali ke Modul 5 akan MEMBATALKAN hasil Modul 6-9 (termasuk draft manuskrip) dan mengharuskan regenerasi setelah skrining diselesaikan. Lanjutkan?")) return;
                    const reason = prompt("Alasan kembali ke Modul 5 (mis. menyelesaikan record UNCERTAIN agar PRISMA lengkap, atau mengubah keputusan inklusi):", "Menyelesaikan record UNCERTAIN agar PRISMA lengkap.");
                    if (reason === null) return;
                    try {
                        btnBackToM5.disabled = true;
                        btnBackToM5.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memproses...';
                        await API.reviseStep(session.id, reason, 'M5_STEP3_WAITING_RESOLUTION');
                        window.location.reload();
                    } catch (err) {
                        alert("Gagal kembali ke Modul 5: " + err.message);
                        btnBackToM5.disabled = false;
                        btnBackToM5.innerHTML = '↩ Kembali ke Modul 5 (Resolusi Skrining)';
                    }
                });
            }

            // Self-heal hemat: re-extract HANYA paper gagal/kosong (ERROR/EMPTY_RESULT/
            // NO_FULLTEXT_RAG/coverage kosong) — paper baik dipertahankan (tanpa re-approve
            // framework, tanpa 13 menit re-extract semua, hemat kuota LLM).
            const btnM7ReextractFailed = document.getElementById('btn-m7-reextract-failed');
            if (btnM7ReextractFailed) {
                btnM7ReextractFailed.addEventListener('click', async () => {
                    if (!confirm("Ekstrak ulang HANYA paper yang gagal/kosong (ERROR / hasil kosong / tanpa full-text)? Paper yang sudah baik dipertahankan.")) return;
                    try {
                        btnM7ReextractFailed.disabled = true;
                        btnM7ReextractFailed.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memproses...';
                        await API.reviseStep(session.id, 'Re-extract paper gagal/kosong', 'M7_STEP2_REEXTRACT_FAILED');
                        window.location.reload();
                    } catch (err) {
                        alert("Gagal re-extract: " + err.message);
                        btnM7ReextractFailed.disabled = false;
                        btnM7ReextractFailed.innerHTML = '<span class="ico ico-repeat"></span> Ekstrak Ulang Paper Gagal/Kosong';
                    }
                });
            }

            const btnM7Revise = document.getElementById('btn-m7-revise');
            if (btnM7Revise) {
                btnM7Revise.addEventListener('click', async () => {
                    const reason = prompt("Masukkan detail keluhan instruksi Anda agar AI bisa merevisi Protokol Ekstraksi secara lebih akurat:", "Banyak data yang salah tangkap. Mohon perjelas protokol ekstraksi dan ulangi proses.");
                    if (reason !== null) {
                        try {
                            btnM7Revise.disabled = true;
                            btnM7Revise.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memproses...';
                            await API.reviseStep(session.id, reason, "M7_STEP1_NEEDS_REVISION");
                            window.location.reload();
                        } catch (err) {
                            alert("Gagal revisi: " + err.message);
                            btnM7Revise.disabled = false;
                            btnM7Revise.textContent = '⚠️ Refine Protocol & Ekstrak Ulang (Revisi)';
                        }
                    }
                });
            }
            
            const btnM7RetryQA = document.getElementById('btn-m7-retry-qa');
            if (btnM7RetryQA) {
                btnM7RetryQA.addEventListener('click', async () => {
                    if (confirm("Apakah Anda yakin ingin mengevaluasi ulang semua studi yang berstatus ERROR?")) {
                        try {
                            btnM7RetryQA.disabled = true;
                            btnM7RetryQA.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memproses ulang...';
                            await API.reviseStep(session.id, "Retry failed QA ratings", "M7_STEP3_QA");
                            window.location.reload();
                        } catch (err) {
                            alert("Gagal mengulangi QA: " + err.message);
                            btnM7RetryQA.disabled = false;
                            btnM7RetryQA.innerHTML = '<span class="ico ico-refresh"></span> Ulangi Penilaian QA untuk Studi yang ERROR';
                        }
                    }
                });
            }

            const btnM5RetryStep4 = document.getElementById('btn-m5-retry-step4');
            if (btnM5RetryStep4) {
                btnM5RetryStep4.addEventListener('click', async () => {
                    if (confirm("Yakin ingin mengulangi proses pembuatan Laporan (termasuk audit LLM)?")) {
                        try {
                            btnM5RetryStep4.disabled = true;
                            btnM5RetryStep4.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memproses...';
                            await API.reviseStep(session.id, "Retry Step 4 LLM Generation", "M5_STEP4_REVIEW_HASIL");
                            window.location.reload();
                        } catch (err) {
                            alert("Gagal retry Step 4: " + err.message);
                            btnM5RetryStep4.disabled = false;
                            btnM5RetryStep4.textContent = 'Ulangi Pembuatan Rangkuman (Retry LLM)';
                        }
                    }
                });
            }

            const btnM5Reaudit = document.getElementById('btn-m5-reaudit');
            if (btnM5Reaudit) {
                btnM5Reaudit.addEventListener('click', async () => {
                    if (confirm("Audit ulang akan menjalankan kembali PICO-consistency audit atas SEMUA paper INCLUDE saat ini (memakai LLM, cakupan penuh). Lanjutkan?")) {
                        try {
                            btnM5Reaudit.disabled = true;
                            btnM5Reaudit.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Mengaudit ulang...';
                            await API.rerunPICOAudit(session.id);
                            window.location.reload();
                        } catch (err) {
                            alert("Gagal audit ulang: " + err.message);
                            btnM5Reaudit.disabled = false;
                            btnM5Reaudit.innerHTML = '<span class="ico ico-repeat"></span> Audit Ulang (PICO, cakupan penuh)';
                        }
                    }
                });
            }

            const btnM5Retry = document.getElementById('btn-m5-retry-batch');
            if (btnM5Retry) {
                btnM5Retry.addEventListener('click', async () => {
                    if (confirm("Apakah Anda yakin ingin menghapus data batch ini dan memanggil ulang AI (Zhipu & Groq) untuk 20 paper ini?")) {
                        try {
                            btnM5Retry.disabled = true;
                            btnM5Retry.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memuat Ulang Batch...';
                            await API.reviseStep(session.id, "Re-run batch due to AI failure", "M5_STEP3_BATCH_SCREENING");
                            window.location.reload();
                        } catch (err) {
                            alert("Gagal memuat ulang batch: " + err.message);
                            btnM5Retry.disabled = false;
                            btnM5Retry.innerHTML = '⚠️ Ulangi Batch Ini (Hapus & Eksekusi Ulang)';
                        }
                    }
                });
            }
            
            const btnReimport = document.getElementById('btn-reimport');
            if (btnReimport) {
                btnReimport.addEventListener('click', async () => {
                    const ok = confirm("Yakin ingin mengulang import CSV? Semua hasil audit saat ini akan direset.");
                    if (ok) {
                        try {
                            btnReimport.textContent = "Memproses...";
                            btnReimport.disabled = true;
                            await API.reimportData(session.id);
                            window.location.reload();
                        } catch(err) {
                            alert("Gagal re-import: " + err.message);
                            btnReimport.textContent = "Ulangi Import CSV";
                            btnReimport.disabled = false;
                        }
                    }
                });
            }
            
            const btnReviseM2 = document.getElementById('btn-revise-m2');
            if (btnReviseM2) {
                btnReviseM2.addEventListener('click', async () => {
                    const reason = prompt("Masukkan alasan revisi PICO (opsional):", "Menolak hasil dan merevisi Kriteria PICO di Modul 2.");
                    if (reason !== null) {
                        try {
                            btnReviseM2.textContent = "Memproses...";
                            btnReviseM2.disabled = true;
                            await API.reviseStep(session.id, reason, "M2_STEP2_NEEDS_REVISION");
                            window.location.reload();
                        } catch(err) {
                            alert(err.message);
                            btnReviseM2.textContent = "Kembali ke Modul 2 (Revisi PICO)";
                            btnReviseM2.disabled = false;
                        }
                    }
                });
            }
            
            const btnRevise = document.getElementById('btn-generic-revise');
            if (btnRevise) {
                btnRevise.addEventListener('click', async () => {
                    const reason = prompt("Masukkan alasan atau catatan revisi (opsional):", "Menolak hasil dan meminta revisi.");
                    if (reason !== null) {
                        try {
                            btnRevise.textContent = "Memproses...";
                            btnRevise.disabled = true;
                            // Default revise endpoint (usually sends to Modul 3 if M4)
                            await API.reviseStep(session.id, reason);
                            window.location.reload();
                        } catch(err) {
                            alert(err.message);
                            btnRevise.textContent = "Tolak & Revisi";
                            btnRevise.disabled = false;
                        }
                    }
                });
            }
        }, 0);
        return true;
    } else if (status.startsWith('M6_')) {
        let title = 'Modul 6: Full-Text Acquisition';
        let contentHtml = '';
        
        if (status === 'M6_STEP1_WAITING_SYNC') {
            title += ' (Menunggu Sinkronisasi Qdrant)';
            
            // Render Acquisition Log Progress
            let acqHtml = '';
            if (session.acquisition_log) {
                const log = session.acquisition_log;
                const highPct = ((log.high_retrieved / log.total_include) * 100).toFixed(1);
                const medPct = ((log.medium_retrieved / log.total_include) * 100).toFixed(1);
                const vecPct = ((log.vectorized_count / log.total_include) * 100).toFixed(1);
                
                // Perhitungan Inaccessible Sementara (Missing)
                const missingCount = log.total_include - log.vectorized_count;
                const effectiveInacc = Math.max(log.inaccessible_count, missingCount);
                const effectiveInaccPct = (effectiveInacc / log.total_include) * 100;
                const effectiveInaccPctStr = effectiveInaccPct.toFixed(1);
                
                let inaccColor = '#22c55e'; // Green
                if (effectiveInaccPct >= 15) inaccColor = '#ef4444'; // Red
                else if (effectiveInaccPct >= 5) inaccColor = '#eab308'; // Yellow

                acqHtml = `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                    <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;">
                        <h4 style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">Total Teks Lolos (INCLUDE)</h4>
                        <div style="font-size: 1.5rem; font-weight: bold; margin-top: 5px; color: var(--text-primary);">${log.total_include}</div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;">
                        <h4 style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">Otomatis (Open Access)</h4>
                        <div style="font-size: 1.5rem; font-weight: bold; margin-top: 5px; color: #0d9488;">${log.high_retrieved} <span style="font-size: 0.9rem">(${highPct}%)</span></div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;">
                        <h4 style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">Vectorized (Qdrant)</h4>
                        <div style="font-size: 1.5rem; font-weight: bold; margin-top: 5px; color: #0d9488;">${log.vectorized_count} <span style="font-size: 0.9rem">(${vecPct}%)</span></div>
                    </div>
                    <div style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center;">
                        <h4 style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">Missing / Inaccessible</h4>
                        <div style="font-size: 1.5rem; font-weight: bold; margin-top: 5px; color: ${inaccColor};">${effectiveInacc} <span style="font-size: 0.9rem">(${effectiveInaccPctStr}%)</span></div>
                    </div>
                </div>
                `;

                const max5Pct = Math.floor(log.total_include * 0.05);
                const max15Pct = Math.floor(log.total_include * 0.15);

                let inaccProtocolHtml = '';
                if (effectiveInaccPct < 5) {
                    inaccProtocolHtml = `<div style="background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e; padding: 12px; border-radius: 4px; margin-top: 15px; margin-bottom: 20px; font-size: 0.9rem;">
                        <strong>=== INACCESSIBLE PROTOCOL ===</strong><br/>
                        <span style="color: #22c55e;">(&lt; 5%)</span> Dokumentasi standar, low impact terhadap SLR.<br/>
                        <span style="color: #a8a29e; font-size: 0.85rem; display: inline-block; margin-top: 5px;">Batas aman &lt;5%: <strong>Maks ${max5Pct} paper</strong>. Saat ini Anda berada di area aman.</span>
                    </div>`;
                } else if (effectiveInaccPct <= 15) {
                    const toFind = effectiveInacc - max5Pct;
                    inaccProtocolHtml = `<div style="background: rgba(234, 179, 8, 0.1); border-left: 4px solid #eab308; padding: 12px; border-radius: 4px; margin-top: 15px; margin-bottom: 20px; font-size: 0.9rem;">
                        <strong>=== INACCESSIBLE PROTOCOL ===</strong><br/>
                        <span style="color: #eab308;">(5 - 15%)</span> Perlu dokumentasi detail + analisis bias (apakah paper yang tidak bisa diakses skewed/mengumpul ke region atau tahun tertentu?).<br/>
                        <span style="color: #a8a29e; font-size: 0.85rem; display: inline-block; margin-top: 5px;">Batas 5-15%: <strong>${max5Pct+1} - ${max15Pct} paper</strong>. Temukan <strong>${toFind} paper lagi</strong> jika ingin turun ke area hijau (&lt;5%).</span>
                    </div>`;
                } else {
                    const toFind15 = effectiveInacc - max15Pct;
                    inaccProtocolHtml = `<div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px; border-radius: 4px; margin-top: 15px; margin-bottom: 20px; font-size: 0.9rem;">
                        <strong>=== INACCESSIBLE PROTOCOL ===</strong><br/>
                        <span style="color: #ef4444;">(&gt; 15%)</span> <strong>REVISI STRATEGI!</strong> Tambah channel pencarian institusi, pinjam akses kolega, atau segera konsultasi dengan supervisor. Missing data terlalu tinggi!<br/>
                        <span style="color: #a8a29e; font-size: 0.85rem; display: inline-block; margin-top: 5px;">Batas &gt;15%: <strong>&gt;${max15Pct} paper</strong>. Anda WAJIB menemukan <strong>${toFind15} paper lagi</strong> agar bisa keluar dari zona merah (turun ke 15%).</span>
                    </div>`;
                }
                
                acqHtml += inaccProtocolHtml;
            }

            contentHtml = `
                ${acqHtml}
                <style>
                .stepper-container {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    background: linear-gradient(145deg, #292524 0%, #1c1917 100%);
                    border: 1px solid rgba(56, 189, 248, 0.2);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
                    margin-bottom: 24px;
                    position: relative;
                    overflow: hidden;
                }
                .stepper-container::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(56,189,248,0.05) 0%, transparent 60%);
                    animation: rotate 20s linear infinite;
                    pointer-events: none;
                }
                @keyframes rotate {
                    100% { transform: rotate(360deg); }
                }
                .stepper-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 8px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    padding-bottom: 16px;
                }
                .stepper-header-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    background: rgba(16, 185, 129, 0.1);
                    color: #10B981;
                    font-size: 1.2rem;
                    box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
                }
                .stepper-header-title {
                    margin: 0;
                    color: #f8fafc;
                    font-size: 1.1rem;
                    font-weight: 600;
                }
                .stepper-header-subtitle {
                    margin: 4px 0 0 0;
                    color: #a8a29e;
                    font-size: 0.85rem;
                }
                .step-item {
                    display: flex;
                    gap: 16px;
                    position: relative;
                    padding-bottom: 16px;
                }
                .step-item:last-child {
                    padding-bottom: 0;
                }
                .step-item:not(:last-child)::after {
                    content: '';
                    position: absolute;
                    left: 17px;
                    top: 40px;
                    bottom: 0;
                    width: 2px;
                    background: linear-gradient(to bottom, #0d9488, transparent);
                    opacity: 0.3;
                }
                .step-number {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
                    color: white;
                    font-weight: bold;
                    font-size: 0.9rem;
                    box-shadow: 0 4px 10px rgba(13, 148, 136, 0.4);
                    flex-shrink: 0;
                    z-index: 1;
                }
                .step-content {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 12px;
                    padding: 16px;
                    flex-grow: 1;
                    transition: all 0.3s ease;
                }
                .step-content:hover {
                    background: rgba(255,255,255,0.06);
                    border-color: rgba(56,189,248,0.3);
                    transform: translateX(4px);
                }
                .step-title {
                    margin: 0 0 4px 0;
                    color: #e2e8f0;
                    font-size: 0.95rem;
                    font-weight: 600;
                }
                .step-desc {
                    margin: 0;
                    color: #a8a29e;
                    font-size: 0.85rem;
                    line-height: 1.5;
                }
                .step-highlight {
                    color: #38bdf8;
                    font-weight: 600;
                }
                </style>
                <div class="stepper-container">
                    <div class="stepper-header">
                        <div class="stepper-header-icon"><i class="fa fa-check-circle"></i></div>
                        <div>
                            <h3 class="stepper-header-title">Pencarian Otomatis Selesai</h3>
                            <p class="stepper-header-subtitle">Sistem telah memindai Open Access via Unpaywall & ArXiv API. Ikuti langkah berikut untuk memproses dokumen:</p>
                        </div>
                    </div>
                    <div class="step-item">
                        <div class="step-number">1</div>
                        <div class="step-content">
                            <h4 class="step-title">Unduh Daftar Referensi</h4>
                            <p class="step-desc">Klik tombol <span class="step-highlight"><span class="ico ico-download"></span> Unduh CSV</span> di tabel di bawah untuk mendapatkan daftar tautan PDF dari paper yang terbuka (Open Access).</p>
                        </div>
                    </div>
                    <div class="step-item">
                        <div class="step-number">2</div>
                        <div class="step-content">
                            <h4 class="step-title">Kumpulkan PDF</h4>
                            <p class="step-desc">Gunakan tautan dari file CSV tersebut untuk mengunduh PDF. Lalu, unggah seluruh file PDF ke dalam satu folder <span class="step-highlight">Google Drive</span> Anda.</p>
                        </div>
                    </div>
                    <div class="step-item">
                        <div class="step-number">3</div>
                        <div class="step-content">
                            <h4 class="step-title">Jalankan Ekstraksi AI</h4>
                            <p class="step-desc">Buka Notebook <span class="step-highlight">PEDE</span> di Google Colab, sambungkan ke Google Drive (folder PDF), lalu <strong>Run all</strong> untuk mengubah PDF → <em>Vector Embeddings</em> → Qdrant.</p>
                            <a href="https://colab.research.google.com/github/ifcoid/pede/blob/main/notebooks/pede_colab.ipynb" target="_blank" rel="noopener"
                               style="display:inline-block;margin-top:6px;background:#f9ab00;color:#1a1a1a;font-weight:bold;padding:7px 13px;border-radius:6px;text-decoration:none;font-size:0.85rem;">
                                ▶ Buka Notebook PEDE di Google Colab
                            </a>
                            <a href="https://raw.githubusercontent.com/ifcoid/pede/main/notebooks/pede_colab.ipynb" target="_blank" rel="noopener"
                               style="margin-left:10px;color:#a8a29e;font-size:0.8rem;">unduh .ipynb</a>
                        </div>
                    </div>
                    <div class="step-item">
                        <div class="step-number">4</div>
                        <div class="step-content">
                            <h4 class="step-title">Sinkronisasi Akhir</h4>
                            <p class="step-desc">Setelah Colab sukses memompa vektor ke <span class="step-highlight">Qdrant</span>, tekan tombol <span class="step-highlight"><span class="ico ico-refresh"></span> Sinkronkan dengan Qdrant</span> di tabel bawah untuk memperbarui status ini.</p>
                        </div>
                    </div>
                </div>
            `;
                
                contentHtml += `
                <div class="action-buttons" style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                    <button id="btn-m6-sync" class="btn" style="background: #0d9488; color: white;"><span class="ico ico-refresh"></span> Sinkronisasi dengan Qdrant DB</button>
                    <button id="btn-m6-export-csv" class="btn" style="background: #14b8a6; color: white;"><span class="ico ico-download"></span> Export CSV</button>
                    <button id="btn-m6-details" class="btn" style="background: #64748b; color: white;"><span class="ico ico-copy"></span> Status PDF & Vektor (Modal)</button>
                    <button id="btn-m6-approve" class="btn btn-success" style="margin-left: auto;"><span class="ico ico-check"></span> Setuju &amp; Lanjut → Full-text Screening (M6.2)</button>
                </div>
                <div id="m6-papers-container" style="margin-top: 10px;">
                    <div id="m6-papers-loading" style="text-align: center; padding: 20px; color: #a8a29e;">
                        <i class="fa fa-spinner fa-spin"></i> Memuat data papers...
                    </div>
                    <div id="m6-papers-table-wrapper" style="display: none; max-height: 400px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: rgba(15, 23, 42, 0.5);">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead style="position: sticky; top: 0; background: #292524; z-index: 1;">
                                <tr style="border-bottom: 2px solid #44403c; color: #a8a29e;">
                                    <th style="padding: 10px 12px; font-size: 0.8rem;">Title</th>
                                    <th style="padding: 10px 12px; font-size: 0.8rem;">DOI</th>
                                    <th style="padding: 10px 12px; font-size: 0.8rem;">Publisher</th>
                                    <th style="padding: 10px 12px; font-size: 0.8rem; text-align: center;">Retrieved</th>
                                    <th style="padding: 10px 12px; font-size: 0.8rem; text-align: center;">Inaccessible</th>
                                    <th style="padding: 10px 12px; font-size: 0.8rem;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="m6-papers-tbody"></tbody>
                        </table>
                    </div>
                    <div id="m6-papers-error" style="display: none; color: #ef4444; padding: 10px;"></div>
                </div>
            `;
        }
        
        let html = `
            <div class="approval-card">
                <h3>${title}</h3>
                <div class="approval-content">
                    ${contentHtml}
                </div>
            </div>
        `;
        
        area.innerHTML = html;
        
        setTimeout(async () => {
            // --- Helper: Load papers into inline table ---
            const loadPapersTable = async () => {
                const loadingEl = document.getElementById('m6-papers-loading');
                const tableWrapper = document.getElementById('m6-papers-table-wrapper');
                const errorEl = document.getElementById('m6-papers-error');
                const tbody = document.getElementById('m6-papers-tbody');
                
                if (!loadingEl || !tableWrapper || !tbody) return;
                
                loadingEl.style.display = 'block';
                tableWrapper.style.display = 'none';
                errorEl.style.display = 'none';
                
                try {
                    const data = await API.getM6Papers(session.id);
                    let papers = data.papers || [];
                    
                    // Sort: action needed first, retrieved middle, inaccessible last
                    papers.sort((a, b) => {
                        const getScore = (p) => {
                            if (!p.retrieved && !p.inaccessible) return 1;
                            if (p.retrieved) return 2;
                            return 3;
                        };
                        return getScore(a) - getScore(b);
                    });
                    
                    let rows = '';
                    papers.forEach((p) => {
                        let doiFull = p.doi || '-';
                        let doiDisplay = doiFull;
                        let doiHtml = '-';
                        
                        if (doiFull !== '-') {
                            if (doiFull.startsWith('2-s2.0-')) {
                                doiHtml = `<a href="https://www.scopus.com/record/display.uri?eid=${doiFull}&origin=resultslist" target="_blank" style="color: #F59E0B; text-decoration: none; font-size: 0.8rem;" title="Scopus EID">${doiDisplay}</a>`;
                            } else {
                                if (doiFull.startsWith('https://doi.org/')) doiDisplay = doiFull.replace('https://doi.org/', '');
                                else if (doiFull.startsWith('http://doi.org/')) doiDisplay = doiFull.replace('http://doi.org/', '');
                                const linkHref = doiFull.startsWith('http') ? doiFull : 'https://doi.org/' + doiFull;
                                doiHtml = `<a href="${linkHref}" target="_blank" style="color: #5eead4; text-decoration: none; font-size: 0.8rem;">${doiDisplay}</a>`;
                            }
                        }
                        
                        const retrievedBadge = p.retrieved
                            ? '<span style="background: rgba(74, 222, 128, 0.15); color: #4ade80; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">Retrieved</span>'
                            : '<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">Not Retrieved</span>';
                        
                        const inaccessibleBadge = p.inaccessible
                            ? '<span style="background: rgba(234, 179, 8, 0.15); color: #eab308; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600;">Inaccessible</span>'
                            : '<span style="color: #a8a29e; font-size: 0.75rem;">-</span>';
                        
                        let actionsHtml = '';
                        if (p.retrieved) {
                            actionsHtml = `<button class="btn-inline-delete-qdrant" data-id="${p.id}" data-doi="${doiDisplay}" data-title="${escHtml(p.title || '')}" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; white-space: nowrap;">Delete from Qdrant</button>`;
                        } else if (!p.inaccessible) {
                            actionsHtml = `<button class="btn-inline-mark-inacc" data-id="${p.id}" style="background: transparent; border: 1px solid #eab308; color: #eab308; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; white-space: nowrap;">Mark Inaccessible</button>`;
                        }
                        
                        rows += `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                                <td style="padding: 8px 12px; color: var(--text-primary, #e2e8f0); font-size: 0.85rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escHtml(p.title || '')}">${escHtml(p.title) || '-'}</td>
                                <td style="padding: 8px 12px; font-size: 0.8rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${doiHtml}</td>
                                <td style="padding: 8px 12px; font-size: 0.8rem; color: #a8a29e;">${p.publisher || '-'}</td>
                                <td style="padding: 8px 12px; text-align: center;">${retrievedBadge}</td>
                                <td style="padding: 8px 12px; text-align: center;">${inaccessibleBadge}</td>
                                <td style="padding: 8px 12px;" class="td-inline-action" data-id="${p.id}">${actionsHtml}</td>
                            </tr>
                        `;
                    });
                    
                    tbody.innerHTML = rows;
                    loadingEl.style.display = 'none';
                    tableWrapper.style.display = 'block';
                    
                } catch (err) {
                    loadingEl.style.display = 'none';
                    errorEl.style.display = 'block';
                    errorEl.textContent = 'Failed to load papers: ' + err.message;
                }
            };
            
            // --- Load inline papers table ---
            await loadPapersTable();
            
            // --- Bind event delegation for inline table actions ---
            const tableWrapper = document.getElementById('m6-papers-table-wrapper');
            if (tableWrapper) {
                tableWrapper.addEventListener('click', async (e) => {
                    const target = e.target;
                    
                    if (target.classList.contains('btn-inline-delete-qdrant')) {
                        const paperDoi = target.getAttribute('data-doi');
                        const paperTitle = target.getAttribute('data-title');
                        if (!confirm('Delete this paper from Qdrant? You will need to re-upload the PDF via Notebook.')) return;
                        
                        target.innerHTML = '...';
                        target.disabled = true;
                        
                        try {
                            await API.deleteQdrantPaper(session.id, { doi: paperDoi, title: paperTitle });
                            await loadPapersTable();
                        } catch (err) {
                            alert('Delete failed: ' + err.message);
                            target.innerHTML = 'Delete from Qdrant';
                            target.disabled = false;
                        }
                    } else if (target.classList.contains('btn-inline-mark-inacc')) {
                        const paperId = target.getAttribute('data-id');
                        const actionCell = target.closest('.td-inline-action');
                        actionCell.innerHTML = `
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <textarea id="inacc-doc-${paperId}" placeholder="Documentation (e.g., paywall, no institutional access)" style="font-size: 0.75rem; padding: 4px; border-radius: 4px; border: 1px solid #475569; background: #44403c; color: white; resize: vertical; min-height: 40px; width: 100%;" autocomplete="off"></textarea>
                                <div style="display: flex; gap: 4px;">
                                    <button class="btn-inline-save-inacc" data-id="${paperId}" style="background: #eab308; color: #1a1a1a; border: none; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: 600;">Submit</button>
                                    <button class="btn-inline-cancel-inacc" data-id="${paperId}" style="background: transparent; color: #a8a29e; border: 1px solid #475569; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Cancel</button>
                                </div>
                            </div>
                        `;
                        setTimeout(() => {
                            const ta = document.getElementById(`inacc-doc-${paperId}`);
                            if (ta) ta.focus();
                        }, 50);
                    } else if (target.classList.contains('btn-inline-save-inacc')) {
                        const paperId = target.getAttribute('data-id');
                        const textarea = document.getElementById(`inacc-doc-${paperId}`);
                        const documentation = textarea ? textarea.value.trim() : '';
                        
                        if (!documentation) {
                            textarea.style.border = '1px solid #ef4444';
                            return;
                        }
                        
                        target.innerHTML = '...';
                        target.disabled = true;
                        
                        try {
                            await API.markInaccessible(session.id, paperId, documentation);
                            await loadPapersTable();
                        } catch (err) {
                            alert('Mark inaccessible failed: ' + err.message);
                            target.innerHTML = 'Submit';
                            target.disabled = false;
                        }
                    } else if (target.classList.contains('btn-inline-cancel-inacc')) {
                        await loadPapersTable();
                    }
                });
            }
            
            // --- Sync Qdrant button ---
            // Approve → maju ke Modul 6.2 (full-text screening). Backend menangani
            // M6_STEP1_WAITING_SYNC -> M6_STEP2_FULLTEXT_SCREENING. Gate inaccessible
            // bersifat advisory (tidak hard-block), jadi tombol selalu tersedia.
            const btnM6Approve = document.getElementById('btn-m6-approve');
            if (btnM6Approve) {
                btnM6Approve.addEventListener('click', async () => {
                    if (!confirm('Lanjut ke Modul 6.2 (Full-text Screening)? Pastikan vektorisasi Qdrant sudah disinkronkan. Paper yang masih "Inaccessible" akan dicatat sebagai PRISMA "reports not retrieved".')) return;
                    try {
                        setButtonLoading(btnM6Approve, true, 'Memproses...');
                        await handleApproval({});
                    } catch (e) {
                        setButtonLoading(btnM6Approve, false, '<span class="ico ico-check"></span> Setuju & Lanjut → Full-text Screening (M6.2)');
                        alert('Gagal lanjut: ' + e.message);
                    }
                });
            }

            const btnSync = document.getElementById('btn-m6-sync');
            if (btnSync) {
                btnSync.addEventListener('click', async () => {
                    // ASYNC: backend mulai job & balas {started}; kita POLL hasilnya. Scroll Qdrant
                    // + cocokkan bisa lama → hindari timeout proxy + beri feedback seketika.
                    const resetBtn = () => { btnSync.disabled = false; btnSync.innerHTML = '<span class="ico ico-refresh"></span> Sinkronisasi dengan Qdrant DB'; };
                    btnSync.disabled = true;
                    btnSync.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Syncing… (lihat Live Log)';
                    showToast('🔄 Sinkronisasi Qdrant dimulai — bisa beberapa menit. Lihat progres di Live Log.');
                    try {
                        await API.syncQdrant(session.id); // {started:true}
                        const poll = async () => {
                            try {
                                const r = await API.getSyncQdrantResult(session.id);
                                if (!r.found || !r.done) { setTimeout(poll, 2500); return; }
                                if (r.error) { showToast('Sync gagal: ' + r.error, 'error'); resetBtn(); return; }
                                showToast(`✅ Sync selesai: ${r.synced_count} paper tervektor.`);
                                // Reload agar header card (Total/Vectorized/%) ikut ter-refresh.
                                setTimeout(() => window.location.reload(), 800);
                            } catch (e) { showToast('Gagal cek hasil sync: ' + e.message, 'error'); resetBtn(); }
                        };
                        setTimeout(poll, 1500);
                    } catch(e) {
                        showToast('Gagal mulai sync: ' + e.message, 'error');
                        resetBtn();
                    }
                });
            }
            
            // --- Export CSV button ---
            const btnExportCsv = document.getElementById('btn-m6-export-csv');
            if (btnExportCsv) {
                btnExportCsv.addEventListener('click', async () => {
                    try {
                        btnExportCsv.disabled = true;
                        btnExportCsv.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Preparing...';
                        const csvText = await API.exportLinks(session.id);
                        const blob = new Blob([csvText], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `M6_acquisition_links_${session.id}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                    } catch (err) {
                        alert('Export failed: ' + err.message);
                    } finally {
                        btnExportCsv.disabled = false;
                        btnExportCsv.innerHTML = '<span class="ico ico-download"></span> Export CSV';
                    }
                });
            }

            // --- Details Modal button (full-screen view) ---
            const btnDetails = document.getElementById('btn-m6-details');
            if (btnDetails) {
                btnDetails.addEventListener('click', async () => {
                    btnDetails.disabled = true;
                    btnDetails.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memuat...';
                    try {
                        const data = await API.getM6Papers(session.id);
                        let papers = data.papers || [];
                        
                        papers.sort((a, b) => {
                            const getScore = (p) => {
                                if (!p.retrieved && !p.inaccessible) return 1;
                                if (p.retrieved) return 2;
                                return 3;
                            };
                            return getScore(a) - getScore(b);
                        });
                        
                        let rows = '';
                        papers.forEach((p, idx) => {
                            let doiFull = p.doi || '-';
                            let doiDisplay = doiFull;
                            let doiHtml = '-';
                            
                            if (doiFull !== '-') {
                                if (doiFull.startsWith('2-s2.0-')) {
                                    doiHtml = `<a href="https://www.scopus.com/record/display.uri?eid=${doiFull}&origin=resultslist" target="_blank" style="color: #F59E0B; text-decoration: none;" title="Buka di Scopus (EID)"><i class="fa fa-external-link-square"></i> EID: ${doiDisplay}</a>`;
                                } else {
                                    if (doiFull.startsWith('https://doi.org/')) doiDisplay = doiFull.replace('https://doi.org/', '');
                                    else if (doiFull.startsWith('http://doi.org/')) doiDisplay = doiFull.replace('http://doi.org/', '');
                                    const linkHref = doiFull.startsWith('http') ? doiFull : 'https://doi.org/' + doiFull;
                                    doiHtml = `<a href="${linkHref}" target="_blank" style="color: #0d9488; text-decoration: none;">${doiDisplay}</a>`;
                                }
                            }
                            
                            const vectorized = p.retrieved ? '<span style="color:#22c55e">✅ Ya</span>' : '<span style="color:#ef4444">❌ Belum</span>';
                            
                            let locHtml = '';
                            if (p.retrieved) {
                                locHtml = `<div style="display: flex; flex-direction: column; gap: 5px;">
                                              <span style="color: #10B981; font-weight: bold;"><i class="fa fa-check-circle"></i> Selesai</span>
                                              <button class="btn-delete-qdrant" data-id="${p.id}" data-doi="${doiDisplay}" data-title="${(p.title || '').replace(/"/g, '&quot;')}" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; text-align: center; width: fit-content;" title="Hapus vektor di database jika PDF rusak/watermark"><span class="ico ico-trash"></span> Hapus Vektor (Fix PDF)</button>
                                           </div>`;
                            } else {
                                locHtml = p.location === 'arxiv' ? 
                                    `<div style="display: flex; flex-direction: column; gap: 5px;">
                                        <a href="${p.download_url}" target="_blank" style="color: #38BDF8; text-decoration: none; display: flex; align-items: center; gap: 4px;"><i class="fa fa-download"></i> Unduh Otomatis</a>
                                    ` : 
                                    `<div style="display: flex; flex-direction: column; gap: 5px;">
                                        <a href="${doiFull !== '-' ? (doiFull.startsWith('http') ? doiFull : 'https://doi.org/' + doiFull) : '#'}" target="_blank" style="color: #F59E0B; text-decoration: none; display: flex; align-items: center; gap: 4px;"><i class="fa fa-user"></i> HITL Download</a>
                                    `;
                                
                                if (p.inaccessible) {
                                    locHtml += `<span style="color: #ef4444; font-size: 0.8rem;"><i class="fa fa-ban"></i> Inaccessible</span></div>`;
                                } else {
                                    locHtml += `<button class="btn-mark-inacc" data-id="${p.id}" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; text-align: center; width: fit-content;">Tandai Inaccessible</button></div>`;
                                }
                            }

                            rows += `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                                    <td style="padding: 12px; color: var(--text-secondary);">${idx + 1}</td>
                                    <td style="padding: 12px; color: var(--text-primary); font-size: 0.9rem;">
                                        <span style="background: #475569; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-bottom: 4px; display: inline-block;">${p.publisher || 'Unknown'}</span><br/>
                                        ${p.title || '-'}
                                    </td>
                                    <td style="padding: 12px; font-size: 0.85rem;">${doiHtml}</td>
                                    <td style="padding: 12px; font-size: 0.85rem;" class="td-action" data-id="${p.id}">${locHtml}</td>
                                    <td style="padding: 12px; font-size: 0.85rem; text-align: center;">${vectorized}</td>
                                </tr>
                            `;
                        });
                        
                        const modalHtml = `
                            <div id="m6-details-modal" style="position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(15, 23, 42, 0.9); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(8px);">
                                <div style="background: #292524; width: 90%; max-width: 1200px; max-height: 90vh; border-radius: 12px; display: flex; flex-direction: column; border: 1px solid #44403c; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
                                    <div style="padding: 20px; border-bottom: 1px solid #44403c; display: flex; justify-content: space-between; align-items: center;">
                                        <h2 style="margin: 0; color: white; font-size: 1.25rem;"><span class="ico ico-copy"></span> Status Akuisisi Teks Penuh (${data.total} Dokumen)</h2>
                                        <div style="display: flex; gap: 15px; align-items: center;">
                                            <button id="btn-modal-export-csv" class="btn" style="background: #14b8a6; color: white; padding: 8px 16px; font-size: 0.9rem;"><span class="ico ico-download"></span> Unduh CSV</button>
                                            <button id="btn-close-m6-modal" style="background: transparent; border: none; color: #a8a29e; font-size: 1.5rem; cursor: pointer;">&times;</button>
                                        </div>
                                    </div>
                                    <div style="flex: 1; overflow-y: auto; padding: 20px;">
                                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                            <thead>
                                                <tr style="border-bottom: 2px solid #44403c; color: #a8a29e;">
                                                    <th style="padding: 12px; width: 50px;">No</th>
                                                    <th style="padding: 12px;">Judul Paper & Publisher</th>
                                                    <th style="padding: 12px; width: 150px;">DOI</th>
                                                    <th style="padding: 12px; width: 160px;">Aksi / Sumber</th>
                                                    <th style="padding: 12px; width: 100px; text-align: center;">Tervektorisasi</th>
                                                </tr>
                                            </thead>
                                            <tbody id="m6-tbody">
                                                ${rows}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        `;
                        
                        const modalContainer = document.createElement('div');
                        modalContainer.innerHTML = modalHtml;
                        document.body.appendChild(modalContainer);
                        
                        document.getElementById('btn-close-m6-modal').addEventListener('click', () => {
                            document.body.removeChild(modalContainer);
                        });
                        
                        // CSV Export in Modal
                        document.getElementById('btn-modal-export-csv').addEventListener('click', async (ev) => {
                            const btnExport = ev.currentTarget;
                            try {
                                btnExport.disabled = true;
                                btnExport.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Menyiapkan...';
                                const csvText = await API.exportLinks(session.id);
                                const blob = new Blob([csvText], { type: 'text/csv' });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `M6_acquisition_links_${session.id}.csv`;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                window.URL.revokeObjectURL(url);
                            } catch(err) {
                                alert(err.message);
                            } finally {
                                btnExport.disabled = false;
                                btnExport.innerHTML = '<span class="ico ico-download"></span> Unduh CSV';
                            }
                        });

                        // Event delegation for modal table actions
                        const modalTbody = modalContainer.querySelector('#m6-tbody');
                        modalTbody.addEventListener('click', async (e) => {
                            if (e.target.classList.contains('btn-delete-qdrant')) {
                                const paperDoi = e.target.getAttribute('data-doi');
                                const paperTitle = e.target.getAttribute('data-title');
                                if(!confirm("Delete this paper's vectors from Qdrant? You will need to re-upload the PDF via Notebook.")) return;
                                
                                const btn = e.target;
                                btn.innerHTML = 'Deleting...';
                                btn.disabled = true;
                                
                                try {
                                    await API.deleteQdrantPaper(session.id, { doi: paperDoi, title: paperTitle });
                                    const parentDiv = e.target.closest('.td-action');
                                    parentDiv.innerHTML = `<div style="display: flex; flex-direction: column; gap: 5px;">
                                        <span style="color: #ef4444; font-size: 0.8rem;"><i class="fa fa-trash"></i> Deleted - re-upload needed</span>
                                    </div>`;
                                    // Refresh inline table
                                    await loadPapersTable();
                                } catch (err) {
                                    alert(err.message);
                                    btn.innerHTML = '<span class="ico ico-trash"></span> Hapus Vektor (Fix PDF)';
                                    btn.disabled = false;
                                }
                            } else if (e.target.classList.contains('btn-mark-inacc')) {
                                const paperId = e.target.getAttribute('data-id');
                                const parentDiv = e.target.parentElement;
                                parentDiv.innerHTML = `
                                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 5px;">
                                        <input type="text" id="modal-reason-${paperId}" placeholder="Alasan (contoh: berbayar)" style="font-size: 0.75rem; padding: 4px; border-radius: 4px; border: 1px solid #475569; background: #44403c; color: white;" autocomplete="off">
                                        <div style="display: flex; gap: 4px;">
                                            <button class="btn-save-inacc" data-id="${paperId}" style="background: #ef4444; color: white; border: none; padding: 3px 6px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Simpan</button>
                                            <button class="btn-cancel-inacc" data-id="${paperId}" style="background: transparent; color: #a8a29e; border: 1px solid #475569; padding: 3px 6px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">Batal</button>
                                        </div>
                                    </div>
                                `;
                                setTimeout(() => {
                                    const input = document.getElementById(`modal-reason-${paperId}`);
                                    if(input) input.focus();
                                }, 50);
                            } else if (e.target.classList.contains('btn-cancel-inacc')) {
                                const paperId = e.target.getAttribute('data-id');
                                const parentDiv = e.target.closest('.td-action').querySelector('div');
                                parentDiv.innerHTML = `<button class="btn-mark-inacc" data-id="${paperId}" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; text-align: center; width: fit-content;">Tandai Inaccessible</button>`;
                            } else if (e.target.classList.contains('btn-save-inacc')) {
                                const paperId = e.target.getAttribute('data-id');
                                const reasonInput = document.getElementById(`modal-reason-${paperId}`);
                                const reason = reasonInput ? reasonInput.value.trim() : '';
                                
                                if (!reason) {
                                    reasonInput.style.border = '1px solid #ef4444';
                                    return;
                                }
                                
                                const btn = e.target;
                                btn.innerHTML = '...';
                                btn.disabled = true;
                                
                                try {
                                    await API.markInaccessible(session.id, paperId, reason);
                                    const parentDiv = e.target.closest('.td-action');
                                    parentDiv.innerHTML = `<div style="display: flex; flex-direction: column; gap: 5px;">
                                        <span style="color: #ef4444; font-size: 0.8rem;"><i class="fa fa-ban"></i> Inaccessible</span>
                                    </div>`;
                                    // Refresh inline table
                                    await loadPapersTable();
                                } catch (err) {
                                    alert(err.message);
                                    btn.innerHTML = 'Simpan';
                                    btn.disabled = false;
                                }
                            }
                        });
                        
                    } catch(e) {
                        alert("Gagal memuat data: " + e.message);
                    } finally {
                        btnDetails.disabled = false;
                        btnDetails.innerHTML = '<span class="ico ico-copy"></span> Status PDF & Vektor (Modal)';
                    }
                });
            }
        }, 0);
        return true;
    }

    return false;
}

// Universal xAI Transparency Section: appended after renderApprovalContent for any WAITING_APPROVAL step.
export function appendXAISection(area, session) {
    const status = session.status || '';
    if (!status.includes('WAITING_APPROVAL') && !status.includes('LOW_KAPPA')) return;

    // Derive the step that produced the current WAITING state
    const currentStep = status.replace('_WAITING_APPROVAL', '').replace('_LOW_KAPPA', '');

    const details = document.createElement('details');
    details.style.cssText = 'margin-top: 1.5rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem;';
    details.innerHTML = `
        <summary style="cursor: pointer; color: #5eead4; font-weight: 600; font-size: 0.95em; user-select: none;">
            &#x1f9e0; xAI Transparency Log (Step: ${currentStep})
        </summary>
        <div class="xai-log-content" style="margin-top: 0.75rem; color: #d6d3d1; font-size: 0.88em;">
            <p style="color: #64748b;"><em>Memuat log xAI...</em></p>
        </div>
    `;
    area.appendChild(details);

    details.addEventListener('toggle', async function handler() {
        if (!details.open) return;
        details.removeEventListener('toggle', handler);
        const container = details.querySelector('.xai-log-content');
        try {
            const data = await API.getXAILog(session.id, currentStep);
            const entries = data.xai_log || [];
            if (entries.length === 0) {
                container.innerHTML = '<p style="color: #64748b;"><em>Belum ada catatan interaksi LLM untuk step ini.</em></p>';
                return;
            }
            let html = '';
            entries.forEach((entry, idx) => {
                const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '-';
                const sysTrunc = (entry.system_prompt || '').length > 300
                    ? entry.system_prompt.substring(0, 300) + '...'
                    : (entry.system_prompt || '(kosong)');
                html += `
                    <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 0.75rem; margin-bottom: 0.75rem;">
                        <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                            <span style="color: #5eead4;"><strong>Model:</strong> ${entry.model_name || '-'}</span>
                            <span style="color: #34d399;"><strong>Agent:</strong> ${entry.agent_func || '-'}</span>
                            <span style="color: #a8a29e;"><strong>Waktu:</strong> ${ts}</span>
                            <span style="color: #fbbf24;"><strong>Durasi:</strong> ${entry.duration_ms || 0}ms</span>
                        </div>
                        <details style="margin-top: 0.4rem;">
                            <summary style="cursor: pointer; color: #a8a29e; font-size: 0.85em;">System Prompt</summary>
                            <pre style="background: rgba(0,0,0,0.4); padding: 0.5rem; border-radius: 4px; font-size: 0.8em; white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow-y: auto; color: #e2e8f0; margin-top: 0.3rem;">${(entry.system_prompt || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                        </details>
                        <details style="margin-top: 0.4rem;">
                            <summary style="cursor: pointer; color: #a8a29e; font-size: 0.85em;">User Prompt (preview)</summary>
                            <pre style="background: rgba(0,0,0,0.4); padding: 0.5rem; border-radius: 4px; font-size: 0.8em; white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow-y: auto; color: #e2e8f0; margin-top: 0.3rem;">${(entry.user_prompt_preview || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                        </details>
                    </div>
                `;
            });
            container.innerHTML = `<p style="color:#64748b; margin-bottom:0.5rem;">Total ${entries.length} interaksi LLM tercatat.</p>` + html;
        } catch (err) {
            container.innerHTML = `<p style="color: #ef4444;"><em>Gagal memuat log xAI: ${err.message}</em></p>`;
        }
    });
}

// Panel koreksi Include/Exclude full-text (HITL) dari M7. PRESERVE protokol (lihat backend).
window.openScreeningCorrection = async (sessionId) => {
    const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    let overlay = document.getElementById('screening-correct-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'screening-correct-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
    overlay.innerHTML = `
        <div class="glass-panel" style="max-width:880px;width:92%;max-height:88vh;display:flex;flex-direction:column;padding:18px;border-radius:10px;background:#1c1917;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h3 style="margin:0;"><span class="ico ico-back"></span> Koreksi Include/Exclude (Full-Text)</h3>
                <button id="sc-close" class="btn-close" style="background:none;border:none;color:#d6d3d1;font-size:1.4em;cursor:pointer;">&times;</button>
            </div>
            <p style="font-size:0.82em;color:#fcd34d;background:rgba(245,158,11,0.08);padding:8px 10px;border-radius:6px;border-left:3px solid #f59e0b;margin:0 0 8px;">
                Koreksi keputusan full-text yang KELIRU. <strong>Protokol ekstraksi TIDAK berubah</strong>; paper baru diekstrak inkremental, data lama dipertahankan. Tiap perubahan WAJIB beralasan (audit PRISMA). <em>"Terasa sedikit" bukan alasan valid</em> — sebut error screening spesifik.
            </p>
            <input id="sc-filter" placeholder="🔎 filter judul / DOI…" style="width:100%;padding:6px;margin-bottom:6px;border-radius:4px;background:rgba(255,255,255,0.05);color:#e5e7eb;border:1px solid rgba(255,255,255,0.1);">
            <div id="sc-body" style="flex:1;overflow-y:auto;border:1px solid rgba(255,255,255,0.08);border-radius:6px;"><div style="padding:20px;text-align:center;color:#a8a29e;">Memuat…</div></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">
                <button id="sc-cancel" class="btn btn-secondary">Batal</button>
                <button id="sc-save" class="btn btn-primary"><span class="ico ico-save"></span> Terapkan Koreksi</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#sc-close').onclick = close;
    overlay.querySelector('#sc-cancel').onclick = close;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const body = overlay.querySelector('#sc-body');
    let papers = [];
    try {
        const data = await API.getScreeningReview(sessionId);
        papers = data.papers || [];
    } catch (e) {
        body.innerHTML = `<div style="padding:16px;color:#fca5a5;">Gagal memuat: ${e.message}</div>`;
        return;
    }
    const changed = {}; // paper_id -> {decision, reason, doi, title}
    const renderRows = (filter = '') => {
        const f = filter.toLowerCase();
        const list = papers.filter(p => !f || (p.title || '').toLowerCase().includes(f) || (p.doi || '').toLowerCase().includes(f));
        body.innerHTML = list.map(p => {
            const cur = changed[p.paper_id] ? changed[p.paper_id].decision : p.decision;
            const incl = cur === 'INCLUDE';
            const isChanged = !!changed[p.paper_id];
            const warn = (incl && !p.retrieved) ? ' <span title="Full-text belum ada di Qdrant — tak bisa diekstrak sampai PDF tersedia" style="color:#fca5a5;">⚠ no full-text</span>' : '';
            return `<div class="sc-row" data-id="${p.paper_id}" data-doi="${esc(p.doi)}" data-title="${esc(p.title)}" data-orig="${p.decision}" style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);${isChanged ? 'background:rgba(13, 148, 136,0.08);' : ''}">
                <div style="display:flex;gap:10px;align-items:center;">
                    <button class="sc-toggle btn" style="min-width:96px;padding:3px 8px;font-size:0.8em;${incl ? 'background:rgba(16,185,129,0.2);color:#6ee7b7;' : 'background:rgba(239,68,68,0.18);color:#fca5a5;'}">${incl ? '✓ INCLUDE' : '✕ EXCLUDE'}</button>
                    <div style="flex:1;font-size:0.85em;color:#e5e7eb;">${esc(p.title) || '(tanpa judul)'}${warn}<br><span style="color:#a8a29e;font-size:0.9em;">${esc(p.doi) || '-'}</span></div>
                </div>
                ${isChanged ? `<input class="sc-reason" placeholder="Alasan koreksi (wajib) — sebut error screening spesifik" value="${esc(changed[p.paper_id].reason)}" style="width:100%;margin-top:6px;padding:5px;border-radius:4px;background:rgba(255,255,255,0.05);color:#e5e7eb;border:1px solid ${changed[p.paper_id].reason ? 'rgba(255,255,255,0.1)' : '#ef4444'};">` : ''}
            </div>`;
        }).join('') || '<div style="padding:16px;color:#a8a29e;">Tak ada paper.</div>';
    };
    renderRows();
    overlay.querySelector('#sc-filter').addEventListener('input', (e) => renderRows(e.target.value));
    body.addEventListener('click', (e) => {
        if (!e.target.classList.contains('sc-toggle')) return;
        const row = e.target.closest('.sc-row'); const id = row.dataset.id, orig = row.dataset.orig;
        const cur = changed[id] ? changed[id].decision : orig;
        const next = cur === 'INCLUDE' ? 'EXCLUDE' : 'INCLUDE';
        if (next === orig) delete changed[id];
        else changed[id] = { decision: next, reason: (changed[id] && changed[id].reason) || '', doi: row.dataset.doi, title: row.dataset.title };
        renderRows(overlay.querySelector('#sc-filter').value);
    });
    body.addEventListener('input', (e) => {
        if (!e.target.classList.contains('sc-reason')) return;
        const id = e.target.closest('.sc-row').dataset.id;
        if (changed[id]) changed[id].reason = e.target.value;
    });
    overlay.querySelector('#sc-save').addEventListener('click', async () => {
        const corrections = Object.entries(changed).map(([paper_id, v]) => ({
            paper_id, decision: v.decision, reason: (v.reason || '').trim(), doi: v.doi, title: v.title,
            from: (papers.find(p => p.paper_id === paper_id) || {}).decision || '',
        }));
        if (corrections.length === 0) { showToast('Tak ada perubahan.', 'error'); return; }
        if (corrections.some(c => !c.reason)) { showToast('Setiap perubahan wajib punya alasan.', 'error'); return; }
        if (!confirm(`Terapkan ${corrections.length} koreksi? Protokol ekstraksi dipertahankan; paper baru akan diekstrak. Perubahan tercatat di audit.`)) return;
        const btn = overlay.querySelector('#sc-save');
        btn.disabled = true; btn.textContent = 'Menyimpan…';
        try {
            const res = await API.correctScreening(sessionId, corrections);
            showToast(`✅ ${res.applied} koreksi diterapkan (protokol dipertahankan).`);
            close();
            setTimeout(() => window.location.reload(), 900);
        } catch (e) {
            showToast('Gagal: ' + e.message, 'error');
            btn.disabled = false; btn.innerHTML = '<span class="ico ico-save"></span> Terapkan Koreksi';
        }
    });
};

window.showQAXAIModal = async (btn) => {
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memuat Data...';
    }
    try {
        const sid = localStorage.getItem('activeSessionId');
        const baseURL = getBaseURL();
        const res = await fetch(`${baseURL}/sessions/${sid}/extractions`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });
        if (!res.ok) throw new Error("Gagal mengambil data ekstraksi");
        const data = await res.json();

        // Helper: detect disagreement between R1 and R2
        const isDisagreement = (p) => {
            const r1 = (p.qa_r1_category || '').toUpperCase();
            const r2 = (p.qa_r2_category || '').toUpperCase();
            const r1Pass = r1 === 'HIGH' || r1 === 'MODERATE';
            const r1Fail = r1 === 'LOW';
            const r2Pass = r2 === 'HIGH' || r2 === 'MODERATE';
            const r2Fail = r2 === 'LOW';
            return (r1Pass && r2Fail) || (r1Fail && r2Pass);
        };

        const papers = (data.extractions || []).filter(p => p.qa_rated === true).sort((a, b) => {
            const aDisagree = isDisagreement(a) ? 0 : 1;
            const bDisagree = isDisagreement(b) ? 0 : 1;
            if (aDisagree !== bDisagree) return aDisagree - bDisagree;
            return Number(a.qa_total_score || 0) - Number(b.qa_total_score || 0);
        });

        // Fetch QA system prompt for xAI transparency
        let qaPromptData = null;
        try {
            const promptRes = await fetch(`${baseURL}/sessions/${sid}/m7/qa-prompt`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });
            if (promptRes.ok) qaPromptData = await promptRes.json();
        } catch(e) { /* ignore prompt fetch error */ }
        
        const modalHtml = `
            <div id="qa-xai-modal" style="position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(15, 23, 42, 0.9); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(8px);">
                <div style="background: #292524; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); width: 90vw; max-width: 1200px; height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                    <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); border-top-left-radius: 12px; border-top-right-radius: 12px;">
                        <h3 style="margin:0; color:#fca5a5; display:flex; align-items:center; gap:10px;">
                            <span><span class="ico ico-search"></span> </span> xAI: Transparansi Keputusan Dual-Rater
                        </h3>
                        <div style="display:flex; align-items:center; gap:15px;">
                            <button id="btn-xai-sync" style="background: #0d9488; border: none; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85em; font-weight: bold; display: flex; align-items: center; gap: 5px; transition: background 0.2s;"><span class="ico ico-refresh"></span> Sinkronisasi Qdrant</button>
                            <button id="btn-close-qa-xai" style="background: transparent; border: none; color: #a8a29e; font-size: 1.5rem; cursor: pointer;">&times;</button>
                        </div>
                    </div>
                    <div style="padding: 20px; overflow-y: auto; flex: 1;">
                        ${qaPromptData ? `
                            <details style="margin-bottom: 20px; background: rgba(13, 148, 136, 0.08); border: 1px solid rgba(13, 148, 136, 0.3); border-radius: 8px; padding: 0;">
                                <summary style="padding: 12px 15px; cursor: pointer; color: #5eead4; font-weight: bold; font-size: 0.9em; user-select: none;"><span class="ico ico-copy"></span> System Prompt Rater (xAI Transparency)</summary>
                                <div style="padding: 12px 15px; border-top: 1px solid rgba(13, 148, 136, 0.2);">
                                    <div style="margin-bottom: 8px; font-size: 0.8em; color: #a8a29e;">
                                        <strong>Tool:</strong> ${qaPromptData.tool || '-'} | <strong>Kategorisasi:</strong> ${qaPromptData.categorization || '-'} | <strong>Threshold:</strong> ${qaPromptData.threshold || '-'}%
                                    </div>
                                    <pre style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; font-size: 0.8em; color: #e2e8f0; white-space: pre-wrap; word-break: break-word; margin: 0; max-height: 300px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.05);">${qaPromptData.system_prompt || 'Prompt tidak tersedia'}</pre>
                                </div>
                            </details>
                        ` : ''}
                        ${papers.length === 0 ? '<p style="color:#a8a29e; text-align:center;">Tidak ada data QA yang tersedia.</p>' : `
                            <div style="display:flex; flex-direction:column; gap:20px;">
                                ${papers.map(p => {
                                    const paperId = p._id || p.DOI || p.doi || '';
                                    const disagree = isDisagreement(p);
                                    const cardBorder = disagree ? 'border: 2px solid #ef4444;' : 'border: 1px solid rgba(255,255,255,0.05);';
                                    const cardBg = disagree ? 'background: rgba(239, 68, 68, 0.06);' : 'background: rgba(255,255,255,0.03);';
                                    return `
                                    <div class="qa-paper-card" data-paper-id="${paperId}" style="${cardBg} ${cardBorder} border-radius: 8px; overflow: hidden;">
                                        <div style="padding: 12px 15px; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05); font-weight: bold; color: #e2e8f0; display:flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                                            <span>${p.Title || p.title || p.DOI || p.doi || 'Unknown Title'}</span>
                                            <div style="display:flex; align-items:center; gap:10px; flex-wrap: wrap;">
                                                ${disagree ? `<span style="background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid #ef4444; padding: 3px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; white-space: nowrap;">⚠️ Disagreement — Perlu Rate Ulang</span>` : ''}
                                                <button class="btn-rerate-paper" data-paper-id="${paperId}" style="background: #f59e0b; border: none; color: #1c1917; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 4px; transition: background 0.2s;" title="Rate ulang paper ini dengan model saat ini"><span class="ico ico-refresh"></span> Rate Ulang</button>
                                                ${Number(p.qa_total_score || 0) === 0 ? `<button class="btn-delete-qdrant-xai" data-doi="${p.DOI || p.doi || '-'}" data-title="${p.Title || p.title || ''}" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Hapus vektor di database jika PDF rusak/watermark"><span class="ico ico-trash"></span> Hapus Vektor (Fix PDF)</button>` : ''}
                                                <span style="color:#38bdf8; font-size:0.9em;">Final: ${p.qa_final_category || '-'} (${p.qa_total_score || 0})</span>
                                            </div>
                                        </div>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(255,255,255,0.05);">
                                            <div style="padding: 15px; background: #292524;">
                                                <h4 style="margin:0 0 10px 0; color: #5eead4; display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
                                                    <span>Rater 1</span>
                                                    <span style="font-size:0.8em; color:#a8a29e; font-weight:normal;">${p.qa_r1_category||'-'} (${p.qa_r1_score||0})</span>
                                                    ${p.qa_r1_model ? `<span style="font-size:0.7em; background:rgba(56,189,248,0.1); color:#38bdf8; padding:2px 6px; border-radius:4px; border:1px solid rgba(56,189,248,0.2);">${p.qa_r1_model}</span>` : ''}
                                                </h4>
                                                <div style="margin-bottom:8px;">
                                                    <div style="font-size:0.75em; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Reasoning</div>
                                                    <div style="font-size:0.85em; color:#d6d3d1; line-height:1.5;">${p.qa_r1_reasoning || (p.qa_final_category === 'UNRATED' ? '<em>Teks penuh (full-text) tidak tersedia, proses QA dibatalkan secara otomatis.</em>' : '<em>Tidak ada alasan spesifik (skor lama)</em>')}</div>
                                                </div>
                                                <div>
                                                    <div style="font-size:0.75em; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Evidence</div>
                                                    <div style="font-size:0.85em; color:#a8a29e; font-style:italic; border-left:2px solid #475569; padding-left:8px; line-height:1.5;">${p.qa_r1_evidence || '-'}</div>
                                                </div>
                                            </div>
                                            <div style="padding: 15px; background: #292524;">
                                                <h4 style="margin:0 0 10px 0; color: #5eead4; display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
                                                    <span>Rater 2</span>
                                                    <span style="font-size:0.8em; color:#a8a29e; font-weight:normal;">${p.qa_r2_category||'-'} (${p.qa_r2_score||0})</span>
                                                    ${p.qa_r2_model ? `<span style="font-size:0.7em; background:rgba(56,189,248,0.1); color:#38bdf8; padding:2px 6px; border-radius:4px; border:1px solid rgba(56,189,248,0.2);">${p.qa_r2_model}</span>` : ''}
                                                </h4>
                                                <div style="margin-bottom:8px;">
                                                    <div style="font-size:0.75em; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Reasoning</div>
                                                    <div style="font-size:0.85em; color:#d6d3d1; line-height:1.5;">${p.qa_r2_reasoning || (p.qa_final_category === 'UNRATED' ? '<em>Teks penuh (full-text) tidak tersedia, proses QA dibatalkan secara otomatis.</em>' : '<em>Tidak ada alasan spesifik (skor lama)</em>')}</div>
                                                </div>
                                                <div>
                                                    <div style="font-size:0.75em; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Evidence</div>
                                                    <div style="font-size:0.85em; color:#a8a29e; font-style:italic; border-left:2px solid #475569; padding-left:8px; line-height:1.5;">${p.qa_r2_evidence || '-'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `}).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        // Handle re-rate button clicks
        modalContainer.addEventListener('click', async (e) => {
            const rerateBtn = e.target.closest('.btn-rerate-paper');
            if (rerateBtn) {
                const paperId = rerateBtn.getAttribute('data-paper-id');
                if (!paperId) return;
                if (!confirm("Rate ulang paper ini dengan model rater saat ini? Proses ini membutuhkan waktu ~30 detik.")) return;
                
                const originalText = rerateBtn.innerHTML;
                rerateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Rating...';
                rerateBtn.disabled = true;
                rerateBtn.style.opacity = '0.7';
                
                try {
                    const token = localStorage.getItem('auth_token');
                    const rerateRes = await fetch(`${baseURL}/sessions/${sid}/m7/rerate-paper`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ paper_id: paperId })
                    });
                    if (!rerateRes.ok) {
                        const errData = await rerateRes.json().catch(() => ({}));
                        throw new Error(errData.error || "Gagal melakukan re-rating");
                    }
                    const result = await rerateRes.json();
                    
                    // Update the card in-place
                    const card = rerateBtn.closest('.qa-paper-card');
                    if (card) {
                        const finalSpan = card.querySelector('span[style*="color:#38bdf8"]');
                        if (finalSpan) finalSpan.textContent = `Final: ${result.final_category} (${result.final_score})`;
                        
                        // Update rater sections
                        const raterDivs = card.querySelectorAll('div[style*="padding: 15px"]');
                        if (raterDivs[0]) {
                            const h4_r1 = raterDivs[0].querySelector('h4');
                            if (h4_r1) h4_r1.innerHTML = `<span>Rater 1</span> <span style="font-size:0.8em; color:#a8a29e; font-weight:normal;">${result.r1_category} (${result.r1_score})</span> <span style="font-size:0.7em; background:rgba(56,189,248,0.1); color:#38bdf8; padding:2px 6px; border-radius:4px; border:1px solid rgba(56,189,248,0.2);">${result.r1_model}</span>`;
                            const divs_r1 = raterDivs[0].querySelectorAll('div[style*="margin-bottom"]');
                            if (divs_r1[0]) divs_r1[0].querySelector('div:last-child').textContent = result.r1_reasoning || '-';
                            const evidence_r1 = raterDivs[0].querySelector('div[style*="border-left"]');
                            if (evidence_r1) evidence_r1.textContent = result.r1_evidence || '-';
                        }
                        if (raterDivs[1]) {
                            const h4_r2 = raterDivs[1].querySelector('h4');
                            if (h4_r2) h4_r2.innerHTML = `<span>Rater 2</span> <span style="font-size:0.8em; color:#a8a29e; font-weight:normal;">${result.r2_category} (${result.r2_score})</span> <span style="font-size:0.7em; background:rgba(56,189,248,0.1); color:#38bdf8; padding:2px 6px; border-radius:4px; border:1px solid rgba(56,189,248,0.2);">${result.r2_model}</span>`;
                            const divs_r2 = raterDivs[1].querySelectorAll('div[style*="margin-bottom"]');
                            if (divs_r2[0]) divs_r2[0].querySelector('div:last-child').textContent = result.r2_reasoning || '-';
                            const evidence_r2 = raterDivs[1].querySelector('div[style*="border-left"]');
                            if (evidence_r2) evidence_r2.textContent = result.r2_evidence || '-';
                        }
                    }
                    
                    rerateBtn.innerHTML = '✅ Selesai!';
                    rerateBtn.style.background = '#34d399';
                    setTimeout(() => {
                        rerateBtn.innerHTML = originalText;
                        rerateBtn.disabled = false;
                        rerateBtn.style.opacity = '1';
                        rerateBtn.style.background = '#f59e0b';
                    }, 3000);
                } catch (err) {
                    alert("Re-rating gagal: " + err.message);
                    rerateBtn.innerHTML = originalText;
                    rerateBtn.disabled = false;
                    rerateBtn.style.opacity = '1';
                }
                return;
            }

            const target = e.target.closest('.btn-delete-qdrant-xai');
            if (target) {
                const paperDoi = target.getAttribute('data-doi');
                const paperTitle = target.getAttribute('data-title');
                if(!confirm("Apakah Anda yakin ingin menghapus vektor untuk PDF ini dari Qdrant? (Anda harus re-upload ulang PDF yang benar via Notebook nantinya)")) return;
                
                const originalText = target.innerHTML;
                target.innerHTML = 'Menghapus...';
                target.disabled = true;
                
                try {
                    const token = localStorage.getItem('auth_token');
                    const res = await fetch(`${baseURL}/sessions/${sid}/m6/qdrant/paper`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ doi: paperDoi, title: paperTitle })
                    });
                    if (!res.ok) throw new Error("Gagal menghapus vektor dari Qdrant");
                    
                    target.style.display = 'none';
                    const colabLink = "https://colab.research.google.com/github/ifcoid/pede/blob/main/notebooks/pede_colab.ipynb";
                    const successModalHtml = `
                        <div id="success-delete-modal" style="position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(15, 23, 42, 0.9); display: flex; justify-content: center; align-items: center; z-index: 2000; backdrop-filter: blur(8px);">
                            <div style="background: #292524; border-radius: 12px; border: 1px solid #34d399; width: 90vw; max-width: 600px; padding: 25px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); color: #f8fafc;">
                                <h3 style="margin-top:0; color:#34d399; display:flex; align-items:center; gap:10px;">✅ Vektor Berhasil Dihapus!</h3>
                                <p style="line-height: 1.6;">Langkah selanjutnya untuk pemulihan data PDF:</p>
                                <ol style="line-height: 1.6; color:#d6d3d1; padding-left: 20px;">
                                    <li>Pastikan PDF yang benar (tanpa watermark / teks penuh terbaca) sudah berada di folder lokal/Drive Anda.</li>
                                    <li>Buka dan jalankan ulang script <strong>Notebook PEDE Colab/Lokal</strong> khusus untuk paper ini:
                                        <br/><strong style="color:#f8fafc">DOI:</strong> ${paperDoi}
                                        <br/><strong style="color:#f8fafc">Judul:</strong> ${paperTitle}
                                    </li>
                                    <li>Klik tautan berikut untuk membuka Colab secara langsung:
                                        <br/><a href="${colabLink}" target="_blank" style="color:#5eead4; text-decoration:underline; font-weight:bold; display:inline-block; margin-top:8px;"><span class="ico ico-external"></span> Buka Notebook PEDE di Google Colab</a>
                                    </li>
                                    <li>Setelah re-upload sukses, tekan tombol <strong><span class="ico ico-refresh"></span> Sinkronisasi Qdrant</strong> di pojok kanan atas jendela layar ini, lalu klik <strong>⚠️ Ulangi Modul 7</strong> di layar utama untuk mengulang proses QA.</li>
                                </ol>
                                <div style="text-align: right; margin-top: 25px;">
                                    <button id="btn-close-success-modal" style="background: #34d399; color: #1c1917; border: none; padding: 8px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s;">Saya Mengerti</button>
                                </div>
                            </div>
                        </div>
                    `;
                    const successDiv = document.createElement('div');
                    successDiv.innerHTML = successModalHtml;
                    document.body.appendChild(successDiv);
                    document.getElementById('btn-close-success-modal').addEventListener('click', () => {
                        successDiv.remove();
                    });
                } catch (err) {
                    alert(err.message);
                    target.innerHTML = originalText;
                    target.disabled = false;
                }
            }
        });

        document.getElementById('btn-close-qa-xai').addEventListener('click', () => {
            document.body.removeChild(modalContainer);
        });

        const btnXaiSync = document.getElementById('btn-xai-sync');
        if (btnXaiSync) {
            btnXaiSync.addEventListener('click', async () => {
                try {
                    btnXaiSync.disabled = true;
                    btnXaiSync.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Sinkronisasi...';
                    const req = await fetch(`${baseURL}/sessions/${sid}/m6/sync-qdrant`, { 
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                    });
                    if (!req.ok) throw new Error("Sinkronisasi gagal");
                    const resSync = await req.json();
                    alert("Sinkronisasi Qdrant berhasil! Tersinkron: " + resSync.synced_count);
                    window.location.reload();
                } catch(e) {
                    alert(e.message);
                    btnXaiSync.disabled = false;
                    btnXaiSync.innerHTML = '<span class="ico ico-refresh"></span> Sinkronisasi Qdrant';
                }
            });
        }
    } catch (err) {
        alert("Gagal memuat data QA: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="ico ico-search"></span> Buka Detail Keputusan Rater (xAI)';
        }
    }
};

window.downloadQAXAIMarkdown = async (btn) => {
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Mendownload...';
    }
    try {
        const sid = localStorage.getItem('activeSessionId');
        const baseURL = getBaseURL();
        const res = await fetch(`${baseURL}/sessions/${sid}/extractions`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });
        if (!res.ok) throw new Error("Gagal mengambil data ekstraksi");
        const data = await res.json();
        const papers = (data.extractions || []).filter(p => p.qa_rated === true).sort((a, b) => Number(a.qa_total_score || 0) - Number(b.qa_total_score || 0));
        
        let md = `# Detail Keputusan Quality Appraisal (xAI)\n\n`;
        if (papers.length === 0) {
            md += `Tidak ada data QA yang tersedia.\n`;
        } else {
            papers.forEach(p => {
                md += `## ${p.Title || p.title || p.DOI || p.doi || 'Unknown Title'}\n`;
                md += `- **Keputusan Final**: ${p.qa_final_category || '-'} (Skor: ${p.qa_total_score || 0})\n\n`;
                
                md += `### Rater 1\n`;
                if (p.qa_r1_model) md += `- **Model AI**: ${p.qa_r1_model}\n`;
                md += `- **Kategori**: ${p.qa_r1_category || '-'} (Skor: ${p.qa_r1_score || 0})\n`;
                md += `- **Reasoning**: ${(p.qa_r1_reasoning || '').replace(/\\n/g, ' ') || (p.qa_final_category === 'UNRATED' ? 'Teks penuh tidak tersedia' : 'Tidak ada alasan spesifik')}\n\n`;
                
                md += `### Rater 2\n`;
                if (p.qa_r2_model) md += `- **Model AI**: ${p.qa_r2_model}\n`;
                md += `- **Kategori**: ${p.qa_r2_category || '-'} (Skor: ${p.qa_r2_score || 0})\n`;
                md += `- **Reasoning**: ${(p.qa_r2_reasoning || '').replace(/\\n/g, ' ') || (p.qa_final_category === 'UNRATED' ? 'Teks penuh tidak tersedia' : 'Tidak ada alasan spesifik')}\n\n`;
                
                md += `---\n\n`;
            });
        }
        
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'QAXAI_Detail_Keputusan.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert("Gagal mendownload data xAI: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="ico ico-download"></span> Download Detail Keputusan (Markdown)';
        }
    }
};

window.resetModul7 = async () => {
    try {
        const sid = localStorage.getItem('activeSessionId');
        if (!sid) return;
        const baseURL = getBaseURL();
        const res = await fetch(`${baseURL}/sessions/${sid}/reset-m7`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Gagal mereset Modul 7");
        }
        alert("Modul 7 berhasil direset. Halaman akan dimuat ulang.");
        window.location.reload();
    } catch(err) {
        alert("Error reset Modul 7: " + err.message);
    }
};
