document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

let availableDates = [];

async function initApp() {
    try {
        // Fetch the index of available dates
        const indexResponse = await fetch('./data/index.json');
        if (!indexResponse.ok) throw new Error('Could not load index.json');
        
        availableDates = await indexResponse.json();
        
        // Sort dates descending just in case
        availableDates.sort((a, b) => new Date(b) - new Date(a));
        
        if (availableDates.length === 0) {
            throw new Error('No digest dates found');
        }

        setupDateSelector();
        
        // Load the most recent date by default
        await loadDate(availableDates[0]);
        
    } catch (error) {
        console.error('Error initializing app:', error);
        document.getElementById('date-subtitle').textContent = 'Failed to load digest index.';
    }
}

function setupDateSelector() {
    const selector = document.getElementById('date-selector');
    if (!selector) return;

    selector.innerHTML = '';
    availableDates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = new Date(date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        selector.appendChild(option);
    });

    selector.addEventListener('change', (e) => {
        const selectedDate = e.target.value;
        showLoadingState();
        loadDate(selectedDate);
    });
}

async function loadDate(dateString) {
    try {
        const response = await fetch(`./data/${dateString}.json`);
        if (!response.ok) throw new Error(`Could not load data for ${dateString}`);
        
        const data = await response.json();
        
        // Update Title Date
        const dateObj = new Date(dateString);
        document.getElementById('date-subtitle').textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        // Render sections
        renderNews(data.news);
        renderPapers(data.papers);
        renderStocks(data.stocks);
        if (data.takeaways) renderTakeaways(data.takeaways);
        
        // Trigger animations
        triggerRevealAnimations();
        
    } catch (error) {
        console.error(`Error loading data for ${dateString}:`, error);
        document.getElementById('date-subtitle').textContent = `Failed to load data for ${dateString}`;
    }
}

function showLoadingState() {
    // Add skeleton classes to items
    const elements = document.querySelectorAll('#news-section p, .paper-item h3, .paper-item p, .takeaway span, .stock-list');
    elements.forEach(el => {
        el.innerHTML = '<span class="skeleton"></span>';
        el.classList.remove('reveal');
    });
}

function triggerRevealAnimations() {
    const cards = document.querySelectorAll('.glass-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.15}s`;
        card.classList.add('reveal');
    });
    
    // Add 3D Tilt effect
    cards.forEach(card => {
        card.addEventListener('mousemove', handleTilt);
        card.addEventListener('mouseleave', resetTilt);
    });
}

function handleTilt(e) {
    const card = this;
    const cardRect = card.getBoundingClientRect();
    const x = e.clientX - cardRect.left;
    const y = e.clientY - cardRect.top;
    
    const centerX = cardRect.width / 2;
    const centerY = cardRect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -5; // Max rotation 5deg
    const rotateY = ((x - centerX) / centerX) * 5;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    card.style.boxShadow = `${-rotateY * 2}px ${rotateX * 2}px 30px rgba(0,0,0,0.3)`;
}

function resetTilt() {
    const card = this;
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    card.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.2)`;
}

// Rendering logic is the same, just removing loading classes
function renderNews(newsData) {
    if (!newsData) return;
    document.getElementById('india-news-content').innerHTML = newsData.india;
    document.getElementById('world-news-content').innerHTML = newsData.world;
}

function renderPapers(papersData) {
    const container = document.getElementById('papers-container');
    if (!papersData || !container) return;
    
    container.innerHTML = ''; // Clear skeletons
    
    // Domain Paper
    if (papersData.domain) {
        const p = papersData.domain;
        container.innerHTML += `
            <div class="paper-item">
                <span class="badge domain-badge">Domain: ISP & AI</span>
                <h3>${p.title || 'Untitled'}</h3>
                <div class="paper-meta mb-3">
                    ${p.authors ? `<span><strong>Authors:</strong> ${p.authors}</span><br>` : ''}
                    ${p.venue ? `<span><strong>Venue:</strong> ${p.venue}</span> ` : ''}
                    ${p.year ? `<span><strong>Year:</strong> ${p.year}</span>` : ''}
                </div>
                ${p.problem ? `<div class="paper-section"><strong>Problem:</strong> <p>${p.problem}</p></div>` : ''}
                ${p.difficulty ? `<div class="paper-section"><strong>Difficulty:</strong> <p>${p.difficulty}</p></div>` : ''}
                ${p.idea ? `<div class="paper-section"><strong>Core Idea:</strong> <p>${p.idea}</p></div>` : ''}
                ${p.method ? `<div class="paper-section"><strong>Method:</strong> <p>${p.method}</p></div>` : ''}
                ${p.results ? `<div class="paper-section"><strong>Results:</strong> <p>${p.results}</p></div>` : ''}
                
                ${p.care ? `
                <div class="takeaway mt-3">
                    <strong>Why should I care:</strong> <span>${p.care}</span>
                </div>` : ''}
                
                ${p.learn && p.learn.length > 0 ? `
                <div class="paper-section mt-3"><strong>What I should learn:</strong>
                    <ul class="paper-list">${p.learn.map(l => `<li>${l}</li>`).join('')}</ul>
                </div>` : ''}
                
                ${p.concepts && p.concepts.length > 0 ? `
                <div class="paper-section mt-3"><strong>Concepts to remember:</strong>
                    <ul class="paper-list">${p.concepts.map(c => `<li>${c}</li>`).join('')}</ul>
                </div>` : ''}
                
                <div class="paper-links mt-4">
                    ${p.link ? `<a href="${p.link}" class="btn primary-btn" target="_blank" rel="noopener noreferrer">Read Paper</a>` : ''}
                    ${p.scholar ? `<a href="${p.scholar}" class="btn secondary-btn" target="_blank" rel="noopener noreferrer">Google Scholar</a>` : ''}
                </div>
            </div>
            <hr class="divider">
        `;
    }
    
    // Tech Paper
    if (papersData.tech) {
        const p = papersData.tech;
        container.innerHTML += `
            <div class="paper-item">
                <span class="badge tech-badge">Tech: CS / AI / ML</span>
                <h3>${p.title || 'Untitled'}</h3>
                <div class="paper-meta mb-3">
                    ${p.authors ? `<span><strong>Authors:</strong> ${p.authors}</span><br>` : ''}
                    ${p.venue ? `<span><strong>Venue:</strong> ${p.venue}</span> ` : ''}
                    ${p.date ? `<span><strong>Date:</strong> ${p.date}</span>` : ''}
                </div>
                ${p.problem ? `<div class="paper-section"><strong>Problem:</strong> <p>${p.problem}</p></div>` : ''}
                ${p.idea ? `<div class="paper-section"><strong>Key Idea:</strong> <p>${p.idea}</p></div>` : ''}
                ${p.method ? `<div class="paper-section"><strong>Method:</strong> <p>${p.method}</p></div>` : ''}
                ${p.results ? `<div class="paper-section"><strong>Results:</strong> <p>${p.results}</p></div>` : ''}
                
                ${p.matters ? `
                <div class="takeaway mt-3">
                    <strong>Why it matters:</strong> <span>${p.matters}</span>
                </div>` : ''}
                
                ${p.learn ? `<div class="paper-section mt-3"><strong>What I should learn:</strong> <p>${p.learn}</p></div>` : ''}
                
                ${p.takeaways && p.takeaways.length > 0 ? `
                <div class="paper-section mt-3"><strong>Takeaways:</strong>
                    <ul class="paper-list">${p.takeaways.map(t => `<li>${t}</li>`).join('')}</ul>
                </div>` : ''}
                
                <div class="paper-links mt-4">
                    ${p.link ? `<a href="${p.link}" class="btn primary-btn" target="_blank" rel="noopener noreferrer">Read Paper</a>` : ''}
                </div>
            </div>
            <hr class="divider">
        `;
    }
    
    // Random Paper
    if (papersData.random) {
        const p = papersData.random;
        container.innerHTML += `
            <div class="paper-item">
                <span class="badge random-badge">Explore: Out of Domain</span>
                <h3>${p.title || 'Untitled'}</h3>
                <div class="paper-meta mb-3">
                    ${p.authors ? `<span><strong>Authors:</strong> ${p.authors}</span><br>` : ''}
                    ${p.field ? `<span><strong>Field:</strong> ${p.field}</span>` : ''}
                </div>
                ${p.question ? `<div class="paper-section"><strong>Question:</strong> <p>${p.question}</p></div>` : ''}
                ${p.method ? `<div class="paper-section"><strong>Method:</strong> <p>${p.method}</p></div>` : ''}
                ${p.discovery ? `<div class="paper-section"><strong>Discovery:</strong> <p>${p.discovery}</p></div>` : ''}
                ${p.interesting ? `<div class="paper-section"><strong>Why it is interesting:</strong> <p>${p.interesting}</p></div>` : ''}
                
                ${p.takeaway ? `
                <div class="takeaway mt-3">
                    <strong>Surprising Takeaway:</strong> <span>${p.takeaway}</span>
                </div>` : ''}
                
                <div class="paper-links mt-4">
                    ${p.link ? `<a href="${p.link}" class="btn primary-btn" target="_blank" rel="noopener noreferrer">Read Paper</a>` : ''}
                </div>
            </div>
        `;
    }
}

function renderTakeaways(takeawaysData) {
    const section = document.getElementById('takeaways-section');
    if (!section) return;
    
    if (!takeawaysData) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    
    const rememberList = document.getElementById('takeaways-remember-list');
    if (rememberList && takeawaysData.remember) {
        rememberList.innerHTML = takeawaysData.remember.map(item => \`<li>\${item}</li>\`).join('');
    }
    
    const explore = document.getElementById('takeaways-explore');
    if (explore && takeawaysData.explore) {
        explore.innerHTML = \`<span>\${takeawaysData.explore}</span>\`;
    }
}

function renderStocks(stocksData) {
    if (!stocksData) return;

    const renderList = (containerId, stocksArray) => {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; 

        if (!stocksArray || stocksArray.length === 0) {
            container.innerHTML = '<li>No data available today</li>';
            return;
        }

        stocksArray.forEach(stock => {
            const isUp = stock.change >= 0;
            const changeClass = isUp ? 'price-up' : 'price-down';
            const changeSymbol = isUp ? '▲' : '▼';
            
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="stock-header">
                    <span class="stock-ticker">${stock.symbol}</span>
                    <span class="stock-price ${changeClass}">${stock.price} <small>${changeSymbol} ${Math.abs(stock.change)}%</small></span>
                </div>
                <div class="stock-reason">${stock.reason}</div>
            `;
            container.appendChild(li);
        });
    };

    renderList('us-stocks-list', stocksData.us);
    renderList('in-stocks-list', stocksData.india);
}
