// js/components/renderer.js
export function renderApprovalContent(area, session, handleApproval) {
    const status = session.status;
    let html = '';

    const wrapCard = (title, content) => `
        <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
            <h4 style="margin-top: 0; color: #60a5fa; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">${title}</h4>
            ${content}
        </div>
    `;

    const formatMarkdown = (md) => {
        if (!md) return '';
        // Sangat simpel markdown parser
        return md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                 .replace(/\*(.*?)\*/g, '<em>$1</em>')
                 .replace(/\n/g, '<br>');
    };

    if (status === 'M2_STEP2_WAITING_APPROVAL' && session.prior_reviews_matrix) {
        let cards = '';
        if (session.prior_reviews_matrix.reviews) {
            session.prior_reviews_matrix.reviews.forEach((r, idx) => {
                cards += `
                <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #8b5cf6;">
                    <h5 style="margin-top: 0; color: #c4b5fd; margin-bottom: 10px; font-size: 1.05em;"><i class="fa fa-book"></i> ${r.author_year || 'Unknown'}</h5>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.9em; line-height: 1.5;">
                        <div><strong style="color: #9ca3af;">Scope:</strong><br>${r.scope || '-'}</div>
                        <div><strong style="color: #9ca3af;">Methodology:</strong><br>${r.methodology || '-'}</div>
                        <div style="grid-column: 1 / -1;"><strong style="color: #9ca3af;">Key Findings:</strong><br>${r.key_findings || '-'}</div>
                        <div style="grid-column: 1 / -1;"><strong style="color: #9ca3af;">Limitations:</strong><br>${r.limitations || '-'}</div>
                        <div style="grid-column: 1 / -1; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #ef4444;">
                            <strong style="color: #fca5a5;">Selisih (Gap):</strong> ${r.selisih || '-'}
                        </div>
                        <div style="grid-column: 1 / -1; background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #10b981;">
                            <strong style="color: #6ee7b7;">Synthesis Novelty:</strong> ${r.synthesis_novelty || '-'}
                        </div>
                    </div>
                </div>`;
            });
        }
        
        html = wrapCard('Review of Prior Reviews (Matrix)', cards);

    } else if (status === 'M2_STEP3_WAITING_APPROVAL' && session.pico_definitions) {
        const pico = session.pico_definitions;
        html = wrapCard('PICO Definitions', `
            <p><strong>Canonical Term:</strong> ${pico.canonical_term ? pico.canonical_term.term : ''} (${pico.canonical_term ? pico.canonical_term.justification : ''})</p>
            <hr style="border-color: rgba(255,255,255,0.1);">
            <p><strong>Population:</strong> ${pico.p ? pico.p.operational_def.definition : ''}</p>
            <p><em>What Counts:</em> ${pico.p ? pico.p.operational_def.what_counts : ''}</p>
            <p><em>What Doesn't:</em> ${pico.p ? pico.p.operational_def.what_doesnt_count : ''}</p>
            <hr style="border-color: rgba(255,255,255,0.1);">
            <p><strong>Intervention:</strong> ${pico.i ? pico.i.operational_def.definition : ''}</p>
            <p><em>What Counts:</em> ${pico.i ? pico.i.operational_def.what_counts : ''}</p>
            <p><em>What Doesn't:</em> ${pico.i ? pico.i.operational_def.what_doesnt_count : ''}</p>
            <hr style="border-color: rgba(255,255,255,0.1);">
            <p><strong>Comparison:</strong> ${pico.c ? pico.c.operational_def.definition : ''}</p>
            <hr style="border-color: rgba(255,255,255,0.1);">
            <p><strong>Outcome:</strong> ${pico.o ? pico.o.operational_def.definition : ''}</p>
        `);

    } else if (status === 'M2_STEP3_5_WAITING_FILTERS') {
        let filtersHtml = `
            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="color: #fca5a5;">Aksi Diperlukan: Isi Scope Filters</h4>
                <p>Silakan isi detail batasan riset Anda:</p>
                <form id="form-filters">
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Rentang Waktu (Misal: 2018-2024)</label>
                        <input type="text" id="filter-waktu" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${session.scope_filters?.waktu || '[ISI DI SINI...]'}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Tipe Dokumen (Misal: Journal Article & Conference Paper)</label>
                        <input type="text" id="filter-tipe" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${session.scope_filters?.tipe_dokumen || '[ISI DI SINI...]'}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Sektor Publikasi (Misal: Computer Science & Medicine)</label>
                        <input type="text" id="filter-sektor" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${session.scope_filters?.sektor || '[ISI DI SINI...]'}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Bahasa (Misal: English)</label>
                        <input type="text" id="filter-bahasa" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${session.scope_filters?.bahasa || '[ISI DI SINI...]'}">
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
                        waktu: document.getElementById('filter-waktu').value,
                        tipe_dokumen: document.getElementById('filter-tipe').value,
                        sektor: document.getElementById('filter-sektor').value,
                        bahasa: document.getElementById('filter-bahasa').value
                    };
                    
                    try {
                        const btn = e.target.querySelector('button');
                        btn.textContent = "Menyimpan...";
                        btn.disabled = true;
                        
                        await fetch(`http://localhost:50607/api/sessions/${session.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                scope_filters: filterData,
                                status: 'M2_STEP3_5_FILTERS_PROVIDED'
                            })
                        });
                        
                        // force reload
                        window.location.reload();
                    } catch (error) {
                        alert("Gagal update filter: " + error);
                    }
                });
            }
        }, 100);
        return true; // We handled rendering completely

    } else if (status === 'M2_STEP4_WAITING_APPROVAL' && session.scope_justifications) {
        const sc = session.scope_justifications;
        html = wrapCard('Scope Justifications', `
            <p><strong>Theoretical:</strong> ${sc.theoretical ? sc.theoretical.justification : ''}</p>
            <p><strong>Methodological:</strong> ${sc.methodological ? sc.methodological.justification : ''}</p>
            <p><strong>Practical:</strong> ${sc.practical ? sc.practical.justification : ''}</p>
        `);

    } else if (status === 'M2_STEP5_WAITING_APPROVAL' && session.research_questions) {
        let rqList = '<ul style="list-style: none; padding: 0;">';
        session.research_questions.forEach((rq, idx) => {
            const warning = rq.is_orphan ? '<span style="color: #fca5a5; font-size: 0.8em; margin-left: 10px;">[⚠️ ORPHAN]</span>' : '';
            rqList += `
                <li style="margin-bottom: 1rem; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; border-left: 4px solid ${rq.is_orphan ? '#ef4444' : '#3b82f6'};">
                    <strong>${rq.id}:</strong> ${rq.question} ${warning}<br>
                    <small style="color: #9ca3af;">Type: ${rq.type} | Trace: ${rq.traceability}</small>
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
            <p><strong>Feasibility:</strong> ${finer.f ? finer.f.reasoning : ''}</p>
            <p><strong>Interesting:</strong> ${finer.i ? finer.i.reasoning : ''}</p>
            <p><strong>Novelty:</strong> ${finer.n ? finer.n.reasoning : ''}</p>
            <p><strong>Ethical:</strong> ${finer.e ? finer.e.reasoning : ''}</p>
            <p><strong>Relevant:</strong> ${finer.r ? finer.r.reasoning : ''}</p>
            <p><strong>Rekomendasi Utama:</strong> ${finer.actionable_recommendation || ''}</p>
            ${session.modul2_summary ? `<hr style="border-color: rgba(255,255,255,0.1);"><p><strong>Summary:</strong><br>${formatMarkdown(session.modul2_summary.markdown)}</p>` : ''}
        `);

    } else if (status === 'M3_STEP1_WAITING_APPROVAL' && session.database_selection) {
        const dbs = session.database_selection;
        let dbList = '<ul>';
        if (dbs.databases) {
            dbs.databases.forEach(db => {
                dbList += `<li><strong>${db.name}</strong>: Coverage: ${db.coverage_strength} | Limit: ${db.limitation}</li>`;
            });
        }
        dbList += '</ul>';
        html = wrapCard('Database Selection', `
            ${dbList}
            <p><strong>Final Justification:</strong><br>${dbs.final_justification || ''}</p>
        `);

    } else if (status === 'M3_STEP2_WAITING_APPROVAL' && session.keywords) {
        let kwList = '';
        if (session.keywords && Array.isArray(session.keywords)) {
            session.keywords.forEach(kw => {
                kwList += `
                    <div style="margin-bottom: 1rem; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                        <strong>PICO Element: ${kw.pico_element}</strong><br>
                        <em>Synonyms:</em> ${kw.main_synonyms ? kw.main_synonyms.join(', ') : ''}<br>
                        <em style="color: #fca5a5;">Avoid:</em> ${kw.avoid_list ? kw.avoid_list.join(', ') : ''}
                    </div>
                `;
            });
        }
        html = wrapCard('Keywords Development', kwList);

    } else if (status === 'M3_STEP3_WAITING_APPROVAL' && session.search_string) {
        const ss = session.search_string;
        let filters = '<ul>';
        if (ss.filters) {
            ss.filters.forEach(f => {
                filters += `<li><strong>${f.type} (${f.value}):</strong> ${f.justification}</li>`;
            });
        }
        filters += '</ul>';
        html = wrapCard('Search String', `
            <div style="background: #1e1e1e; padding: 15px; border-radius: 6px; font-family: monospace; color: #a78bfa; margin-bottom: 1rem; overflow-x: auto;">
                ${ss.scopus_query}
            </div>
            <p><strong>Filters Applied:</strong></p>
            ${filters}
        `);

    } else if (status === 'M3_STEP4_WAITING_EXECUTION') {
        let execHtml = `
            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="color: #60a5fa;">Aksi Diperlukan: Eksekusi Manual di Scopus</h4>
                <p><strong>Query:</strong></p>
                <div style="background: #1e1e1e; padding: 15px; border-radius: 6px; font-family: monospace; color: #a78bfa; margin-bottom: 1rem; overflow-x: auto;">
                    ${session.search_string ? session.search_string.scopus_query : 'Kueri tidak ditemukan.'}
                </div>
                <p>Silakan buka Scopus, jalankan query di atas, aplikasikan filter (Tahun, Tipe Dokumen, dll). Lalu laporkan hasilnya di bawah:</p>
                <form id="form-scopus-hits">
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Total Hits (Hasil Pencarian Akhir)</label>
                        <input type="text" id="input-hits" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" placeholder="Misal: 145 dokumen" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Simpan Hits & Lanjut Evaluasi</button>
                </form>
            </div>
        `;
        area.insertAdjacentHTML('beforeend', execHtml);
        
        setTimeout(() => {
            const formHits = document.getElementById('form-scopus-hits');
            if (formHits) {
                formHits.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const hits = document.getElementById('input-hits').value;
                    
                    try {
                        const btn = e.target.querySelector('button');
                        btn.textContent = "Menyimpan...";
                        btn.disabled = true;
                        
                        await fetch(`http://localhost:50607/api/sessions/${session.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                feedback: hits,
                                status: 'M3_STEP4_EVALUATION'
                            })
                        });
                        
                        window.location.reload();
                    } catch (error) {
                        alert("Gagal update hits: " + error);
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
        let initHtml = `
            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="color: #60a5fa;">M4: Finalisasi Eksekusi Scopus & Sanity Check</h4>
                <p>Mohon melengkapi data dari pencarian final Anda (Modul 4) ke formulir ini:</p>
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
                    <button type="submit" class="btn btn-primary">Lakukan Sanity Check</button>
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
                    
                    try {
                        const btn = e.target.querySelector('button');
                        btn.textContent = "Menyimpan...";
                        btn.disabled = true;
                        
                        await fetch(`http://localhost:50607/api/sessions/${session.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                data_mining_log: newDataMiningLog,
                                status: 'M4_STEP1_EVALUATE'
                            })
                        });
                        
                        window.location.reload();
                    } catch (error) {
                        alert("Gagal update data: " + error);
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
        html = wrapCard('Import CSV Data', `
            <p>1. Export CSV dari Scopus, IEEE, dll.</p>
            <p>2. Tambahkan kolom <strong>Database</strong> di Excel (misal diisi: 'Scopus').</p>
            <p>3. Buka <strong>MongoDB Compass</strong>.</p>
            <p>4. Buka database <strong>nsa</strong>, buat collection <strong>slr_papers</strong> jika belum ada.</p>
            <p>5. Klik <strong>Add Data -> Import File</strong> dan masukkan gabungan CSV Anda ke sana.</p>
            <p>6. Klik <strong>Proses Deduplikasi</strong> di bawah ini.</p>
            <button id="btn-process-dedup" class="btn btn-primary" style="margin-top: 15px;">Proses Deduplikasi</button>
        `);
        
        area.insertAdjacentHTML('beforeend', html);
        
        setTimeout(() => {
            const btnDedup = document.getElementById('btn-process-dedup');
            if (btnDedup) {
                btnDedup.addEventListener('click', async () => {
                    try {
                        btnDedup.textContent = "Memproses...";
                        btnDedup.disabled = true;
                        
                        await fetch(`http://localhost:50607/api/sessions/${session.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'M4_STEP2_PROCESS' })
                        });
                        
                        window.location.reload();
                    } catch (error) {
                        alert("Gagal memproses dedup: " + error);
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
                    <h5 style="color: #a78bfa; margin-top: 0;">Basic Quality Audit</h5>
                    <p>Total Records: ${audit.total_records || 0}</p>
                    <p>Missing Abstract: ${audit.missing_abstract || 0}</p>
                    <p>Missing DOI: ${audit.missing_doi || 0}</p>
                </div>
                <div>
                    <h5 style="color: #a78bfa; margin-top: 0;">Deduplication</h5>
                    <p>Total Unique: <span style="color: #4ade80;">${dedup.total_unique || 0}</span></p>
                    <p>Duplicates Removed: <span style="color: #fca5a5;">${dedup.total_duplicates || 0}</span></p>
                </div>
            </div>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
            <h5 style="color: #a78bfa; margin-top: 0;">LLM PICO Preview (20 Sampel)</h5>
            <p><strong>Match Ratio:</strong> ${pico.match_counts_pct || 0}%</p>
            <p><strong>Verdict:</strong> <span style="color: ${pico.verdict?.includes('PROCEED') ? '#4ade80' : '#fca5a5'};">${pico.verdict || ''}</span></p>
            <p><strong>Recommendation:</strong> ${pico.recommendation || ''}</p>
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
        html = wrapCard('Screener Briefing Document', `
            <p><strong>Decision:</strong> <span style="color: ${sb.decision === 'PROCEED' ? '#4ade80' : '#fca5a5'};">${sb.decision}</span></p>
            <p><strong>Validation Gap:</strong> ${sb.validation_gap}</p>
            <p><strong>Recommendation:</strong> ${sb.recommendation}</p>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
            <h5 style="color: #a78bfa; margin-top: 0;">Briefing Document (Sent to Dual-Agents):</h5>
            <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; font-size: 0.85em; max-height: 200px; overflow-y: auto;">
                ${formatMarkdown(sb.briefing_doc)}
            </div>
        `);

    } else if (status === 'M5_STEP2_WAITING_APPROVAL') {
        const kal = session.kalibrasi_log ? session.kalibrasi_log[session.kalibrasi_log.length-1] : null;
        let info = '';
        if (kal) {
            info = `<p><strong>Iterasi:</strong> ${kal.iterasi}</p>
                    <p><strong>Agreement Pct:</strong> ${kal.agreement_pct.toFixed(2)}%</p>
                    <p><strong>Cohen's Kappa:</strong> <span style="color: ${kal.passed ? '#4ade80' : '#fca5a5'}; font-size: 1.2em; font-weight: bold;">${kal.kappa.toFixed(3)}</span></p>
                    <p><strong>Status:</strong> ${kal.passed ? 'PASSED (>= 0.60)' : 'FAILED (< 0.60)'}</p>`;
        }
        
        html = wrapCard('Hasil Kalibrasi Dual-Review (20 Sampel)', `
            ${info}
            <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
            <p>Jika FAILED, buka Compass koleksi <strong>slr_screening</strong>, cari yang <code>Agreement: DISAGREE</code>, pelajari AI Notes, lalu kirim Revisi kriteria ke form di bawah agar Briefing di-update lalu rerun Kalibrasi.</p>
        `);

    } else if (status === 'M5_STEP3_WAITING_RESOLUTION') {
        const bLog = session.screening_results_log ? session.screening_results_log[session.screening_results_log.length-1] : null;
        let info = '';
        if (bLog) {
            info = `<p><strong>Batch Number:</strong> ${bLog.batch_number}</p>
                    <p><strong>Processed:</strong> ${bLog.processed_records}</p>
                    <p><strong>Disagreement Cases:</strong> <span style="color: #fca5a5;">${bLog.disagreement_cases}</span></p>
                    <p><strong>Current Kappa:</strong> ${bLog.current_kappa.toFixed(3)} ${bLog.drift_detected ? '<span style="color:#fca5a5;">(DRIFT WARNING)</span>' : ''}</p>`;
        }
        
        html = wrapCard('Batch Screening Selesai', `
            ${info}
            <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
            <p>Sesi dijeda agar Anda (HitL) dapat menyelesaikan <strong>Disagreements</strong>.</p>
            <p>1. Buka MongoDB Compass -> koleksi <strong>slr_screening</strong>.<br>
            2. Filter <code>{ "Agreement": "DISAGREE" }</code>.<br>
            3. Baca <code>Conflict_Resolution</code> saran AI.<br>
            4. Tentukan <code>Final_Decision</code> secara manual.<br>
            5. Jika sudah, klik 'Setuju & Lanjut' untuk mengeksekusi batch selanjutnya atau menamatkan Modul 5.</p>
        `);

    } else if (status === 'M5_STEP4_WAITING_APPROVAL' || status === 'M5_DONE') {
        const ex = session.exclusion_table || {};
        html = wrapCard('Screening Selesai (Modul 5 Summary)', `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                    <h5 style="color: #a78bfa; margin-top: 0;">Flow Numbers</h5>
                    <pre style="background: rgba(0,0,0,0.2); padding: 10px; font-size: 0.85em; border-radius: 4px;">${ex.flow_numbers || ''}</pre>
                </div>
                <div>
                    <h5 style="color: #a78bfa; margin-top: 0;">Kappa Report</h5>
                    <pre style="background: rgba(0,0,0,0.2); padding: 10px; font-size: 0.85em; border-radius: 4px;">${ex.kappa_report || ''}</pre>
                </div>
            </div>
            <h5 style="color: #a78bfa; margin-top: 15px;">PICO Audit (10% Sample)</h5>
            <pre style="background: rgba(0,0,0,0.2); padding: 10px; font-size: 0.85em; border-radius: 4px;">${ex.pico_audit || ''}</pre>
        `);
    }

    if (html !== '') {
        area.insertAdjacentHTML('beforeend', html);
        
        area.insertAdjacentHTML('beforeend', `
            <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                <p style="margin-bottom: 1rem;">Apakah Anda setuju dengan hasil di atas?</p>
                <div style="display: flex; gap: 1rem;">
                    <button id="btn-generic-approve" class="btn btn-success">Setuju & Lanjut</button>
                </div>
            </div>
        `);
        setTimeout(() => {
            const btnApprove = document.getElementById('btn-generic-approve');
            if (btnApprove) {
                btnApprove.addEventListener('click', () => handleApproval({}));
            }
        }, 0);
        return true;
    }

    return false;
}
