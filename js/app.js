const state = {
    availableDates: [],
    currentDate: null,
    dataCache: new Map(),
    searchIndex: null,
    searchOpen: false,
    loadingDate: null,
    toastTimer: null
};

const paperConfig = {
    domain: { badge: 'Technical paper', badgeClass: 'domain', number: '01' },
    tech: { badge: 'AI · ML · CS', badgeClass: 'tech', number: '02' },
    random: { badge: 'Outside the domain', badgeClass: 'random', number: '03' }
};

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    bindInterface();

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
            : state.availableDates[0];

        await loadDate(initialDate, { historyMode: 'replace' });

        if (requestedDate && requestedDate !== initialDate) {
            showToast(`No digest was published on ${formatDate(requestedDate, 'medium')}. Showing the latest issue.`);
        }
    } catch (error) {
        showFatalError(error);
    }
}

function bindInterface() {
    byId('older-button').addEventListener('click', () => navigateRelative(1));
    byId('newer-button').addEventListener('click', () => navigateRelative(-1));
    byId('latest-button').addEventListener('click', () => {
        if (state.availableDates[0]) loadDate(state.availableDates[0]);
    });

    byId('date-picker').addEventListener('change', (event) => {
        const selected = event.target.value;
        if (state.availableDates.includes(selected)) {
            loadDate(selected);
            return;
        }

        event.target.value = state.currentDate || state.availableDates[0] || '';
        showToast(`There is no published digest for ${formatDate(selected, 'medium')}. Try another date.`);
    });

    byId('search-trigger').addEventListener('click', openSearch);
    byId('search-close').addEventListener('click', closeSearch);
    byId('search-form').addEventListener('submit', (event) => event.preventDefault());
    byId('global-search').addEventListener('input', debounce(runSearch, 90));
    byId('search-results').addEventListener('click', handleSearchSelection);
    byId('error-retry').addEventListener('click', () => {
        loadDate(state.loadingDate || state.currentDate || state.availableDates[0], { historyMode: 'replace' });
    });

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
        const nextDate = state.availableDates.includes(requested) ? requested : state.availableDates[0];
        if (nextDate && nextDate !== state.currentDate) loadDate(nextDate, { historyMode: 'none' });
    });

    window.addEventListener('scroll', updateReadingProgress, { passive: true });
}

function configureDatePicker() {
    const picker = byId('date-picker');
    const chronological = [...state.availableDates].sort();
    picker.min = chronological[0];
    picker.max = chronological[chronological.length - 1];
    byId('issue-count').textContent = `${state.availableDates.length} ${state.availableDates.length === 1 ? 'issue' : 'issues'}`;
}

async function loadDate(dateString, { historyMode = 'push' } = {}) {
    if (!state.availableDates.includes(dateString)) return;

    state.loadingDate = dateString;
    showLoadingState();
    hideError();

    try {
        const data = await fetchDigest(dateString);
        if (state.loadingDate !== dateString) return;

        renderDigest(data);
        state.currentDate = dateString;
        state.loadingDate = null;
        updateDateInterface(dateString);
        updateUrl(dateString, historyMode);
        document.title = `${formatDate(dateString, 'short')} — Daily Digest`;
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
    const isLatest = index === 0;

    byId('date-subtitle').textContent = formatDate(dateString, 'long');
    byId('issue-label').textContent = isLatest ? 'Latest issue' : 'From the archive';
    byId('display-day').textContent = String(date.getDate()).padStart(2, '0');
    byId('display-month').textContent = date.toLocaleDateString('en-US', { month: 'long' });
    byId('display-year').textContent = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric' });
    byId('date-picker').value = dateString;

    const olderButton = byId('older-button');
    const newerButton = byId('newer-button');
    const latestButton = byId('latest-button');
    const olderDate = state.availableDates[index + 1];
    const newerDate = state.availableDates[index - 1];

    olderButton.disabled = !olderDate;
    newerButton.disabled = !newerDate;
    latestButton.disabled = isLatest;
    latestButton.textContent = isLatest ? "You're up to date" : 'Jump to latest';
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
    if (dateString === state.availableDates[0]) url.searchParams.delete('date');
    else url.searchParams.set('date', dateString);
    url.hash = '';

    const method = historyMode === 'replace' ? 'replaceState' : 'pushState';
    window.history[method]({ date: dateString }, '', url);
}

function renderDigest(data) {
    renderPapers(data?.papers);
    renderNews(data?.news);
    renderStocks(data?.stocks);
    renderTakeaways(data?.takeaways);
    byId('research-count').textContent = Object.values(data?.papers || {}).filter(Boolean).length;
    byId('news-count').textContent = ['india', 'world'].filter((region) => data?.news?.[region]).length;
    byId('market-count').textContent = (data?.stocks?.us?.length || 0) + (data?.stocks?.india?.length || 0);
}

function renderPapers(papers = {}) {
    const container = byId('papers-container');
    const cards = ['domain', 'tech', 'random']
        .filter((kind) => papers?.[kind])
        .map((kind, index) => paperTemplate(kind, papers[kind], index));

    container.innerHTML = cards.length
        ? cards.join('')
        : '<div class="search-empty"><strong>No research papers in this issue.</strong><span>Try another date in the archive.</span></div>';
}

function paperTemplate(kind, paper, index) {
    const config = paperConfig[kind];
    const title = paper.title || 'Untitled paper';
    const lead = paper.summary || paper.problem || paper.question || paper.idea || paper.discovery || 'Open the paper to learn more.';
    const metadata = [paper.venue, paper.year || paper.date, paper.field].filter(Boolean).join(' · ');
    const detailFields = getPaperDetails(kind, paper);
    const detailMarkup = detailFields.length
        ? `<details class="paper-details"><summary>Explore the key ideas</summary><div class="paper-details__content">${detailFields.map(detailTemplate).join('')}</div></details>`
        : '';
    const links = [
        validUrl(paper.link) ? `<a class="paper-link" href="${escapeAttribute(paper.link)}" target="_blank" rel="noopener noreferrer">Read paper <span aria-hidden="true">↗</span></a>` : '',
        validUrl(paper.scholar) ? `<a class="paper-link" href="${escapeAttribute(paper.scholar)}" target="_blank" rel="noopener noreferrer">Scholar <span aria-hidden="true">↗</span></a>` : ''
    ].filter(Boolean).join('');

    return `
        <article class="paper-card" data-number="${config.number}" style="--card-index:${index}">
            <div class="paper-card__top">
                <span class="paper-badge paper-badge--${config.badgeClass}">${config.badge}</span>
                ${metadata ? `<span class="paper-card__meta">${escapeHTML(metadata)}</span>` : ''}
            </div>
            <h3>${escapeHTML(title)}</h3>
            ${paper.authors ? `<p class="paper-card__byline">By ${escapeHTML(paper.authors)}</p>` : ''}
            <p class="paper-card__summary">${escapeHTML(lead)}</p>
            ${detailMarkup}
            ${links ? `<footer class="paper-card__footer">${links}</footer>` : ''}
        </article>`;
}

function getPaperDetails(kind, paper) {
    const common = [
        ['Why is it difficult?', paper.difficulty],
        ['Core idea', paper.idea],
        ['How it works', paper.method],
        ['Results', paper.results]
    ];

    if (kind === 'domain') {
        return [
            ...common,
            ['Why you should care', paper.care || paper.takeaway],
            ['What to learn', paper.learn],
            ['Concepts to remember', paper.concepts]
        ].filter(([, value]) => hasValue(value));
    }

    if (kind === 'tech') {
        return [
            ...common,
            ['Why it matters', paper.matters || paper.takeaway],
            ['What to learn', paper.learn],
            ['Key takeaways', paper.takeaways]
        ].filter(([, value]) => hasValue(value));
    }

    return [
        ['Question', paper.question],
        ['Method', paper.method],
        ['Discovery', paper.discovery || paper.summary],
        ['Why it is interesting', paper.interesting],
        ['Surprising takeaway', paper.takeaway]
    ].filter(([, value]) => hasValue(value));
}

function detailTemplate([label, value]) {
    const content = Array.isArray(value)
        ? `<ul>${value.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>`
        : `<p>${escapeHTML(value)}</p>`;
    return `<div class="paper-detail"><strong>${escapeHTML(label)}</strong>${content}</div>`;
}

function renderNews(news = {}) {
    byId('india-news-content').innerHTML = news?.india
        ? sanitizeRichText(news.india)
        : '<p>No India brief was published for this issue.</p>';
    byId('world-news-content').innerHTML = news?.world
        ? sanitizeRichText(news.world)
        : '<p>No world brief was published for this issue.</p>';
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

    container.innerHTML = stocks.map((stock) => {
        const change = Number(stock.change);
        const hasChange = Number.isFinite(change);
        const isUp = change >= 0;
        const extra = [
            stock.thesis ? `<strong>Thesis:</strong> ${escapeHTML(stock.thesis)}` : '',
            stock.risk ? `<strong>Risk:</strong> ${escapeHTML(stock.risk)}` : ''
        ].filter(Boolean).join(' · ');

        return `
            <li>
                <div class="stock-row">
                    <div class="stock-identity">
                        <span class="stock-ticker">${escapeHTML(stock.symbol || '—')}</span>
                        <span class="stock-reason" title="${escapeAttribute(stock.reason || '')}">${escapeHTML(stock.reason || 'No context available')}</span>
                    </div>
                    <div class="stock-value">
                        <span class="stock-price">${escapeHTML(stock.price || '—')}</span>
                        ${hasChange ? `<span class="stock-change ${isUp ? 'price-up' : 'price-down'}">${isUp ? '↗' : '↘'} ${Math.abs(change).toFixed(2)}%</span>` : ''}
                    </div>
                </div>
                ${extra ? `<p class="stock-extra">${extra}</p>` : ''}
            </li>`;
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

function showLoadingState() {
    byId('papers-container').innerHTML = [1, 2, 3].map(() => '<article class="paper-card loading-card"><span class="skeleton skeleton--pill"></span><span class="skeleton skeleton--title"></span><span class="skeleton"></span><span class="skeleton skeleton--short"></span></article>').join('');
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
    byId('search-drawer').hidden = false;
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
    byId('search-hint').textContent = 'Search across dates, research, news, markets, and takeaways.';
    byId('search-results').innerHTML = state.availableDates.slice(0, 6).map((date) => searchResultTemplate({
        date,
        section: 'research',
        title: formatDate(date, 'long'),
        summary: date === state.availableDates[0] ? 'Latest published issue' : 'Open this archived issue'
    })).join('');
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
        ? matches.map(searchResultTemplate).join('')
        : '<div class="search-empty"><strong>No match found.</strong><span>Try a date, paper title, topic, or ticker.</span></div>';
}

async function buildSearchIndex() {
    if (state.searchIndex) return state.searchIndex;

    const issues = await Promise.all(state.availableDates.map(async (date) => {
        try {
            return [date, await fetchDigest(date)];
        } catch (error) {
            console.warn(error);
            return [date, null];
        }
    }));

    state.searchIndex = issues.flatMap(([date, data]) => createIssueSearchEntries(date, data));
    return state.searchIndex;
}

function createIssueSearchEntries(date, data) {
    const entries = [{
        date,
        section: 'research',
        title: formatDate(date, 'long'),
        summary: 'Digest archive',
        content: dateSearchAliases(date),
        score: 10
    }];

    if (!data) return entries.map(prepareSearchEntry);

    if (data.news?.india) entries.push({ date, section: 'brief', title: 'India news', summary: plainText(data.news.india), content: data.news.india, score: 5 });
    if (data.news?.world) entries.push({ date, section: 'brief', title: 'World news', summary: plainText(data.news.world), content: data.news.world, score: 5 });

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

    [['us', 'US market'], ['india', 'India market']].forEach(([market, label]) => {
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
        title: "Today's takeaways",
        summary: data.takeaways.explore || data.takeaways.remember?.[0] || 'Key ideas to remember',
        content: flattenValues(data.takeaways),
        score: 4
    });

    return entries.map(prepareSearchEntry);
}

function prepareSearchEntry(entry) {
    return {
        ...entry,
        summary: truncate(plainText(entry.summary), 105),
        searchable: normalizeSearch([entry.title, entry.summary, entry.content, dateSearchAliases(entry.date)].join(' '))
    };
}

function searchResultTemplate(entry) {
    return `
        <button class="search-result" type="button" data-date="${escapeAttribute(entry.date)}" data-section="${escapeAttribute(entry.section || 'research')}">
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

function updateReadingProgress() {
    const root = document.documentElement;
    const scrollable = root.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0;
    byId('reading-progress').style.width = `${progress}%`;
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
