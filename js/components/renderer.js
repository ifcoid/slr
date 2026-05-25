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
        
        // Percantik teks gaya === JUDUL ===
        md = md.replace(/^===\s*(.*?)\s*===$/gm, '\n\n<div style="background: linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, transparent 100%); border-left: 4px solid #3b82f6; padding: 6px 15px; font-weight: bold; color: #93c5fd; font-size: 0.9em; letter-spacing: 1px; text-transform: uppercase; margin: 10px 0; border-radius: 4px; display: block;">$1</div>\n\n');

        if (window.marked) {
            return window.marked.parse(md);
        }
        // Fallback simpel markdown parser
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
                        <input type="text" id="filter-tahun" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${session.scope_filters?.rentang_tahun || ''}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Geografis (Misal: Global, Asia, USA)</label>
                        <input type="text" id="filter-geografis" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${session.scope_filters?.geografis || 'Global'}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Sektor / Bidang (Misal: Computer Science & Medicine)</label>
                        <input type="text" id="filter-sektor" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${session.scope_filters?.sektor || ''}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Bahasa (Misal: English only)</label>
                        <input type="text" id="filter-bahasa" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${session.scope_filters?.bahasa || 'English only'}">
                    </div>
                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label>Lainnya (Misal: Hanya Jurnal Peer-Reviewed, Bebas Konferensi)</label>
                        <input type="text" id="filter-lainnya" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #222; color: #fff;" value="${session.scope_filters?.lainnya || ''}">
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
                        
                        await fetch(`http://localhost:50607/api/sessions/${session.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                scope_filters: filterData,
                                status: 'M2_STEP3_5_FILTERS_PROVIDED'
                            })
                        });
                        
                        window.location.reload();
                    } catch (error) {
                        alert("Gagal update filter: " + error);
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

                return `<a href="${url}" target="_blank" style="color: #60a5fa; text-decoration: none; border-bottom: 1px dotted #60a5fa;">${domain}</a>` + trailing;
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
                <li style="margin-bottom: 1rem; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 4px; border-left: 4px solid ${rq.is_orphan ? '#ef4444' : '#3b82f6'};">
                    <h5 style="margin-top: 0; margin-bottom: 10px; color: #60a5fa; font-size: 1.05em;">RQ ${idx + 1} <span style="color: #a78bfa; font-size: 0.85em; font-weight: normal; margin-left: 10px;">(${rq.type})</span> ${warning}</h5>
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
                    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #3b82f6;">
                        <h5 style="margin-top: 0; color: #93c5fd; font-size: 1.05em;">${db.database}</h5>
                        <div style="margin-bottom: 8px;"><strong>Coverage:</strong> ${db.coverage_strength}</div>
                        <div style="margin-bottom: 8px;"><strong>Limitation:</strong> ${db.limitation}</div>
                        <div><strong>Fit dengan Topik:</strong> ${db.fit_dengan_topik}</div>
                    </div>
                `;
            });
        }

        html = wrapCard('Database Selection', `
            <div style="margin-bottom: 15px;"><strong>Coverage Bidang:</strong><br> ${formatMarkdown(dbs.cek_coverage_bidang)}</div>
            <h5 style="color: #a78bfa; margin-top: 20px;">Matriks Evaluasi Database</h5>
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
                        <div style="margin-bottom: 1rem; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; border-left: 4px solid #8b5cf6;">
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
            adaptedHtml = '<h5 style="color: #a78bfa; margin-top: 20px;">Adapted Strings (Other Databases)</h5>';
            ss.adapted_strings.forEach(ad => {
                adaptedHtml += `
                    <div style="margin-bottom: 15px;">
                        <strong>${ad.database}</strong>
                        <div style="background: #1e1e1e; padding: 10px; border-radius: 4px; font-family: monospace; color: #93c5fd; font-size: 0.9em; margin-top: 5px; overflow-x: auto;">
                            ${ad.query}
                        </div>
                    </div>
                `;
            });
        }
        
        html = wrapCard('Search String', `
            <div style="background: #1e1e1e; padding: 15px; border-radius: 6px; font-family: monospace; color: #a78bfa; margin-bottom: 1rem; overflow-x: auto;">
                ${ss.scopus_query}
            </div>
            ${adaptedHtml}
            <p><strong>Filters Applied:</strong></p>
            ${filters}
        `);

    } else if (status === 'M3_STEP4_WAITING_EXECUTION') {
        let execHtml = `
            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="color: #60a5fa;">Aksi Diperlukan: Eksekusi Manual di Scopus</h4>
                
                ${session.search_string && session.search_string.pre_validation ? `
                <div style="background: rgba(234, 179, 8, 0.1); border-left: 4px solid #eab308; padding: 10px 15px; margin-bottom: 1rem; border-radius: 4px;">
                    <h5 style="color: #eab308; margin-top: 0; margin-bottom: 8px;">⚠️ Hasil Pre-Validasi (Penting)</h5>
                    <div style="font-size: 0.9em;">
                        ${formatMarkdown(session.search_string.pre_validation)}
                    </div>
                </div>
                ` : ''}

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
        const ssInfo = session.search_log ? `
            <div style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 1.5rem; border-radius: 4px;">
                <h5 style="color: #60a5fa; margin-top: 0; margin-bottom: 8px;">ℹ️ Referensi Search String (Final)</h5>
                <p style="font-size: 0.9em; margin-bottom: 8px;">Silakan <em>copy-paste</em> kueri di bawah ini ke <a href="https://www.scopus.com/pages/search/publications?type=advanced" target="_blank" style="color: #60a5fa; font-weight: bold; text-decoration: underline;">Scopus Advanced Search ↗</a> untuk mengeksekusi pencarian akhir:</p>
                <div style="background: #1e1e1e; padding: 10px; border-radius: 4px; font-family: monospace; color: #a78bfa; font-size: 0.9em; margin-bottom: 10px; overflow-x: auto; white-space: pre-wrap;">
                    ${session.search_log.search_string_final}
                </div>
                <div style="font-size: 0.85em; color: #d1d5db;">
                    <strong>Filter yang Berlaku:</strong> ${session.search_log.filters_applied ? session.search_log.filters_applied.map(f => `${f.filter} (${f.value})`).join(' | ') : '-'}
                </div>
            </div>
        ` : '';

        let initHtml = `
            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="color: #60a5fa;">M4: Finalisasi Eksekusi Scopus & Sanity Check</h4>
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
                    newDataMiningLog.initial_sample.sample_titles = document.getElementById('m4-titles').value.split('\n').filter(t => t.trim() !== '');
                    newDataMiningLog.initial_sample.key_papers_found = document.getElementById('m4-found').value.split('\n').filter(t => t.trim() !== '');
                    newDataMiningLog.initial_sample.key_papers_missing = document.getElementById('m4-missing').value.split('\n').filter(t => t.trim() !== '');
                    
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
        let importHtml = `
            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="color: #60a5fa;">M4: Import Data (Multi-Database)</h4>
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
                        
                        const res = await fetch(\`http://localhost:50607/api/sessions/\${session.id}/import-data\`, {
                            method: 'POST',
                            body: formData // Jangan set Content-Type, biarkan browser set multipart/form-data boundary
                        });
                        
                        if (!res.ok) {
                            const err = await res.json();
                            throw new Error(err.error || 'Terjadi kesalahan saat mengunggah file.');
                        }
                        
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
