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
    if (!papersData) return;
    
    const p1 = papersData.domain;
    if (p1) {
        document.getElementById('paper1-title').textContent = p1.title;
        document.getElementById('paper1-summary').textContent = p1.summary;
        document.getElementById('paper1-takeaway').textContent = p1.takeaway;
        document.getElementById('paper1-link').href = p1.link;
    }

    const p2 = papersData.tech;
    if (p2) {
        document.getElementById('paper2-title').textContent = p2.title;
        document.getElementById('paper2-summary').textContent = p2.summary;
        document.getElementById('paper2-takeaway').textContent = p2.takeaway;
        document.getElementById('paper2-link').href = p2.link;
    }

    const p3 = papersData.random;
    if (p3) {
        document.getElementById('paper3-title').textContent = p3.title;
        document.getElementById('paper3-summary').textContent = p3.summary;
        document.getElementById('paper3-takeaway').textContent = p3.takeaway;
        document.getElementById('paper3-link').href = p3.link;
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
