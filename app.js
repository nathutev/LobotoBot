(function () {
    let wordsData = null;
    let isShrunk = true;
    let lastRenderKey = '';
    let showAllWords = false;

    function init() {
        if (!document.body) {
            setTimeout(init, 100);
            return;
        }

        injectScript();
        createUI();

        window.addEventListener("message", (event) => {
            if (event.source !== window) return;
            if (event.data && event.data.type === "WOCABEE_DATA") {
                wordsData = event.data.words;
                updateView();
            }
        });

        const observer = new MutationObserver((mutations) => {
            const hasExternalMutation = mutations.some(m => !m.target.closest || !m.target.closest('#wb-hint-panel'));
            if (hasExternalMutation) {
                updateView();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setInterval(updateView, 350);

        window.addEventListener('keydown', (e) => {
            if (e.altKey && (e.key === 'h' || e.key === 'H')) {
                e.preventDefault();
                toggleShrunk();
            } else if (e.key === 'Escape' && !isShrunk) {
                setShrunk(true);
            }
        });
    }

    function injectScript() {
        if (document.getElementById('wb-inject-script')) return;
        const script = document.createElement('script');
        script.id = 'wb-inject-script';
        script.src = chrome.runtime.getURL('inject.js');
        (document.head || document.documentElement).appendChild(script);
    }

    function isElementVisible(el) {
        return !!(el && el.offsetParent !== null && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden');
    }

    function detectPair(w) {
        if (!w) return null;
        let de = (w.word || '').trim();
        let cz = (w.translation || '').trim();

        const czRegex = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;
        const deRegex = /^(der|die|das|ein|eine|einen|einem|einer|eines)\s+/i;
        const deUmlaut = /[äöüßÄÖÜ]/;

        if ((czRegex.test(de) && !czRegex.test(cz)) || (deRegex.test(cz) || deUmlaut.test(cz))) {
            const temp = de;
            de = cz;
            cz = temp;
        }

        return {
            german: de,
            czech: cz,
            word_id: w.word_id || w.id,
            raw: w
        };
    }

    function getActiveQuestionText() {
        const questionSelectors = [
            '#tw_word',
            '#ch_word',
            '#oneOutOfManyQuestionWord',
            '#cs_word',
            '#tfw_word',
            '#def-lang-sentence',
            '#transcribeWord'
        ];
        for (const sel of questionSelectors) {
            const el = document.querySelector(sel);
            if (el && isElementVisible(el)) {
                const txt = el.innerText.trim();
                if (txt) return txt;
            }
        }
        return null;
    }

    function getCurrentWords() {
        if (!wordsData || wordsData.length === 0) {
            return { type: 'none', message: 'Načítám slovíčka...' };
        }

        const pexesoCards = Array.from(document.querySelectorAll('.pexesoCardWrapper'))
            .filter(el => isElementVisible(el));
        if (pexesoCards.length > 0) {
            const wIds = [...new Set(pexesoCards.map(c => c.getAttribute('w_id')).filter(Boolean))];
            const pairs = wIds.map(id => wordsData.find(w => String(w.word_id) === String(id) || String(w.id) === String(id)))
                              .filter(Boolean)
                              .map(detectPair);
            if (pairs.length > 0) {
                return { type: 'multi', title: 'Pexeso', pairs: pairs };
            }
        }

        const matchPairBtns = Array.from(document.querySelectorAll('#matchPairWords .btn'))
            .filter(el => isElementVisible(el) && !el.disabled && !el.classList.contains('btn-success-active'));
        if (matchPairBtns.length > 0) {
            const wIds = [...new Set(matchPairBtns.map(b => b.getAttribute('w_id')).filter(Boolean))];
            const pairs = wIds.map(id => wordsData.find(w => String(w.word_id) === String(id) || String(w.id) === String(id)))
                              .filter(Boolean)
                              .map(detectPair);
            if (pairs.length > 0) {
                return { type: 'multi', title: 'Spojování párů', pairs: pairs };
            }
        }

        const findPairBtns = Array.from(document.querySelectorAll('#q_words .btn, .fp_q, #a_words .btn, .fp_a'))
            .filter(el => isElementVisible(el) && !el.disabled && !el.classList.contains('btn-success-active'));
        if (findPairBtns.length > 0) {
            const wIds = [...new Set(findPairBtns.map(b => b.getAttribute('w_id')).filter(Boolean))];
            const pairs = wIds.map(id => wordsData.find(w => String(w.word_id) === String(id) || String(w.id) === String(id)))
                              .filter(Boolean)
                              .map(detectPair);
            if (pairs.length > 0) {
                return { type: 'multi', title: 'Hledání párů', pairs: pairs };
            }
        }

        let match = null;

        const wordIdEl = document.getElementById('word_id') || document.querySelector('input[name="word_id"]');
        if (wordIdEl && wordIdEl.value) {
            const wid = wordIdEl.value;
            match = wordsData.find(w => String(w.word_id) === String(wid) || String(w.id) === String(wid));
        }

        const qText = getActiveQuestionText();
        if (!match && qText) {
            const qLower = qText.toLowerCase();
            match = wordsData.find(w => 
                (w.word && w.word.trim().toLowerCase() === qLower) || 
                (w.translation && w.translation.trim().toLowerCase() === qLower)
            );
        }

        if (!match) {
            const patternEl = document.getElementById('completeWordAnswer');
            if (patternEl && isElementVisible(patternEl)) {
                const pattern = patternEl.innerText.trim();
                if (pattern && pattern.includes('_')) {
                    const regexStr = '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.') + '$';
                    const regex = new RegExp(regexStr, 'i');
                    match = wordsData.find(w => regex.test(w.word) || regex.test(w.translation));
                }
            }
        }

        if (!match) {
            const aWordEl = document.getElementById('a_word');
            if (aWordEl && aWordEl.value) {
                const val = aWordEl.value.trim().toLowerCase();
                match = wordsData.find(w => 
                    (w.word && w.word.trim().toLowerCase() === val) || 
                    (w.translation && w.translation.trim().toLowerCase() === val)
                );
            }
        }

        if (!match) {
            const choosePicEl = document.getElementById('choosePicture');
            if (choosePicEl && isElementVisible(choosePicEl)) {
                const pic = choosePicEl.querySelector('.picture[word_id]');
                if (pic) {
                    const wid = pic.getAttribute('word_id');
                    match = wordsData.find(w => String(w.word_id) === String(wid) || String(w.id) === String(wid));
                }
            }
        }

        if (match) {
            const pair = detectPair(match);
            let expectedAnswer = null;
            if (qText) {
                const qLower = qText.toLowerCase();
                if (pair.czech.toLowerCase() === qLower) {
                    expectedAnswer = pair.german;
                } else if (pair.german.toLowerCase() === qLower) {
                    expectedAnswer = pair.czech;
                }
            }
            return {
                type: 'single',
                pair: pair,
                question: qText,
                answer: expectedAnswer
            };
        }

        return { type: 'none', message: 'Čekám na cvičení...' };
    }

    function createUI() {
        if (document.getElementById('wb-hint-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'wb-hint-panel';
        if (isShrunk) panel.classList.add('wb-shrunk');

        panel.innerHTML = `
            <!-- Shrunk Mini Pill View -->
            <div class="wb-panel-mini" title="Klikněte pro zobrazení nápovědy (Alt+H)">
                <span class="wb-pill-icon">🐝</span>
                <span class="wb-pill-dot wb-dot-waiting" id="wb-status-dot"></span>
            </div>

            <!-- Expanded View -->
            <div class="wb-panel-full">
                <div class="wb-header" id="wb-header">
                    <div class="wb-header-title">
                        <span>Překlad</span>
                    </div>
                    <div class="wb-header-actions"></div>
                </div>

                <div class="wb-body">
                    <div id="wb-active-content">
                        <div class="wb-empty-state">
                            <div class="wb-empty-icon"></div>
                            <div>Načítám data...</div>
                        </div>
                    </div>

                    <div class="wb-all-words-section">
                        <button type="button" class="wb-all-words-btn" id="wb-toggle-all">
                            <span id="wb-toggle-all-text">Všechna slovíčka z balíčku</span>
                            <span id="wb-toggle-all-arrow">▼</span>
                        </button>
                        <div class="wb-all-words-content" id="wb-all-words-content">
                            <div class="wb-words-list" id="wb-words-list"></div>
                        </div>
                    </div>
                </div>

                <div class="wb-footer">
                    <span>Alt + H</span>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        panel.querySelector('.wb-panel-mini').addEventListener('click', (e) => {
            e.stopPropagation();
            setShrunk(false);
        });

        panel.querySelector('#wb-header').addEventListener('click', (e) => {
            if (e.target.closest('#wb-btn-close') || e.target.closest('.wb-header-title') || e.target === e.currentTarget) {
                setShrunk(true);
            }
        });

        const toggleAllBtn = panel.querySelector('#wb-toggle-all');
        const allWordsContent = panel.querySelector('#wb-all-words-content');
        const arrow = panel.querySelector('#wb-toggle-all-arrow');
        toggleAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showAllWords = !showAllWords;
            if (showAllWords) {
                allWordsContent.classList.add('wb-show');
                arrow.textContent = '▲';
                renderAllWordsList();
            } else {
                allWordsContent.classList.remove('wb-show');
                arrow.textContent = '▼';
            }
        });
    }

    function setShrunk(shrunk) {
        isShrunk = shrunk;
        const panel = document.getElementById('wb-hint-panel');
        if (!panel) return;
        if (isShrunk) {
            panel.classList.add('wb-shrunk');
        } else {
            panel.classList.remove('wb-shrunk');
            updateView();
        }
    }

    function toggleShrunk() {
        setShrunk(!isShrunk);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderAllWordsList() {
        const listEl = document.getElementById('wb-words-list');
        const toggleTextEl = document.getElementById('wb-toggle-all-text');
        if (!listEl) return;

        if (!wordsData || wordsData.length === 0) {
            listEl.innerHTML = '<div style="color:#64748b; padding:4px;">Žádná slovíčka v paměti.</div>';
            return;
        }

        if (toggleTextEl) {
            toggleTextEl.textContent = `Všechna slovíčka (${wordsData.length})`;
        }

        listEl.innerHTML = wordsData.map(w => {
            const pair = detectPair(w);
            return `
                <div class="wb-word-row">
                    <span style="color:#38bdf8; font-weight:600;">${escapeHtml(pair.german)}</span>
                    <span style="color:#fbbf24;">${escapeHtml(pair.czech)}</span>
                </div>
            `;
        }).join('');
    }

    function updateView() {
        const dot = document.getElementById('wb-status-dot');
        if (dot) {
            if (wordsData && wordsData.length > 0) {
                dot.classList.remove('wb-dot-waiting');
            } else {
                dot.classList.add('wb-dot-waiting');
            }
        }

        const container = document.getElementById('wb-active-content');
        if (!container) return;

        const current = getCurrentWords();
        const renderKey = JSON.stringify(current);
        if (renderKey === lastRenderKey) return;
        lastRenderKey = renderKey;

        if (current.type === 'single') {
            const p = current.pair;
            let answerHtml = '';
            if (current.answer) {
                answerHtml = `
                    <div class="wb-answer-indicator">
                        <span>Odpověď: <strong>${escapeHtml(current.answer)}</strong></span>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="wb-card-pair">
                    <div class="wb-word-block">
                        <div class="wb-word-badge wb-badge-de">Německy</div>
                        <div class="wb-word-text">${escapeHtml(p.german)}</div>
                    </div>
                    <div class="wb-word-divider"></div>
                    <div class="wb-word-block">
                        <div class="wb-word-badge wb-badge-cz">Česky</div>
                        <div class="wb-word-text">${escapeHtml(p.czech)}</div>
                    </div>
                    ${answerHtml}
                </div>
            `;
        } else if (current.type === 'multi') {
            const itemsHtml = current.pairs.map(p => `
                <div class="wb-multi-item">
                    <div class="wb-multi-de">${escapeHtml(p.german)}</div>
                    <div class="wb-multi-cz">${escapeHtml(p.czech)}</div>
                </div>
            `).join('');

            container.innerHTML = `
                <div class="wb-multi-title">${escapeHtml(current.title)}:</div>
                <div style="max-height: 220px; overflow-y: auto;">
                    ${itemsHtml}
                </div>
            `;
        } else {
            const countText = wordsData && wordsData.length > 0 
                ? `V balíčku je ${wordsData.length} slovíček.` 
                : 'Čekám na slovíčka...';

            container.innerHTML = `
                <div class="wb-empty-state">
                    <div class="wb-empty-icon"></div>
                    <div style="font-weight:600; color:#f8fafc; margin-bottom:4px;">${escapeHtml(current.message)}</div>
                    <div style="font-size:11.5px;">${escapeHtml(countText)}</div>
                </div>
            `;
        }

        if (showAllWords) {
            renderAllWordsList();
        }
    }

    init();
})();
