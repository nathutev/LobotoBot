(function () {
    let wordsData = null;
    let isShrunk = true;
    let lastRenderKey = '';
    let showAllWords = false;
    let shadow = null;

    function getLocWords() {
        try {
            if (typeof window.$locWords !== 'undefined' && Array.isArray(window.$locWords) && window.$locWords.length > 0) {
                return window.$locWords;
            }
            if (typeof $locWords !== 'undefined' && Array.isArray($locWords) && $locWords.length > 0) {
                return $locWords;
            }
        } catch (e) {}
        return null;
    }

    function init() {
        if (!document.documentElement && !document.body) {
            setTimeout(init, 50);
            return;
        }

        createUI();

        // Check for words data immediately
        const initialWords = getLocWords();
        if (initialWords) {
            wordsData = initialWords;
            updateView();
        }

        // Watch for exercise/DOM changes in body
        if (document.body) {
            const observer = new MutationObserver(() => {
                updateView();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // Periodic check for word updates and exercise state
        setInterval(updateView, 350);

        // Keyboard shortcut: Alt + H to toggle hint box, Escape to shrink
        window.addEventListener('keydown', (e) => {
            if (e.altKey && (e.key === 'h' || e.key === 'H')) {
                e.preventDefault();
                toggleShrunk();
            } else if (e.key === 'Escape' && !isShrunk) {
                setShrunk(true);
            }
        });
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

        // 1. Multi-pair exercises
        const pexesoCards = Array.from(document.querySelectorAll('.pexesoCardWrapper'))
            .filter(el => isElementVisible(el));
        if (pexesoCards.length > 0) {
            const wIds = [...new Set(pexesoCards.map(c => c.getAttribute('w_id')).filter(Boolean))];
            const pairs = wIds.map(id => wordsData.find(w => String(w.word_id) === String(id) || String(w.id) === String(id)))
                              .filter(Boolean)
                              .map(detectPair);
            if (pairs.length > 0) {
                return { type: 'multi', title: 'Pexeso (Páry na ploše)', pairs: pairs };
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

        // 2. Single word exercises
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
        if (shadow) return;

        // Create an anonymous host div attached to documentElement
        // Leaves document.body completely untouched and unpolluted
        const host = document.createElement('div');
        shadow = host.attachShadow({ mode: 'closed' });

        const style = document.createElement('style');
        style.textContent = `
            :host {
                all: initial;
                position: fixed;
                top: 14px;
                right: 14px;
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                user-select: none;
                box-sizing: border-box;
            }

            * {
                box-sizing: border-box;
            }

            .wb-root {
                box-sizing: border-box;
                transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
            }

            /* Shrunk state */
            .wb-root.wb-shrunk {
                width: 23px;
                height: 27px;
                background-color: transparent !important;
                opacity: 0.3 !important;
                accent-color: black;
                box-shadow: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .wb-root.wb-shrunk:hover {
                background: #334155 !important;
                border-color: rgba(255, 255, 255, 0.25);
                transform: translateY(-1px);
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
                opacity: 1 !important;
                border-radius: 6px;
            }

            .wb-root.wb-shrunk .wb-panel-full {
                display: none !important;
            }

            .wb-root:not(.wb-shrunk) .wb-panel-mini {
                display: none !important;
            }

            .wb-pill-icon {
                font-size: 15px;
                line-height: 1;
            }

            .wb-pill-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #22c55e;
            }

            .wb-pill-dot.wb-dot-waiting {
                background: #f59e0b;
            }

            /* Expanded Card View */
            .wb-root:not(.wb-shrunk) {
                width: 330px;
                max-width: calc(100vw - 28px);
                background: #1e293b;
                color: #f8fafc;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.12);
                overflow: hidden;
            }

            .wb-header {
                background: #0f172a;
                padding: 10px 14px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                cursor: pointer;
            }

            .wb-header-title {
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.3px;
                display: flex;
                align-items: center;
                gap: 6px;
                color: #f8fafc;
            }

            .wb-header-actions {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .wb-btn-minimize {
                background: transparent;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
                padding: 4px 6px;
                border-radius: 4px;
                transition: background 0.15s, color 0.15s;
            }

            .wb-btn-minimize:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
            }

            .wb-body {
                padding: 12px 14px;
                max-height: 480px;
                overflow-y: auto;
            }

            .wb-body::-webkit-scrollbar {
                width: 6px;
            }

            .wb-body::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.15);
                border-radius: 3px;
            }

            /* Single Word Display */
            .wb-card-pair {
                background: #0f172a;
                border-radius: 8px;
                padding: 12px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }

            .wb-word-block {
                margin-bottom: 10px;
            }

            .wb-word-block:last-child {
                margin-bottom: 0;
            }

            .wb-word-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 3px;
            }

            .wb-badge-de {
                color: #38bdf8;
            }

            .wb-badge-cz {
                color: #fbbf24;
            }

            .wb-word-text {
                font-size: 17px;
                font-weight: 700;
                color: #ffffff;
                line-height: 1.3;
                word-break: break-word;
                user-select: text;
            }

            .wb-word-divider {
                height: 1px;
                background: rgba(255, 255, 255, 0.08);
                margin: 8px 0;
            }

            .wb-answer-indicator {
                margin-top: 10px;
                background: rgba(34, 197, 94, 0.12);
                border: 1px solid rgba(34, 197, 94, 0.3);
                border-radius: 6px;
                padding: 6px 10px;
                font-size: 11.5px;
                color: #4ade80;
                display: flex;
                align-items: center;
                gap: 6px;
                user-select: text;
            }

            /* Multi-pair List */
            .wb-multi-title {
                font-size: 11.5px;
                font-weight: 600;
                color: #94a3b8;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .wb-multi-item {
                background: #0f172a;
                border-radius: 6px;
                padding: 8px 10px;
                margin-bottom: 6px;
                border: 1px solid rgba(255, 255, 255, 0.06);
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .wb-multi-de {
                font-size: 14px;
                font-weight: 700;
                color: #38bdf8;
                user-select: text;
            }

            .wb-multi-cz {
                font-size: 13px;
                color: #fbbf24;
                user-select: text;
            }

            /* Empty state */
            .wb-empty-state {
                text-align: center;
                padding: 16px 8px;
                color: #94a3b8;
                font-size: 13px;
            }

            .wb-empty-icon {
                font-size: 24px;
                margin-bottom: 6px;
            }

            /* Collapsible words list */
            .wb-all-words-section {
                margin-top: 12px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                padding-top: 10px;
            }

            .wb-all-words-btn {
                width: 100%;
                background: #334155;
                border: none;
                color: #cbd5e1;
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 11.5px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                transition: background 0.15s;
            }

            .wb-all-words-btn:hover {
                background: #475569;
                color: #ffffff;
            }

            .wb-all-words-content {
                margin-top: 8px;
                display: none;
            }

            .wb-all-words-content.wb-show {
                display: block;
            }

            .wb-words-list {
                max-height: 180px;
                overflow-y: auto;
                font-size: 12px;
            }

            .wb-word-row {
                padding: 5px 6px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                display: flex;
                justify-content: space-between;
                gap: 8px;
                user-select: text;
            }

            .wb-word-row:hover {
                background: rgba(255, 255, 255, 0.03);
            }

            .wb-footer {
                background: #0f172a;
                padding: 6px 14px;
                font-size: 11px;
                color: #64748b;
                border-top: 1px solid rgba(255, 255, 255, 0.06);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
        `;
        shadow.appendChild(style);

        const container = document.createElement('div');
        container.className = 'wb-root' + (isShrunk ? ' wb-shrunk' : '');
        container.innerHTML = `
            <div class="wb-panel-mini" title="Klikněte pro zobrazení (Alt+H)">
                <span class="wb-pill-icon">🐝</span>
                <span class="wb-pill-dot wb-dot-waiting" id="wb-status-dot"></span>
            </div>

            <div class="wb-panel-full">
                <div class="wb-header" id="wb-header">
                    <div class="wb-header-title">
                        <span>Překlad</span>
                    </div>
                    <div class="wb-header-actions">
                        <button class="wb-btn-minimize" id="wb-btn-close" title="Zmenšit (Alt+H nebo Esc)">—</button>
                    </div>
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

        shadow.appendChild(container);
        (document.documentElement || document.body).appendChild(host);

        // Events strictly scoped inside shadow root
        container.querySelector('.wb-panel-mini').addEventListener('click', (e) => {
            e.stopPropagation();
            setShrunk(false);
        });

        container.querySelector('#wb-header').addEventListener('click', (e) => {
            if (e.target.closest('#wb-btn-close') || e.target.closest('.wb-header-title') || e.target === e.currentTarget) {
                setShrunk(true);
            }
        });

        const toggleAllBtn = container.querySelector('#wb-toggle-all');
        const allWordsContent = container.querySelector('#wb-all-words-content');
        const arrow = container.querySelector('#wb-toggle-all-arrow');
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
        if (!shadow) return;
        const root = shadow.querySelector('.wb-root');
        if (!root) return;
        if (isShrunk) {
            root.classList.add('wb-shrunk');
        } else {
            root.classList.remove('wb-shrunk');
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
        if (!shadow) return;
        const listEl = shadow.querySelector('#wb-words-list');
        const toggleTextEl = shadow.querySelector('#wb-toggle-all-text');
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
        // Direct read from memory in MAIN execution world
        const loc = getLocWords();
        if (loc && loc.length > 0) {
            wordsData = loc;
        }

        if (!shadow) return;

        const dot = shadow.querySelector('#wb-status-dot');
        if (dot) {
            if (wordsData && wordsData.length > 0) {
                dot.classList.remove('wb-dot-waiting');
            } else {
                dot.classList.add('wb-dot-waiting');
            }
        }

        const container = shadow.querySelector('#wb-active-content');
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
                        <span>👉</span>
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
                : 'Čekám na načtení slovíček z WocaBee...';

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
