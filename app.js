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

        const initialWords = getLocWords();
        if (initialWords) {
            wordsData = initialWords;
            updateView();
        }

        if (document.body) {
            const observer = new MutationObserver(() => {
                updateView();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

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

    function isElementVisible(el) {
        return !!(el && el.offsetParent !== null && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden');
    }

    function cleanStr(s) {
        if (!s) return '';
        return s.toLowerCase()
            .replace(/[\u00A0\s]+/g, ' ')
            .replace(/^[.,\/#!$%\^&\*;:{}=\-_`~()?"'„“”«»]+|[.,\/#!$%\^&\*;:{}=\-_`~()?"'„“”«»]+$/g, '')
            .trim();
    }

    function stripArt(s) {
        if (!s) return '';
        return s.replace(/^(der|die|das|ein|eine|einen|einem|einer|eines|the|a|an)\s+/i, '');
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
            '#transcribeWord',
            '#completeWordQuestion',
            '#translateWord',
            '#q_word',
            '#tf_word',
            '#up_word',
            '#describePictureAnswer'
        ];
        for (const sel of questionSelectors) {
            const el = document.querySelector(sel);
            if (el && isElementVisible(el)) {
                const txt = (el.innerText || el.textContent || '').trim();
                if (txt) return txt;
            }
        }
        return null;
    }

    function determineExpectedAnswer(pair, qText) {
        if (!pair) return null;

        const patternEl = document.getElementById('completeWordAnswer');
        if (patternEl && isElementVisible(patternEl)) {
            const pattern = patternEl.innerText.trim();
            if (pattern && pattern.includes('_')) {
                const regexStr = '^' + pattern.replace(/[\s\u00A0]+/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.') + '$';
                const regex = new RegExp(regexStr, 'i');
                const deNoSpaces = (pair.german || '').replace(/\s+/g, '');
                const czNoSpaces = (pair.czech || '').replace(/\s+/g, '');
                if (regex.test(deNoSpaces)) return pair.german;
                if (regex.test(czNoSpaces)) return pair.czech;
            }
        }

        const q = qText || getActiveQuestionText();
        if (q) {
            const qClean = cleanStr(q);
            const czClean = cleanStr(pair.czech);
            const deClean = cleanStr(pair.german);

            if (czClean && qClean === czClean) return pair.german;
            if (deClean && qClean === deClean) return pair.czech;

            const czParts = (pair.czech || '').split(/[,;\/]/).map(cleanStr).filter(Boolean);
            const deParts = (pair.german || '').split(/[,;\/]/).map(cleanStr).filter(Boolean);

            if (czParts.includes(qClean)) return pair.german;
            if (deParts.includes(qClean)) return pair.czech;

            const qNoArt = cleanStr(stripArt(qClean));
            const deNoArt = cleanStr(stripArt(deClean));

            if (qNoArt && deNoArt && qNoArt === deNoArt) return pair.czech;
            if (deParts.some(p => cleanStr(stripArt(p)) === qNoArt)) return pair.czech;

            if (czClean && (czClean.includes(qClean) || qClean.includes(czClean))) return pair.german;
            if (deClean && (deClean.includes(qClean) || qClean.includes(deClean))) return pair.czech;
            if (czParts.some(p => p.includes(qClean) || qClean.includes(p))) return pair.german;
            if (deParts.some(p => p.includes(qClean) || qClean.includes(p))) return pair.czech;
        }

        const candidates = document.querySelectorAll('.practice, #practice, #exercise, .exercise, #gameBody, #game, .game');
        for (const container of candidates) {
            if (!isElementVisible(container)) continue;
            const nodes = container.querySelectorAll('h1, h2, h3, h4, span, div, p, label');
            for (const node of nodes) {
                if (!isElementVisible(node) || node.children.length > 2) continue;
                const txt = cleanStr(node.innerText);
                if (!txt || txt.length > 100) continue;
                const czClean = cleanStr(pair.czech);
                const deClean = cleanStr(pair.german);
                if (txt === czClean || txt === cleanStr(stripArt(pair.czech))) return pair.german;
                if (txt === deClean || txt === cleanStr(stripArt(pair.german))) return pair.czech;
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

        const qBtns = Array.from(document.querySelectorAll('#q_words .btn, #q_words button, .fp_q'))
            .filter(el => isElementVisible(el) && !el.disabled && !el.classList.contains('btn-success-active'));
        const aBtns = Array.from(document.querySelectorAll('#a_words .btn, #a_words button, .fp_a'))
            .filter(el => isElementVisible(el) && !el.disabled && !el.classList.contains('btn-success-active'));
        const allFpBtns = Array.from(document.querySelectorAll('#q_words .btn, #q_words button, .fp_q, #a_words .btn, #a_words button, .fp_a, #findPairWords .btn, .findPairBtn'))
            .filter(el => isElementVisible(el) && !el.disabled && !el.classList.contains('btn-success-active'));

        if (allFpBtns.length > 0) {
            let realWords = [];

            if (qBtns.length > 0 && aBtns.length > 0) {
                const qIds = qBtns.map(b => b.getAttribute('w_id') || b.getAttribute('wid') || (b.dataset && b.dataset.wid)).filter(Boolean);
                const aIds = aBtns.map(b => b.getAttribute('w_id') || b.getAttribute('wid') || (b.dataset && b.dataset.wid)).filter(Boolean);
                const commonIds = [...new Set(qIds.filter(id => aIds.includes(id)))];
                if (commonIds.length > 0) {
                    realWords = commonIds.map(id => wordsData.find(w => String(w.word_id) === String(id) || String(w.id) === String(id))).filter(Boolean);
                }
            }

            if (realWords.length === 0) {
                const idCounts = {};
                for (const b of allFpBtns) {
                    const id = b.getAttribute('w_id') || b.getAttribute('wid') || (b.dataset && b.dataset.wid);
                    if (id) {
                        idCounts[id] = (idCounts[id] || 0) + 1;
                    }
                }
                const duplicateIds = Object.keys(idCounts).filter(id => idCounts[id] >= 2);
                if (duplicateIds.length > 0) {
                    realWords = duplicateIds.map(id => wordsData.find(w => String(w.word_id) === String(id) || String(w.id) === String(id))).filter(Boolean);
                }
            }

            if (realWords.length === 0) {
                const btnTexts = allFpBtns.map(b => cleanStr(b.innerText)).filter(Boolean);
                realWords = wordsData.filter(w => {
                    const pair = detectPair(w);
                    if (!pair) return false;
                    const cz = cleanStr(pair.czech);
                    const de = cleanStr(pair.german);
                    const czNoArt = cleanStr(stripArt(pair.czech));
                    const deNoArt = cleanStr(stripArt(pair.german));

                    const czParts = (pair.czech || '').split(/[,;\/]/).map(cleanStr).filter(Boolean);
                    const deParts = (pair.german || '').split(/[,;\/]/).map(cleanStr).filter(Boolean);

                    const hasDe = btnTexts.some(t => t === de || t === deNoArt || deParts.includes(t) || (t.length > 2 && (de.includes(t) || t.includes(de))));
                    const hasCz = btnTexts.some(t => t === cz || t === czNoArt || czParts.includes(t) || (t.length > 2 && (cz.includes(t) || t.includes(cz))));

                    return hasDe && hasCz;
                });
            }

            const pairs = realWords.map(detectPair).filter(Boolean);
            if (pairs.length > 0) {
                return { type: 'multi', title: 'Správný pár', pairs: pairs };
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
            const qClean = cleanStr(qText);
            match = wordsData.find(w => {
                const wClean = cleanStr(w.word);
                const tClean = cleanStr(w.translation);
                return (wClean && (wClean === qClean || wClean.includes(qClean) || qClean.includes(wClean))) ||
                       (tClean && (tClean === qClean || tClean.includes(qClean) || qClean.includes(tClean)));
            });
        }

        if (!match) {
            const patternEl = document.getElementById('completeWordAnswer');
            if (patternEl && isElementVisible(patternEl)) {
                const pattern = patternEl.innerText.trim();
                if (pattern && pattern.includes('_')) {
                    const regexStr = '^' + pattern.replace(/[\s\u00A0]+/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.') + '$';
                    const regex = new RegExp(regexStr, 'i');
                    match = wordsData.find(w => regex.test((w.word || '').replace(/\s+/g, '')) || regex.test((w.translation || '').replace(/\s+/g, '')));
                }
            }
        }

        if (!match) {
            const aWordEl = document.getElementById('a_word');
            if (aWordEl && aWordEl.value) {
                const valClean = cleanStr(aWordEl.value);
                match = wordsData.find(w => 
                    (cleanStr(w.word) === valClean) || 
                    (cleanStr(w.translation) === valClean)
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
            const expectedAnswer = determineExpectedAnswer(pair, qText);
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

        const host = document.createElement('div');
        shadow = host.attachShadow({ mode: 'closed' });

        const style = document.createElement('style');
        style.textContent = `
            *::-webkit-scrollbar {
                display: none;
            }

            :host {
                all: initial;
                position: fixed;
                top: 14px;
                right: 14px;
                z-index: 2147483647;
                font-family: Helvetica, sans-serif;
                user-select: none;
                box-sizing: border-box;
            }

            * {
                box-sizing: border-box;
            }

            .wb-root {
                box-sizing: border-box;
            }

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

            .wb-root:not(.wb-shrunk) {
                width: 260px;
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
                padding: 8px 12px;
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
            }

            .wb-btn-minimize:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
            }

            .wb-body {
                padding: 10px 12px;
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

            .wb-card-pair {
                background: #0f172a;
                border-radius: 8px;
                padding: 10px 12px;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }

            .wb-word-text {
                font-size: 16px;
                font-weight: 700;
                color: #ffffff;
                line-height: 1.35;
                word-break: break-word;
                user-select: text;
            }

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

            .wb-multi-de, .wb-multi-cz {
                font-size: 14px;
                font-weight: 700;
                user-select: text;
            }

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

            .wb-all-words-section {
                margin-top: 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                padding-top: 8px;
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
                padding: 5px 12px;
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
            <div class="wb-panel-mini" title="Alt+H">
                <span class="wb-pill-icon">🐝</span>
            </div>

            <div class="wb-panel-full">
                <div class="wb-header" id="wb-header">
                    <div class="wb-header-title">
                        <span>Překlad</span>
                    </div>
                    <div class="wb-header-actions">
                        <button class="wb-btn-minimize" id="wb-btn-close" title="Alt+H"></button>
                    </div>
                </div>

                <div class="wb-body">
                    <div id="wb-active-content">
                        <div class="wb-empty-state">
                            <div class="wb-empty-icon"></div>
                            <div>Načítám...</div>
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
        if (typeof str !== 'string') {
            if (typeof str === 'object') {
                if (str.german || str.czech) {
                    str = (str.german && str.czech) ? `${str.german} / ${str.czech}` : (str.german || str.czech);
                } else if (str.word || str.translation) {
                    str = (str.word && str.translation) ? `${str.word} / ${str.translation}` : (str.word || str.translation);
                } else {
                    str = String(str);
                }
            } else {
                str = String(str);
            }
        }
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
            const targetWord = current.answer || '';

            container.innerHTML = `
                <div class="wb-card-pair">
                    <div class="wb-word-text">${escapeHtml(targetWord)}</div>
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
                : 'Čekám na načtení slovíček...';

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
