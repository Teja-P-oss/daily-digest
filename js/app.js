const state = {
    availableDates: [],
    currentDate: null,
    dataCache: new Map(),
    searchIndex: null,
    searchOpen: false,
    loadingDate: null,
    toastTimer: null,
    motionPaused: false,
    reducedMotion: false,
    revealObserver: null,
    activeSurface: null,
    pointerFrame: null,
    scrollFrame: null,
    lastSurpriseIndex: -1,
    isAdvance: false,
    selectedPapers: { inside: null, outside: null }
};

const paperConfig = {
    domain1: { badge: 'Inside domain · 01', badgeClass: 'domain', number: '01', group: 'inside' },
    domain2: { badge: 'Inside domain · 02', badgeClass: 'tech', number: '02', group: 'inside' },
    outside1: { badge: 'Outside domain · 01', badgeClass: 'random', number: '03', group: 'outside' },
    outside2: { badge: 'Outside domain · 02', badgeClass: 'random-two', number: '04', group: 'outside' }
};

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    bindInterface();
    setupMotion();

    try {
        const response = await fetch('./data/index.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error('The digest archive is unavailable.');

        const dates = await response.json();
        state.availableDates = [...new Set(dates.filter(isDateString))]
            .sort((a, b) => parseDate(b) - parseDate(a));

        if (!state.availableDates.length) throw new Error('No published digests were found.');

        configureDatePicker();
        const requestedDate = new URL(window.location.href).searchParams.get('date');
        const initialDate = state.availableDates.includes(requestedDate)
            ? requestedDate
            : getCurrentIssueDate();

        await loadDate(initialDate, { historyMode: 'replace' });

        if (requestedDate && requestedDate !== initialDate) {
            showToast(`No digest was published on ${formatDate(requestedDate, 'medium')}. Showing the current issue.`);
        }
    } catch (error) {
        showFatalError(error);
    }
}

function bindInterface() {
    byId('older-button').addEventListener('click', () => navigateRelative(1));
    byId('newer-button').addEventListener('click', () => navigateRelative(-1));
    byId('latest-button').addEventListener('click', () => {
        const currentIssue = getCurrentIssueDate();
        if (currentIssue) loadDate(currentIssue);
    });

    byId('date-picker').addEventListener('change', (event) => {
        const selected = event.target.value;
        if (state.availableDates.includes(selected)) {
            loadDate(selected);
            return;
        }

        event.target.value = state.currentDate || getCurrentIssueDate() || '';
        showToast(`There is no published digest for ${formatDate(selected, 'medium')}. Try another date.`);
    });

    byId('search-trigger').addEventListener('click', openSearch);
    byId('search-close').addEventListener('click', closeSearch);
    byId('search-form').addEventListener('submit', (event) => event.preventDefault());
    byId('global-search').addEventListener('input', debounce(runSearch, 90));
    byId('search-results').addEventListener('click', handleSearchSelection);
    byId('papers-container').addEventListener('click', handlePaperChoice);
    byId('date-search-trigger').addEventListener('click', focusDateSearch);
    byId('error-retry').addEventListener('click', () => {
        loadDate(state.loadingDate || state.currentDate || getCurrentIssueDate(), { historyMode: 'replace' });
    });
    byId('motion-toggle').addEventListener('click', toggleMotion);
    byId('surprise-button').addEventListener('click', surpriseMe);
    byId('back-to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: state.motionPaused ? 'auto' : 'smooth' }));

    document.addEventListener('keydown', (event) => {
        const target = event.target;
        const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;

        if (event.key === '/' && !isTyping) {
            event.preventDefault();
            openSearch();
        }

        if (event.key === 'Escape' && state.searchOpen) closeSearch();
    });

    window.addEventListener('popstate', () => {
        const requested = new URL(window.location.href).searchParams.get('date');
        const nextDate = state.availableDates.includes(requested) ? requested : getCurrentIssueDate();
        if (nextDate && nextDate !== state.currentDate) loadDate(nextDate, { historyMode: 'none' });
    });

    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerout', handlePointerOut, { passive: true });
}

function configureDatePicker() {
    const picker = byId('date-picker');
    const chronological = [...state.availableDates].sort();
    picker.min = chronological[0];
    picker.max = chronological[chronological.length - 1];
    byId('issue-count').textContent = `${state.availableDates.length} ${state.availableDates.length === 1 ? 'issue' : 'issues'}`;
}

function todayInIST() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function getCurrentIssueDate() {
    const today = todayInIST();
    return state.availableDates.find((date) => date <= today)
        || state.availableDates[state.availableDates.length - 1]
        || null;
}

async function loadDate(dateString, { historyMode = 'push' } = {}) {
    if (!state.availableDates.includes(dateString)) return;

    state.loadingDate = dateString;
    showLoadingState();
    hideError();

    try {
        const data = await fetchDigest(dateString);
        if (state.loadingDate !== dateString) return;

        state.currentDate = dateString;
        renderDigest(data, dateString);
        state.loadingDate = null;
        updateDateInterface(dateString);
        updateUrl(dateString, historyMode);
        document.title = `${formatDate(dateString, 'short')} — Teja's daily digest`;
    } catch (error) {
        if (state.loadingDate !== dateString) return;
        state.loadingDate = dateString;
        showLoadError(error, dateString);
    }
}

async function fetchDigest(dateString) {
    if (state.dataCache.has(dateString)) return state.dataCache.get(dateString);

    const response = await fetch(`./data/${encodeURIComponent(dateString)}.json`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`The ${formatDate(dateString, 'medium')} issue could not be loaded.`);

    const data = await response.json();
    state.dataCache.set(dateString, data);
    return data;
}

function updateDateInterface(dateString) {
    const date = parseDate(dateString);
    const index = state.availableDates.indexOf(dateString);
    const currentIssue = getCurrentIssueDate();
    const isCurrent = dateString === currentIssue;
    const isFuture = dateString > todayInIST();

    byId('date-subtitle').textContent = formatDate(dateString, 'long');
    byId('date-heading').textContent = formatDate(dateString, 'long');
    byId('issue-label').textContent = state.isAdvance ? 'Prepared ahead' : (isCurrent ? 'Latest issue' : 'From the archive');
    byId('display-day').textContent = String(date.getDate()).padStart(2, '0');
    byId('display-month').textContent = date.toLocaleDateString('en-US', { month: 'long' });
    byId('display-year').textContent = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric' });
    byId('date-picker').value = dateString;
    animateDateCard();

    const olderButton = byId('older-button');
    const newerButton = byId('newer-button');
    const latestButton = byId('latest-button');
    const olderDate = state.availableDates[index + 1];
    const newerDate = state.availableDates[index - 1];

    olderButton.disabled = !olderDate;
    newerButton.disabled = !newerDate;
    latestButton.disabled = isCurrent;
    latestButton.textContent = isCurrent ? "You're up to date" : (isFuture ? 'Back to current' : 'Jump to latest');
    olderButton.title = olderDate ? `Open ${formatDate(olderDate, 'medium')}` : 'No older issues';
    newerButton.title = newerDate ? `Open ${formatDate(newerDate, 'medium')}` : 'No newer issues';
}

function navigateRelative(offset) {
    const currentIndex = state.availableDates.indexOf(state.currentDate);
    const targetDate = state.availableDates[currentIndex + offset];
    if (targetDate) loadDate(targetDate);
}

function updateUrl(dateString, historyMode) {
    if (historyMode === 'none') return;

    const url = new URL(window.location.href);
    if (dateString === getCurrentIssueDate()) url.searchParams.delete('date');
    else url.searchParams.set('date', dateString);
    url.hash = '';

    const method = historyMode === 'replace' ? 'replaceState' : 'pushState';
    window.history[method]({ date: dateString }, '', url);
}

function renderDigest(data, dateString) {
    renderEditionMode(data?.edition);
    renderPapers(data?.papers, dateString);
    renderNews(data?.news);
    renderStocks(data?.stocks);
    renderTakeaways(data?.takeaways);
    animateCounter(byId('research-count'), Object.values(data?.papers || {}).filter(Boolean).length);
    animateCounter(byId('news-count'), ['india', 'world'].filter((region) => data?.news?.[region]).length);
    animateCounter(byId('market-count'), (data?.stocks?.us?.length || 0) + (data?.stocks?.india?.length || 0));
    byId('main-content').classList.remove('is-refreshing');
    observeAnimatedElements();
    scheduleScrollUpdate();
}

function renderEditionMode(edition) {
    state.isAdvance = edition?.kind === 'advance';
    const notice = byId('advance-notice');
    notice.hidden = !state.isAdvance;
    byId('advance-note').textContent = state.isAdvance
        ? (edition?.note || 'Live news and market prices were unavailable when this edition was prepared.')
        : '';

    byId('brief-title').textContent = state.isAdvance ? 'Knowledge for the road' : 'The morning brief';
    byId('brief-description').textContent = state.isAdvance
        ? 'Sourced evergreen context replaces unknowable future headlines in this prepared-ahead edition.'
        : 'General news across policy, society, science, technology, climate, geopolitics, and the economy—not another markets recap.';
    byId('markets-title').textContent = state.isAdvance ? 'Companies to understand' : 'Market pulse';
    byId('markets-description').textContent = state.isAdvance
        ? 'An evergreen company-learning list; future prices and returns are intentionally left unavailable.'
        : 'A compact watchlist. Open a row only when you want the thesis and risk.';
    byId('brief-nav-link').textContent = state.isAdvance ? 'Knowledge brief' : 'News brief';
    byId('markets-nav-link').textContent = state.isAdvance ? 'Company study' : 'Markets';
    byId('news-count-label').textContent = state.isAdvance ? 'knowledge regions' : 'news regions';
    byId('market-count-label').textContent = state.isAdvance ? 'company studies' : 'market ideas';
    byId('us-market-subtitle').textContent = state.isAdvance ? 'Learn the business' : 'Companies to research';
    byId('india-market-subtitle').textContent = state.isAdvance ? 'Learn the business' : 'Companies to research';
}

function renderPapers(papers = {}, dateString = state.currentDate) {
    const container = byId('papers-container');
    const normalized = normalizePapers(papers);
    state.selectedPapers = readPaperSelections(dateString);
    const groups = [
        { id: 'inside', kicker: 'Familiar territory', title: 'Inside your domain', note: 'Choose 1 of 2' },
        { id: 'outside', kicker: 'Broaden the map', title: 'Outside your domain', note: 'Choose 1 of 2' }
    ];
    const markup = groups.map((group) => {
        const papersInGroup = normalized.filter((entry) => entry.config.group === group.id);
        if (!papersInGroup.length) return '';
        return `
            <section class="paper-group" data-paper-group="${group.id}" aria-labelledby="${group.id}-papers-title">
                <header class="paper-group__heading">
                    <div><span>${group.kicker}</span><h3 id="${group.id}-papers-title">${group.title}</h3></div>
                    <small>${group.note}</small>
                </header>
                <div class="papers-grid">${papersInGroup.map((entry, index) => paperTemplate(entry.kind, entry.paper, index, entry.config)).join('')}</div>
            </section>`;
    }).join('');

    container.innerHTML = markup
        ? markup
        : '<div class="search-empty"><strong>No research papers in this issue.</strong><span>Try another date in the archive.</span></div>';
    updatePaperSelectionUI();
}

function normalizePapers(papers) {
    const modern = ['domain1', 'domain2', 'outside1', 'outside2']
        .filter((kind) => papers?.[kind])
        .map((kind) => ({ kind, paper: papers[kind], config: paperConfig[kind] }));
    if (modern.length) return modern;

    return [
        papers?.domain ? { kind: 'domain1', paper: papers.domain, config: paperConfig.domain1 } : null,
        papers?.tech ? { kind: 'domain2', paper: papers.tech, config: paperConfig.domain2 } : null,
        papers?.random ? { kind: 'outside1', paper: papers.random, config: paperConfig.outside1 } : null
    ].filter(Boolean);
}

function paperTemplate(kind, paper, index, config) {
    const title = paper.title || 'Untitled paper';
    const lead = paper.summary || paper.problem || paper.question || paper.idea || paper.discovery || 'Open the paper to learn more.';
    const metadata = [paper.venue, paper.year || paper.date, paper.field].filter(Boolean).join(' · ');
    const detailFields = getPaperDetails(kind, paper);
    const detailMarkup = detailFields.length
        ? `<details class="paper-details"><summary>Explore the key ideas <span>~5 min</span></summary><div class="paper-details__content">${detailFields.map(detailTemplate).join('')}</div></details>`
        : '';
    const links = [
        validUrl(paper.link) ? `<a class="paper-link" href="${escapeAttribute(paper.link)}" target="_blank" rel="noopener noreferrer">Read paper <span aria-hidden="true">↗</span></a>` : '',
        validUrl(paper.scholar) ? `<a class="paper-link" href="${escapeAttribute(paper.scholar)}" target="_blank" rel="noopener noreferrer">Scholar <span aria-hidden="true">↗</span></a>` : ''
    ].filter(Boolean).join('');

    return `
        <article class="paper-card interactive-surface" data-tilt data-number="${config.number}" data-paper-id="${kind}" data-paper-group="${config.group}" style="--card-index:${index}">
            <div class="paper-card__top">
                <span class="paper-badge paper-badge--${config.badgeClass}">${config.badge}</span>
                ${metadata ? `<span class="paper-card__meta">${escapeHTML(metadata)}</span>` : ''}
            </div>
            <h4>${escapeHTML(title)}</h4>
            ${paper.authors ? `<p class="paper-card__byline">By ${escapeHTML(paper.authors)}</p>` : ''}
            <p class="paper-card__summary">${escapeHTML(lead)}</p>
            ${detailMarkup}
            <footer class="paper-card__footer">
                <button class="paper-choice" type="button" data-choose-paper="${kind}" aria-pressed="false"><span aria-hidden="true">○</span> Choose this one</button>
                ${links}
            </footer>
        </article>`;
}

function getPaperDetails(kind, paper) {
    return [
        ['Problem or question', paper.problem || paper.question],
        ['Why is it difficult?', paper.difficulty],
        ['Core idea', paper.idea || paper.discovery],
        ['How it works', paper.method],
        ['Results or evidence', paper.results],
        ['Why it is worth your time', paper.care || paper.matters || paper.interesting || paper.takeaway],
        ['What to learn', paper.learn],
        ['Concepts to remember', paper.concepts || paper.takeaways]
    ].filter(([, value]) => hasValue(value));
}

function detailTemplate([label, value]) {
    const content = Array.isArray(value)
        ? `<ul>${value.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>`
        : `<p>${escapeHTML(value)}</p>`;
    return `<div class="paper-detail"><strong>${escapeHTML(label)}</strong>${content}</div>`;
}

function renderNews(news = {}) {
    renderNewsRegion('india-news-content', news?.india, 'No India brief was published for this issue.');
    renderNewsRegion('world-news-content', news?.world, 'No world brief was published for this issue.');
}

function renderNewsRegion(containerId, items, emptyMessage) {
    const container = byId(containerId);
    if (Array.isArray(items) && items.length) {
        container.innerHTML = `<ul class="news-list">${items.map(newsItemTemplate).join('')}</ul>`;
        return;
    }
    container.innerHTML = items ? sanitizeRichText(items) : `<p>${escapeHTML(emptyMessage)}</p>`;
}

function newsItemTemplate(item) {
    if (typeof item === 'string') return `<li><p>${escapeHTML(item)}</p></li>`;
    const link = validUrl(item?.link)
        ? `<a href="${escapeAttribute(item.link)}" target="_blank" rel="noopener noreferrer" aria-label="Read source for ${escapeAttribute(item.headline || 'news item')}">Source ↗</a>`
        : '';
    return `<li>
        <div class="news-item__top">${item?.category ? `<span>${escapeHTML(item.category)}</span>` : ''}${link}</div>
        <strong>${escapeHTML(item?.headline || 'Update')}</strong>
        ${item?.summary ? `<p>${escapeHTML(item.summary)}</p>` : ''}
        ${item?.why ? `<small><b>Why it matters:</b> ${escapeHTML(item.why)}</small>` : ''}
    </li>`;
}

function renderStocks(stocks = {}) {
    renderStockList('us-stocks-list', stocks?.us);
    renderStockList('in-stocks-list', stocks?.india);
}

function renderStockList(containerId, stocks = []) {
    const container = byId(containerId);
    if (!Array.isArray(stocks) || !stocks.length) {
        container.innerHTML = '<li><span class="stock-reason">No market data in this issue.</span></li>';
        return;
    }

    container.innerHTML = stocks.map((stock, index) => {
        const change = Number(stock.change);
        const hasChange = stock.change !== null && stock.change !== undefined && stock.change !== '' && Number.isFinite(change);
        const isUp = change >= 0;
        const extra = [
            stock.thesis ? `<strong>Thesis:</strong> ${escapeHTML(stock.thesis)}` : '',
            stock.risk ? `<strong>Risk:</strong> ${escapeHTML(stock.risk)}` : ''
        ].filter(Boolean).join(' · ');

        const row = `<div class="stock-row">
                    <div class="stock-identity">
                        <span class="stock-ticker">${escapeHTML(stock.symbol || '—')}</span>
                        <span class="stock-reason" title="${escapeAttribute(stock.reason || '')}">${escapeHTML(stock.reason || 'No context available')}</span>
                    </div>
                    <div class="stock-value">
                        <span class="stock-price">${escapeHTML(stock.price || '—')}</span>
                        ${hasChange
                            ? `<span class="stock-change ${isUp ? 'price-up' : 'price-down'}">${isUp ? '↗' : '↘'} ${Math.abs(change).toFixed(2)}%</span>`
                            : '<span class="stock-change stock-unavailable">Study ahead</span>'}
                    </div>
                </div>`;

        return extra
            ? `<li class="stock-item" style="--stock-index:${index}"><details class="stock-details"><summary>${row}<span class="stock-expand" aria-hidden="true">+</span></summary><p class="stock-extra">${extra}</p></details></li>`
            : `<li class="stock-item" style="--stock-index:${index}">${row}</li>`;
    }).join('');
}

function renderTakeaways(takeaways) {
    const section = byId('takeaways');
    const items = Array.isArray(takeaways?.remember) ? takeaways.remember.filter(Boolean) : [];

    if (!items.length && !takeaways?.explore) {
        section.hidden = true;
        byId('takeaways-nav-link').hidden = true;
        return;
    }

    section.hidden = false;
    byId('takeaways-nav-link').hidden = false;
    byId('takeaways-remember-list').innerHTML = items.length
        ? items.map((item) => `<li>${escapeHTML(item)}</li>`).join('')
        : '<li>No summary points were included in this issue.</li>';
    byId('takeaways-explore').textContent = takeaways?.explore || 'Return to the research section and choose one idea to explore more deeply.';
}

function handlePaperChoice(event) {
    const button = event.target.closest('[data-choose-paper]');
    if (!button) return;
    choosePaper(button.dataset.choosePaper);
}

function choosePaper(paperId) {
    const card = document.querySelector(`[data-paper-id="${CSS.escape(paperId)}"]`);
    if (!card) return;
    const group = card.dataset.paperGroup;
    state.selectedPapers[group] = state.selectedPapers[group] === paperId ? null : paperId;
    savePaperSelections();
    updatePaperSelectionUI();
}

function updatePaperSelectionUI() {
    document.querySelectorAll('[data-paper-id]').forEach((card) => {
        const selected = state.selectedPapers[card.dataset.paperGroup] === card.dataset.paperId;
        card.classList.toggle('is-selected', selected);
        const button = card.querySelector('[data-choose-paper]');
        if (!button) return;
        button.setAttribute('aria-pressed', String(selected));
        button.innerHTML = selected
            ? '<span aria-hidden="true">✓</span> Chosen for this issue'
            : '<span aria-hidden="true">○</span> Choose this one';
    });

    const chosenCount = ['inside', 'outside'].filter((group) => state.selectedPapers[group]).length;
    byId('selection-count').textContent = `${chosenCount} of 2 chosen`;
    byId('reading-plan').classList.toggle('is-complete', chosenCount === 2);
}

function readPaperSelections(dateString) {
    try {
        const saved = JSON.parse(localStorage.getItem(`daily-digest-picks:${dateString}`));
        return { inside: saved?.inside || null, outside: saved?.outside || null };
    } catch {
        return { inside: null, outside: null };
    }
}

function savePaperSelections() {
    if (!state.currentDate) return;
    try {
        localStorage.setItem(`daily-digest-picks:${state.currentDate}`, JSON.stringify(state.selectedPapers));
    } catch {
        // The reading plan still works for this session when storage is unavailable.
    }
}

function focusDateSearch() {
    const card = document.querySelector('.date-card');
    const picker = byId('date-picker');
    picker.focus();
    try {
        if (typeof picker.showPicker === 'function') picker.showPicker();
    } catch {
        // Focused native date input remains usable when programmatic picker opening is restricted.
    }
    card?.scrollIntoView({ behavior: state.motionPaused ? 'auto' : 'smooth', block: 'center' });
}

function showLoadingState() {
    byId('main-content').classList.add('is-refreshing');
    byId('papers-container').innerHTML = `<div class="papers-grid">${[1, 2, 3, 4].map(() => '<article class="paper-card loading-card"><span class="skeleton skeleton--pill"></span><span class="skeleton skeleton--title"></span><span class="skeleton"></span><span class="skeleton skeleton--short"></span></article>').join('')}</div>`;
    byId('india-news-content').innerHTML = '<span class="skeleton"></span><span class="skeleton skeleton--short"></span>';
    byId('world-news-content').innerHTML = '<span class="skeleton"></span><span class="skeleton skeleton--short"></span>';
    byId('us-stocks-list').innerHTML = '<li class="stock-skeleton"><span class="skeleton"></span></li>';
    byId('in-stocks-list').innerHTML = '<li class="stock-skeleton"><span class="skeleton"></span></li>';
}

function openSearch() {
    if (state.searchOpen) {
        byId('global-search').focus();
        return;
    }

    state.searchOpen = true;
    document.body.classList.add('search-open');
    const drawer = byId('search-drawer');
    drawer.hidden = false;
    drawer.classList.remove('is-opening');
    requestAnimationFrame(() => drawer.classList.add('is-opening'));
    byId('search-trigger').setAttribute('aria-expanded', 'true');
    renderRecentIssues();
    requestAnimationFrame(() => byId('global-search').focus());
}

function closeSearch() {
    if (!state.searchOpen) return;
    state.searchOpen = false;
    document.body.classList.remove('search-open');
    byId('search-drawer').hidden = true;
    byId('search-trigger').setAttribute('aria-expanded', 'false');
    byId('global-search').value = '';
    byId('search-trigger').focus();
}

function renderRecentIssues() {
    const currentIssue = getCurrentIssueDate();
    const futureDates = state.availableDates.filter((date) => date > todayInIST()).sort();
    const pastDates = state.availableDates.filter((date) => date !== currentIssue && date <= todayInIST());
    const orderedDates = [currentIssue, ...futureDates, ...pastDates].filter(Boolean);
    byId('search-hint').textContent = 'Search papers, expanded notes, news, markets, and takeaways across the archive.';
    byId('search-results').innerHTML = orderedDates.slice(0, 6).map((date, index) => searchResultTemplate({
        date,
        section: 'research',
        title: formatDate(date, 'long'),
        summary: date === currentIssue
            ? 'Current published issue'
            : (date > todayInIST() ? 'Prepared-ahead vacation issue' : 'Open this archived issue')
    }, index)).join('');
}

async function runSearch() {
    const input = byId('global-search');
    const query = normalizeSearch(input.value);
    const resultsContainer = byId('search-results');

    if (!query) {
        renderRecentIssues();
        return;
    }

    byId('search-hint').textContent = 'Searching every published issue…';
    resultsContainer.innerHTML = '<div class="search-empty"><strong>Building the search index…</strong><span>This only takes a moment.</span></div>';
    const index = await buildSearchIndex();

    if (normalizeSearch(input.value) !== query) return;

    const terms = query.split(/\s+/).filter(Boolean);
    let matches = index
        .filter((entry) => terms.every((term) => entry.searchable.includes(term)))
        .sort((a, b) => b.score - a.score || parseDate(b.date) - parseDate(a.date))
        .slice(0, 30);

    const matchingDates = state.availableDates.filter((date) => normalizeSearch(dateSearchAliases(date)).includes(query));
    if (matchingDates.length) {
        matches = index.filter((entry) => entry.score === 10 && matchingDates.includes(entry.date));
    }

    byId('search-hint').textContent = matches.length
        ? `${matches.length}${matches.length === 30 ? '+' : ''} result${matches.length === 1 ? '' : 's'} for “${input.value.trim()}”`
        : `No results for “${input.value.trim()}”`;
    resultsContainer.innerHTML = matches.length
        ? matches.map((entry, index) => searchResultTemplate(entry, index)).join('')
        : '<div class="search-empty"><strong>No match found.</strong><span>Try a date, paper title, topic, or ticker.</span></div>';
}

async function buildSearchIndex() {
    if (state.searchIndex) return state.searchIndex;

    try {
        const response = await fetch('./data/search-index.json', { cache: 'no-cache' });
        if (response.ok) {
            const compactIndex = await response.json();
            if (Array.isArray(compactIndex)) {
                state.searchIndex = compactIndex.map(prepareSearchEntry);
                return state.searchIndex;
            }
        }
    } catch (error) {
        console.warn('The compact search index is unavailable; using loaded issues only.', error);
    }

    const dateEntries = state.availableDates.flatMap((date) => createIssueSearchEntries(date, state.dataCache.get(date)));
    state.searchIndex = dateEntries;
    return state.searchIndex;
}

function createIssueSearchEntries(date, data) {
    const isAdvance = data?.edition?.kind === 'advance';
    const entries = [{
        date,
        section: 'research',
        title: formatDate(date, 'long'),
        summary: isAdvance ? 'Prepared-ahead vacation issue' : 'Digest archive',
        content: `${dateSearchAliases(date)} ${flattenValues(data?.edition)}`,
        score: 10
    }];

    if (!data) return entries.map(prepareSearchEntry);

    if (data.news?.india) entries.push({ date, section: 'brief', title: isAdvance ? 'India knowledge' : 'India news', summary: summarizeNews(data.news.india), content: flattenValues(data.news.india), score: 5 });
    if (data.news?.world) entries.push({ date, section: 'brief', title: isAdvance ? 'World knowledge' : 'World news', summary: summarizeNews(data.news.world), content: flattenValues(data.news.world), score: 5 });

    Object.entries(data.papers || {}).forEach(([kind, paper]) => {
        if (!paper) return;
        entries.push({
            date,
            section: 'research',
            title: paper.title || paperConfig[kind]?.badge || 'Research paper',
            summary: paper.summary || paper.problem || paper.question || paper.idea || paper.discovery || 'Research paper',
            content: flattenValues(paper),
            score: 8
        });
    });

    const marketLabels = isAdvance
        ? [['us', 'US company study'], ['india', 'India company study']]
        : [['us', 'US market'], ['india', 'India market']];
    marketLabels.forEach(([market, label]) => {
        (data.stocks?.[market] || []).forEach((stock) => entries.push({
            date,
            section: 'markets',
            title: `${stock.symbol || 'Stock'} · ${label}`,
            summary: stock.reason || stock.thesis || 'Market watchlist',
            content: flattenValues(stock),
            score: 6
        }));
    });

    if (data.takeaways) entries.push({
        date,
        section: 'takeaways',
        title: 'Issue takeaways',
        summary: data.takeaways.explore || data.takeaways.remember?.[0] || 'Key ideas to remember',
        content: flattenValues(data.takeaways),
        score: 4
    });

    return entries.map(prepareSearchEntry);
}

function prepareSearchEntry(entry) {
    return {
        ...entry,
        summary: truncate(plainText(flattenValues(entry.summary)), 105),
        searchable: normalizeSearch([entry.title, entry.summary, entry.content, dateSearchAliases(entry.date)].join(' '))
    };
}

function summarizeNews(value) {
    if (Array.isArray(value)) {
        return value.slice(0, 2).map((item) => typeof item === 'string' ? item : item?.headline || item?.summary).filter(Boolean).join(' · ');
    }
    return plainText(value);
}

function searchResultTemplate(entry, index = 0) {
    return `
        <button class="search-result" type="button" style="--result-index:${index}" data-date="${escapeAttribute(entry.date)}" data-section="${escapeAttribute(entry.section || 'research')}">
            <span class="search-result__date">${escapeHTML(formatDate(entry.date, 'compact'))}</span>
            <span class="search-result__body"><strong>${escapeHTML(entry.title)}</strong><span>${escapeHTML(truncate(plainText(entry.summary), 105))}</span></span>
            <span class="search-result__arrow" aria-hidden="true">↗</span>
        </button>`;
}

async function handleSearchSelection(event) {
    const button = event.target.closest('.search-result');
    if (!button) return;

    const date = button.dataset.date;
    const section = button.dataset.section;
    closeSearch();
    await loadDate(date);
    requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function setupMotion() {
    state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.motionPaused = state.reducedMotion;
    document.documentElement.classList.add('motion-ready');
    updateMotionControl();

    if ('IntersectionObserver' in window && !state.motionPaused) {
        state.revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-revealed');
                observer.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }

    observeAnimatedElements();
    scheduleScrollUpdate();
}

function observeAnimatedElements() {
    const targets = [...document.querySelectorAll([
        '.section-heading',
        '.paper-card:not(.loading-card)',
        '.news-card',
        '.markets-card',
        '.takeaway-heading',
        '.takeaways-layout'
    ].join(','))];

    targets.forEach((element, index) => {
        if (element.classList.contains('reveal-item')) return;
        element.classList.add('reveal-item');
        element.style.setProperty('--reveal-delay', `${(index % 4) * 70}ms`);

        if (state.motionPaused || !state.revealObserver) element.classList.add('is-revealed');
        else state.revealObserver.observe(element);
    });
}

function toggleMotion() {
    state.motionPaused = !state.motionPaused;
    updateMotionControl();

    if (state.motionPaused) {
        resetInteractiveSurface(state.activeSurface);
        document.querySelectorAll('.reveal-item').forEach((element) => element.classList.add('is-revealed'));
        showToast('Motion effects paused.');
    } else {
        showToast('Motion effects are back on.');
    }
}

function updateMotionControl() {
    const control = byId('motion-toggle');
    document.documentElement.classList.toggle('animations-paused', state.motionPaused);
    control.setAttribute('aria-pressed', String(state.motionPaused));
    control.setAttribute('aria-label', state.motionPaused ? 'Resume motion effects' : 'Pause motion effects');
    control.title = state.motionPaused ? 'Resume motion effects' : 'Pause motion effects';
}

function handlePointerMove(event) {
    if (state.motionPaused || state.reducedMotion || !window.matchMedia('(pointer: fine)').matches) return;
    if (state.pointerFrame) return;

    state.pointerFrame = requestAnimationFrame(() => {
        state.pointerFrame = null;
        document.documentElement.style.setProperty('--cursor-x', `${event.clientX}px`);
        document.documentElement.style.setProperty('--cursor-y', `${event.clientY}px`);

        const surface = event.target.closest?.('[data-tilt]');
        if (state.activeSurface && state.activeSurface !== surface) resetInteractiveSurface(state.activeSurface);
        if (!surface) return;

        const bounds = surface.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        const horizontal = (x / bounds.width - 0.5) * 2;
        const vertical = (y / bounds.height - 0.5) * 2;
        surface.style.setProperty('--pointer-x', `${x}px`);
        surface.style.setProperty('--pointer-y', `${y}px`);
        surface.style.setProperty('--rotate-x', `${vertical * -1.5}deg`);
        surface.style.setProperty('--rotate-y', `${horizontal * 2}deg`);
        surface.style.setProperty('--surface-lift', '-3px');
        surface.classList.add('is-interacting');
        state.activeSurface = surface;
    });
}

function handlePointerOut(event) {
    const surface = event.target.closest?.('[data-tilt]');
    if (!surface || surface.contains(event.relatedTarget)) return;
    resetInteractiveSurface(surface);
}

function resetInteractiveSurface(surface) {
    if (!surface) return;
    surface.style.setProperty('--rotate-x', '0deg');
    surface.style.setProperty('--rotate-y', '0deg');
    surface.style.setProperty('--surface-lift', '0px');
    surface.classList.remove('is-interacting');
    if (state.activeSurface === surface) state.activeSurface = null;
}

function surpriseMe() {
    const insideCards = [...document.querySelectorAll('[data-paper-group="inside"] .paper-card')];
    const outsideCards = [...document.querySelectorAll('[data-paper-group="outside"] .paper-card')];
    if (!insideCards.length || !outsideCards.length) {
        showToast('The research cards are still loading.');
        return;
    }

    const picks = [
        insideCards[Math.floor(Math.random() * insideCards.length)],
        outsideCards[Math.floor(Math.random() * outsideCards.length)]
    ];
    const button = byId('surprise-button');
    document.querySelectorAll('.paper-card').forEach((item) => item.classList.remove('is-spotlighted'));
    picks.forEach((card) => {
        state.selectedPapers[card.dataset.paperGroup] = card.dataset.paperId;
        card.querySelector('details')?.setAttribute('open', '');
    });
    savePaperSelections();
    updatePaperSelectionUI();
    button.classList.add('is-finding');
    button.innerHTML = '<span aria-hidden="true">✦</span> Two picked!';
    picks[0].scrollIntoView({ behavior: state.motionPaused ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => {
        picks.forEach((card) => card.classList.add('is-spotlighted'));
    }, state.motionPaused ? 0 : 450);
    window.setTimeout(() => picks.forEach((card) => card.classList.remove('is-spotlighted')), 1800);
    window.setTimeout(() => {
        button.classList.remove('is-finding');
        button.innerHTML = '<span aria-hidden="true">✦</span> Pick my two';
    }, 1350);
}

function animateCounter(element, target) {
    const finalValue = Number(target) || 0;
    const token = String(Date.now() + Math.random());
    element.dataset.counterToken = token;

    if (state.motionPaused || finalValue === 0) {
        element.textContent = finalValue;
        return;
    }

    const start = performance.now();
    const duration = 650;
    element.classList.add('is-counting');

    const tick = (now) => {
        if (element.dataset.counterToken !== token) return;
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = Math.round(finalValue * eased);
        if (progress < 1) requestAnimationFrame(tick);
        else element.classList.remove('is-counting');
    };

    requestAnimationFrame(tick);
}

function animateDateCard() {
    const card = document.querySelector('.date-card');
    card.classList.remove('is-changing');
    void card.offsetWidth;
    card.classList.add('is-changing');
    window.setTimeout(() => card.classList.remove('is-changing'), 500);
}

function scheduleScrollUpdate() {
    if (state.scrollFrame) return;
    state.scrollFrame = requestAnimationFrame(() => {
        state.scrollFrame = null;
        updateReadingProgress();
    });
}

function updateReadingProgress() {
    const root = document.documentElement;
    const scrollable = root.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0;
    byId('reading-progress').style.width = `${progress}%`;
    byId('back-to-top').style.setProperty('--scroll-progress', `${progress * 3.6}deg`);
    byId('back-to-top').classList.toggle('is-visible', window.scrollY > 560);
    document.querySelector('.site-header').classList.toggle('is-scrolled', window.scrollY > 12);

    const sections = [...document.querySelectorAll('.content-section:not([hidden])')];
    let activeSection = sections[0]?.id;
    sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= 190) activeSection = section.id;
    });
    document.querySelectorAll('.section-nav a[data-section]').forEach((link) => {
        const active = link.dataset.section === activeSection;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
    });
}

function showLoadError(error, dateString) {
    const banner = byId('error-banner');
    banner.hidden = false;
    byId('error-message').textContent = error.message || `Please try loading ${formatDate(dateString, 'medium')} again.`;
    if (state.currentDate) byId('date-picker').value = state.currentDate;
}

function showFatalError(error) {
    byId('date-subtitle').textContent = 'Digest unavailable';
    showLoadError(error, '');
    byId('error-retry').hidden = true;
}

function hideError() {
    byId('error-banner').hidden = true;
    byId('error-retry').hidden = false;
}

function showToast(message) {
    const toast = byId('toast');
    window.clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    state.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3500);
}

function sanitizeRichText(value) {
    const template = document.createElement('template');
    template.innerHTML = String(value);
    const allowed = new Set(['P', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'A']);

    [...template.content.querySelectorAll('*')].forEach((element) => {
        if (!allowed.has(element.tagName)) {
            element.replaceWith(...element.childNodes);
            return;
        }

        const href = element.tagName === 'A' ? element.getAttribute('href') : null;
        [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
        if (element.tagName === 'A') {
            if (validUrl(href)) {
                element.setAttribute('href', href);
                element.setAttribute('target', '_blank');
                element.setAttribute('rel', 'noopener noreferrer');
            }
        }
    });

    return template.innerHTML;
}

function plainText(value) {
    if (value === null || value === undefined) return '';
    const template = document.createElement('template');
    template.innerHTML = String(value);
    return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
}

function flattenValues(value) {
    if (Array.isArray(value)) return value.map(flattenValues).join(' ');
    if (value && typeof value === 'object') return Object.values(value).map(flattenValues).join(' ');
    return value === null || value === undefined ? '' : String(value);
}

function dateSearchAliases(dateString) {
    if (!isDateString(dateString)) return dateString || '';
    const date = parseDate(dateString);
    return [
        dateString,
        formatDate(dateString, 'long'),
        formatDate(dateString, 'medium'),
        formatDate(dateString, 'short'),
        `${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'long' })} ${date.getFullYear()}`,
        `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
    ].join(' ');
}

function formatDate(dateString, style) {
    if (!isDateString(dateString)) return dateString || 'this date';
    const date = parseDate(dateString);
    const options = {
        long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
        medium: { month: 'long', day: 'numeric', year: 'numeric' },
        short: { month: 'short', day: 'numeric', year: 'numeric' },
        compact: { month: 'short', day: 'numeric' }
    };
    return date.toLocaleDateString('en-US', options[style] || options.medium);
}

function parseDate(dateString) {
    return new Date(`${dateString}T12:00:00`);
}

function isDateString(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = parseDate(value);
    if (Number.isNaN(date.getTime())) return false;
    const [year, month, day] = value.split('-').map(Number);
    return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}

function hasValue(value) {
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function validUrl(value) {
    if (!value) return false;
    try {
        const url = new URL(value, window.location.href);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
    return escapeHTML(value);
}

function truncate(value, length) {
    const string = String(value || '');
    return string.length > length ? `${string.slice(0, length - 1).trim()}…` : string;
}

function normalizeSearch(value) {
    return String(value || '')
        .toLocaleLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9₹$%]+/g, ' ')
        .trim();
}

function debounce(callback, delay) {
    let timer;
    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => callback(...args), delay);
    };
}

function byId(id) {
    return document.getElementById(id);
}
