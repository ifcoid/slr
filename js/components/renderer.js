// js/components/renderer.js
import { API } from '../api.js';
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
        
        html = wrapCard('Search String (Scopus Utama)', `
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
                <h4 style="color: #60a5fa;">Aksi Diperlukan: Eksekusi Manual Database</h4>
                
                ${session.search_string && session.search_string.pre_validation ? `
                <div style="background: rgba(234, 179, 8, 0.1); border-left: 4px solid #eab308; padding: 10px 15px; margin-bottom: 1rem; border-radius: 4px;">
                    <h5 style="color: #eab308; margin-top: 0; margin-bottom: 8px;">⚠️ Hasil Pre-Validasi (Penting)</h5>
                    <div style="font-size: 0.9em;">
                        ${formatMarkdown(session.search_string.pre_validation)}
                    </div>
                </div>
                ` : ''}

                <p><strong>Query Scopus:</strong></p>
                <div style="background: #1e1e1e; padding: 15px; border-radius: 6px; font-family: monospace; color: #a78bfa; margin-bottom: 1rem; overflow-x: auto;">
                    ${session.search_string ? session.search_string.scopus_query : 'Kueri tidak ditemukan.'}
                </div>
                ${session.search_string && session.search_string.adapted_strings ? session.search_string.adapted_strings.map(ad => {
                    let dbLink = '';
                    if (ad.database.toLowerCase().includes('ieee')) dbLink = ' <a href="https://ieeexplore.ieee.org/search/advanced/command" target="_blank" style="color: #60a5fa; text-decoration: underline; font-size: 0.9em; font-weight: normal;">(Buka IEEE Command Search ↗)</a>';
                    else if (ad.database.toLowerCase().includes('pubmed')) dbLink = ' <a href="https://pubmed.ncbi.nlm.nih.gov/advanced/" target="_blank" style="color: #60a5fa; text-decoration: underline; font-size: 0.9em; font-weight: normal;">(Buka PubMed Advanced Search ↗)</a>';
                    else if (ad.database.toLowerCase().includes('web of science')) dbLink = ' <a href="https://www.webofscience.com/wos/alldb/advanced-search" target="_blank" style="color: #60a5fa; text-decoration: underline; font-size: 0.9em; font-weight: normal;">(Buka WoS Advanced Search ↗)</a>';
                    return `
                    <p style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px;">
                        <strong>Query ${ad.database}:</strong>
                        ${dbLink}
                    </p>
                    <div style="background: #1e1e1e; padding: 10px; border-radius: 4px; font-family: monospace; color: #93c5fd; font-size: 0.9em; margin-bottom: 1rem; overflow-x: auto;">
                        ${ad.query}
                    </div>
                    `;
                }).join('') : ''}
                <p>Silakan buka <a href="https://www.scopus.com/pages/search/publications?type=advanced" target="_blank" style="color: #60a5fa; text-decoration: underline;">Scopus Advanced Search ↗</a> (serta database lain yang telah Anda pilih), jalankan query masing-masing, aplikasikan filter di bawah ini. Lalu laporkan hasilnya pada kolom yang tersedia:</p>
                
                <div style="background: rgba(167, 139, 250, 0.1); border-left: 4px solid #a78bfa; padding: 10px 15px; margin-bottom: 1rem; border-radius: 4px; font-size: 0.9em;">
                    <strong style="color: #a78bfa;">Filter yang Wajib Diterapkan:</strong>
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
                    ${session.search_string?.scopus_query || session.search_log.search_string_final}
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
                    dbLink = `<a href="https://pubmed.ncbi.nlm.nih.gov/advanced/" target="_blank" style="color: #60a5fa; text-decoration: underline;">${ad.database} ↗</a>`;
                } else if (ad.database.toLowerCase().includes('ieee')) {
                    dbLink = `<a href="https://ieeexplore.ieee.org/search/advanced/command" target="_blank" style="color: #60a5fa; text-decoration: underline;">${ad.database} ↗</a>`;
                }
                return `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <strong style="color: #cbd5e1;">${dbLink}</strong>
                    <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; font-family: monospace; color: #a78bfa; font-size: 0.85em; margin: 4px 0; overflow-x: auto; white-space: pre-wrap;">${ad.query}</div>
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
                    <strong style="color: #cbd5e1;"><a href="https://ieeexplore.ieee.org/search/advanced/command" target="_blank" style="color: #60a5fa; text-decoration: underline;">IEEE Xplore ↗</a> (Auto-adapted)</strong>
                    <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; font-family: monospace; color: #a78bfa; font-size: 0.85em; margin: 4px 0; overflow-x: auto; white-space: pre-wrap;">${ieeeFallback}</div>
                    <div style="font-size: 0.8em; color: #9ca3af; margin-top: 4px;"><em>Catatan: Simbol wildcard (*) telah dihapus otomatis karena batasan maksimal 10 wildcard dari IEEE. IEEE sudah memiliki fitur auto-stemming.</em></div>
                </div>
            `;
        }

        let refHtml = `
            <div style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 1.5rem; border-radius: 4px;">
                <h5 style="color: #60a5fa; margin-top: 0; margin-bottom: 8px;">ℹ️ Referensi Kueri & Panduan Ekspor</h5>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #cbd5e1;"><a href="https://www.scopus.com/pages/search/publications?type=advanced" target="_blank" style="color: #60a5fa; text-decoration: underline;">Scopus ↗</a></strong>
                    <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; font-family: monospace; color: #a78bfa; font-size: 0.85em; margin: 4px 0; overflow-x: auto; white-space: pre-wrap;">${scopusQuery}</div>
                    <div style="font-size: 0.8em; color: #9ca3af;"><em>Export: Select All > Export > CSV (centang Citation, Abstract, dsb)</em></div>
                </div>
                ${adaptedHtml}
                
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <strong style="color: #cbd5e1;">Filter yang Berlaku (Gunakan ini di semua database):</strong>
                    <div style="font-size: 0.85em; color: #d1d5db; margin-top: 4px;">${filterText}</div>
                </div>
                
                <div style="margin-top: 15px; font-size: 0.85em; color: #9ca3af;">
                    <strong>Panduan Ekspor Lainnya:</strong><br>
                    - <a href="https://ieeexplore.ieee.org/search/advanced/command" target="_blank" style="color: #60a5fa; text-decoration: underline;">IEEE Xplore ↗</a>: Command Search > Export > CSV<br>
                    - <a href="https://pubmed.ncbi.nlm.nih.gov/advanced/" target="_blank" style="color: #60a5fa; text-decoration: underline;">PubMed ↗</a>: Advanced Search > Save > Format: CSV / PubMed (NBIB)<br>
                </div>
            </div>
        `;

        let importHtml = `
            <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4 style="color: #60a5fa;">M4: Import Data (Multi-Database)</h4>
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
                        
                        const res = await fetch(`http://localhost:50607/api/sessions/${session.id}/import-data`, {
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
            ${pico.samples_analyzed && pico.samples_analyzed.length > 0 ? `
                <details style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                    <summary style="cursor: pointer; color: #60a5fa; font-weight: bold; margin-bottom: 10px;">Lihat Rincian Penilaian Sampel (${pico.samples_analyzed.length} Paper)</summary>
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
                    <summary style="cursor: pointer; color: #a78bfa; font-weight: bold; margin-bottom: 10px;">Lihat Kriteria PICO yang Berlaku</summary>
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

    } else if (status === 'M5_STEP2_WAITING_APPROVAL' || status === 'M5_STEP2_WAITING_APPROVAL_ERROR') {
        const kal = session.kalibrasi_log ? session.kalibrasi_log[session.kalibrasi_log.length-1] : null;
        let info = '';
        let totalSampelTeks = "20"; // default
        if (kal) {
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
                                <strong style="color: #60a5fa;">Matriks Keputusan:</strong><br>
                                - Keduanya INCLUDE: ${kal.both_include || 0}<br>
                                - Keduanya EXCLUDE: ${kal.both_exclude || 0}<br>
                                - R1 INC / R2 EXC: ${kal.r1_inc_r2_exc || 0}<br>
                                - R1 EXC / R2 INC: ${kal.r1_exc_r2_inc || 0}
                            </div>
                            <div>
                                <strong style="color: #60a5fa;">Variabel Cohen's Kappa:</strong><br>
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
            </div>`;
        }

        let briefingHtml = '';
        if (session.screener_briefing) {
            briefingHtml = `
            <details style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px;">
                <summary style="cursor: pointer; color: #a78bfa; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
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
                                    <div style="background: rgba(59, 130, 246, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #3b82f6;">
                                        <strong style="color: #93c5fd;">R1 Decision (Z-AI):</strong> ${d.Screener_1_Decision}<br>
                                        <div style="margin-top: 5px; color: #d1d5db;">${d.Screener_1_Notes}</div>
                                    </div>
                                    <div style="background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #10b981;">
                                        <strong style="color: #6ee7b7;">R2 Decision (Groq):</strong> ${d.Screener_2_Decision}<br>
                                        <div style="margin-top: 5px; color: #d1d5db;">${d.Screener_2_Notes}</div>
                                    </div>
                                </div>
                                ${d.Conflict_Resolution && typeof d.Conflict_Resolution === 'object' ? `
                                <div style="margin-top: 10px; background: rgba(167, 139, 250, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #a78bfa;">
                                    <strong style="color: #c4b5fd;">AI Arbitrator Advice:</strong> ${d.Conflict_Resolution.advice}<br>
                                    <div style="margin-top: 5px; color: #e5e7eb;">${d.Conflict_Resolution.analysis}</div>
                                </div>
                                ` : ''}
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
        
        html = wrapCard('Batch Screening Selesai (HitL Resolution Required)', `
            ${info}
            <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
            <div id="disagreements-container-m5s3" style="background: rgba(239, 68, 68, 0.05); padding: 15px; border-radius: 6px; border-left: 3px solid #ef4444;">
                <em><i class="fa fa-spinner fa-spin"></i> Memuat Disagreements...</em>
            </div>
            <p style="margin-top: 15px; font-size: 0.9em;"><em>Note: Buka MongoDB Compass -> koleksi <strong>slr_screening</strong> untuk mengisi kolom "Final_Decision" secara manual jika Anda ingin lanjut.</em></p>
            <div style="display: flex; gap: 1rem; margin-top: 15px;">
                <button id="btn-generic-approve" class="btn btn-success">Sudah Direview Manual (Setuju & Lanjut)</button>
                <button id="btn-retry-batch" class="btn btn-danger">⚠️ Ulangi Batch Ini (Hapus & Eksekusi Ulang)</button>
            </div>
        `);

        setTimeout(async () => {
            const btnApprove = document.getElementById('btn-generic-approve');
            if (btnApprove) {
                btnApprove.addEventListener('click', () => {
                    // Karena fungsi ini ada di tracker.js, kita dispatch event manual atau panggil API
                    fetch(`http://localhost:50607/api/sessions/${session.id}/approve`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: '{}' })
                        .then(() => window.location.reload());
                });
            }
            const btnRetry = document.getElementById('btn-retry-batch');
            if (btnRetry) {
                btnRetry.addEventListener('click', () => {
                    if (confirm("Apakah Anda yakin ingin menghapus data batch ini dan memanggil ulang AI (Zhipu & Groq) untuk 20 paper ini?")) {
                        btnRetry.disabled = true;
                        btnRetry.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Memuat Ulang Batch...';
                        fetch(`http://localhost:50607/api/sessions/${session.id}/revise`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ feedback: "Re-run batch due to AI failure", target_status: "M5_STEP3_BATCH_SCREENING" })
                        }).then(() => window.location.reload());
                    }
                });
            }

            const container = document.getElementById('disagreements-container-m5s3');
            if (!container) return;
            try {
                const data = await API.getDisagreements(session.id);
                if (data.disagreements && data.disagreements.length > 0) {
                    let dHtml = `<h5 style="color: #fca5a5; margin-top: 0; margin-bottom: 10px;">Menunggu Keputusan Anda (${data.disagreements.length} cases)</h5>`;
                    data.disagreements.forEach((d, i) => {
                        dHtml += `
                        <details style="margin-bottom: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; padding: 10px;">
                            <summary style="cursor: pointer; font-weight: bold; font-size: 0.9em; color: #fcd34d;">
                                Kasus ${i+1}: ${d.Title}
                            </summary>
                            <div style="font-size: 0.85em; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                                <p style="color: #9ca3af; margin-bottom: 10px;"><strong>Abstract:</strong> ${d.Abstract}</p>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                    <div style="background: rgba(59, 130, 246, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #3b82f6;">
                                        <strong style="color: #93c5fd;">R1 Decision:</strong> ${d.Screener_1_Decision}<br>
                                        <div style="margin-top: 5px; color: #d1d5db;">${d.Screener_1_Notes}</div>
                                    </div>
                                    <div style="background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #10b981;">
                                        <strong style="color: #6ee7b7;">R2 Decision:</strong> ${d.Screener_2_Decision}<br>
                                        <div style="margin-top: 5px; color: #d1d5db;">${d.Screener_2_Notes}</div>
                                    </div>
                                </div>
                                ${d.Conflict_Resolution && typeof d.Conflict_Resolution === 'object' ? `
                                <div style="margin-top: 10px; background: rgba(167, 139, 250, 0.1); padding: 10px; border-radius: 4px; border-left: 3px solid #a78bfa;">
                                    <strong style="color: #c4b5fd;">AI Arbitrator Advice:</strong> ${d.Conflict_Resolution.advice}<br>
                                    <div style="margin-top: 5px; color: #e5e7eb;">${d.Conflict_Resolution.analysis}</div>
                                </div>
                                ` : ''}
                            </div>
                        </details>
                        `;
                    });
                    container.innerHTML = dHtml;
                } else {
                    container.innerHTML = `<span style="color: #4ade80;">Tidak ada konflik tersisa untuk diresolusi di batch ini.</span>`;
                }
            } catch (err) {
                container.innerHTML = `<span style="color: #ef4444;">Gagal memuat disagreements: ${err.message}</span>`;
            }
        }, 0);
        return true;

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
        
        area.insertAdjacentHTML('beforeend', `
            <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 4px solid ${isDanger ? '#ef4444' : '#3b82f6'};">
                <p style="margin-bottom: 1rem;"><strong>Tindakan Anda:</strong> ${isHalted ? 'Anda diwajibkan untuk mengulangi import CSV.' : 'Apakah Anda setuju dengan hasil di atas?'}</p>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    ${!isHalted ? `<button id="btn-generic-approve" class="btn btn-success">Setuju & Lanjut</button>` : ''}
                    ${extraBtn}
                </div>
            </div>
        `);
        
        setTimeout(() => {
            const btnApprove = document.getElementById('btn-generic-approve');
            if (btnApprove) {
                btnApprove.addEventListener('click', () => handleApproval({}));
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
    }

    return false;
}
