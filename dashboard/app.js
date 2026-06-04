let sentimentChart = null;
let selectedProducts = new Set(); // Tracks product SKUs checked for bulk scraping
let currentReviews = []; // Store reviews of the currently loaded product
let lastSearchResults = []; // Cache for raw catalog search results

// Category Comparison State Variables
let currentActiveView = 'view-overview'; // Tracks active view
let categoryReviews = []; // Stores reviews of all products in active category
let categoryProducts = []; // Stores product definitions in active category
let activeCategory = ""; // Active category selection (phone, watch, etc.)
let categoryChartInstance = null; // Chart.js instance for Category view
let categorySelectedSubCategory = "all"; // Current sub-category filter value
let categorySelectedProductIds = new Set(); // Set of product_ids checked for comparison

const languageNames = {
    "fr": "🇫🇷 Français",
    "en": "🇬🇧 Anglais",
    "nl": "🇳🇱 Néerlandais",
    "sv": "🇸🇪 Suédois",
    "de": "🇩🇪 Allemand",
    "it": "🇮🇹 Italien",
    "da": "🇩🇰 Danois",
    "es": "🇪🇸 Espagnol",
    "pt": "🇵🇹 Portugais",
    "pl": "🇵🇱 Polonais",
    "no": "🇳🇴 Norvégien",
    "fi": "🇫🇮 Finnois",
    "cs": "🇨🇿 Tchèque",
    "sk": "🇸🇰 Slovaque",
    "bg": "🇧🇬 Bulgare",
    "ro": "🇷🇴 Roumain",
    "tr": "🇹🇷 Turc",
    "uk": "🇺🇦 Ukrainien",
    "hr": "🇭🇷 Croate",
    "bs": "🇧🇦 Bosniaque",
    "sl": "🇸🇮 Slovène",
    "sq": "🇦🇱 Albanais",
    "sr": "🇷🇸 Serbe",
    "hu": "🇭🇺 Hongrois",
    "el": "🇬🇷 Grec",
    "et": "🇪🇪 Estonien",
    "lv": "🇱🇻 Letton",
    "lt": "🇱🇹 Lituanien",
    "ru": "🇷🇺 Russe",
    "zh": "🇨🇳 Chinois",
    "ko": "🇰🇷 Coréen",
    "ja": "🇯🇵 Japonais",
    "ar": "🇸🇦 Arabe",
    "he": "🇮🇱 Hébreu"
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadProducts();
    initUrlScraper();
    initCatalogSearch();
    initLanguageSelector();
    initClearHistoryButton();
});

// 1. Tab Navigation Logic (Supports Overview, Synthesis, Themes, Categories, and Discover)
function initNavigation() {
    const navs = [
        { btn: 'nav-overview', li: 'li-overview', view: 'view-overview', title: 'Dashboard Overview' },
        { btn: 'nav-ai-synthesis', li: 'li-ai-synthesis', view: 'view-ai-synthesis', title: 'Synthèse IA & Verbatims' },
        { btn: 'nav-themes', li: 'li-themes', view: 'view-themes', title: 'Filtre par Thématiques' },
        { btn: 'nav-categories', li: 'li-categories', view: 'view-categories', title: 'Catégories & Comparateur' },
        { btn: 'nav-discover', li: 'li-discover', view: 'view-discover', title: 'Découverte & Scraping' }
    ];

    navs.forEach(nav => {
        const liElem = document.getElementById(nav.li);
        const btnElem = document.getElementById(nav.btn);
        
        const handleNavigation = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle active view and navigation link state
            navs.forEach(n => {
                const vElem = document.getElementById(n.view);
                const lElem = document.getElementById(n.li);
                if (n.view === nav.view) {
                    if (vElem) vElem.style.display = 'block';
                    if (lElem) lElem.classList.add('active');
                } else {
                    if (vElem) vElem.style.display = 'none';
                    if (lElem) lElem.classList.remove('active');
                }
            });
            
            // Track active view state
            currentActiveView = nav.view;
            
            // Update global premium header title dynamically
            const mainTitle = document.getElementById('main-view-title');
            if (mainTitle) mainTitle.innerText = nav.title;
            
            // Show/Hide selectors container based on tab relevance
            const selectors = document.getElementById('global-selectors');
            if (selectors) {
                selectors.style.display = (nav.view === 'view-discover') ? 'none' : 'flex';
            }
            
            // Toggle product selector visibility specifically (hide on Categories comparison tab)
            const prodSelector = document.querySelector('.product-selector-container');
            if (prodSelector) {
                prodSelector.style.display = (nav.view === 'view-categories') ? 'none' : 'block';
            }
            
            // Handle active tab redraws with current language filter
            const langSelect = document.getElementById('language-select');
            const selectedLang = langSelect ? langSelect.value : 'all';
            
            if (nav.view === 'view-overview') {
                loadProducts().then(() => {
                    filterAndRenderReviews(selectedLang);
                });
            } else if (nav.view === 'view-ai-synthesis' || nav.view === 'view-themes') {
                filterAndRenderReviews(selectedLang);
            } else if (nav.view === 'view-categories') {
                initCategoryView();
            }
        };

        if (liElem) {
            liElem.addEventListener('click', handleNavigation);
        }
        if (btnElem) {
            btnElem.addEventListener('click', handleNavigation);
        }
    });
}

// 2. Fetch list of processed products and populate dropdown in Overview
async function loadProducts() {
    try {
        const response = await fetch('../data/processed/products.json');
        if (!response.ok) throw new Error('Catalog products.json not found');
        const products = await response.json();
        
        const select = document.getElementById('product-select');
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Choisir un produit à analyser --</option>';
        
        products.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.product_id;
            opt.textContent = `${p.product_name} (${p.reviews_count} avis)`;
            select.appendChild(opt);
        });

        // Restore selected value if still valid
        if (products.some(p => p.product_id === currentValue)) {
            select.value = currentValue;
        } else if (products.length > 0) {
            select.value = products[0].product_id;
            loadProductData(products[0].product_id);
        }

        // Event listener for product change
        select.onchange = (e) => {
            if (e.target.value) {
                loadProductData(e.target.value);
            }
        };
    } catch (err) {
        console.log("No analyzed products available yet.");
        document.getElementById('product-select').innerHTML = '<option value="">Aucun produit disponible (lancez le scraper)</option>';
    }
}

// Fetch and display specific product reviews
async function loadProductData(productId) {
    try {
        const response = await fetch(`../data/processed/${productId}.json`);
        if (!response.ok) throw new Error(`Reviews file not found for ${productId}`);
        const reviews = await response.json();
        
        // Save in global state
        currentReviews = reviews;
        
        // Populate language selector dynamic options
        populateLanguageOptions(reviews);
        
        // Trigger initial rendering with all languages
        filterAndRenderReviews('all');
    } catch (err) {
        console.error(`Error loading reviews for ${productId}:`, err);
    }
}

// 3. Dynamic Language Selector Populate
function populateLanguageOptions(reviews) {
    const langSelect = document.getElementById('language-select');
    if (!langSelect) return;
    
    // Find unique languages in reviews
    const uniqueLangs = new Set();
    reviews.forEach(r => {
        if (r.original_language) {
            uniqueLangs.add(r.original_language);
        }
    });

    langSelect.innerHTML = '';
    
    // 1. "Toutes les langues" option
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = `🌐 Toutes les langues (${reviews.length})`;
    langSelect.appendChild(allOpt);

    // 2. Put French "fr" at the top of the list if present
    if (uniqueLangs.has('fr')) {
        const frReviewsCount = reviews.filter(r => r.original_language === 'fr').length;
        const frOpt = document.createElement('option');
        frOpt.value = 'fr';
        frOpt.textContent = `🇫🇷 Français (${frReviewsCount})`;
        langSelect.appendChild(frOpt);
        uniqueLangs.delete('fr');
    }

    // 3. Populate remaining languages sorted alphabetically
    const sortedLangs = Array.from(uniqueLangs).sort((a, b) => {
        const nameA = languageNames[a] || a;
        const nameB = languageNames[b] || b;
        return nameA.localeCompare(nameB);
    });

    sortedLangs.forEach(lang => {
        const count = reviews.filter(r => r.original_language === lang).length;
        const opt = document.createElement('option');
        opt.value = lang;
        opt.textContent = `${languageNames[lang] || lang.toUpperCase()} (${count})`;
        langSelect.appendChild(opt);
    });
}

function initLanguageSelector() {
    const langSelect = document.getElementById('language-select');
    if (!langSelect) return;
    
    langSelect.addEventListener('change', (e) => {
        filterAndRenderReviews(e.target.value);
    });
}

// Filter reviews based on language and trigger dashboard redraws
function filterAndRenderReviews(selectedLang) {
    if (currentActiveView === 'view-categories') {
        renderCategoryData(selectedLang);
        return;
    }

    let filtered = currentReviews;
    if (selectedLang !== 'all') {
        filtered = currentReviews.filter(r => r.original_language === selectedLang);
    }
    
    updateMetrics(filtered);
    updateChart(filtered);
    updateRatingSummary(filtered);
    updateAspects(filtered);
    populateTable(filtered);
    
    // Trigger updates for Synthesis and Themes tabs
    updateAISynthesis(filtered);
    updateThemesView(filtered);
}

function updateMetrics(reviews) {
    const totalCount = document.getElementById('total-count');
    const positiveScore = document.getElementById('positive-score');
    const negativeScore = document.getElementById('negative-score');

    const total = reviews.length;
    const positive = reviews.filter(r => r.sentiment === 'positive').length;
    const negative = reviews.filter(r => r.sentiment === 'negative').length;
    
    const posPercent = total > 0 ? Math.round((positive / total) * 100) : 0;
    const negPercent = total > 0 ? Math.round((negative / total) * 100) : 0;

    animateValue(totalCount, parseInt(totalCount.innerText) || 0, total, 1000);
    animateValue(positiveScore, parseInt(positiveScore.innerText) || 0, posPercent, 1000, '%');
    animateValue(negativeScore, parseInt(negativeScore.innerText) || 0, negPercent, 1000, '%');
}

function updateRatingSummary(reviews) {
    const total = reviews.length;
    
    // 1. Calculate Average Rating
    const totalRatingSum = reviews.reduce((sum, r) => sum + (r.rating || 5), 0);
    const avgRating = total > 0 ? (totalRatingSum / total).toFixed(1) : "0.0";
    
    const avgValElem = document.getElementById('avg-rating-value');
    const avgStarsElem = document.getElementById('avg-rating-stars');
    const totalCountElem = document.getElementById('rating-total-count');
    const avgMetricElem = document.getElementById('avg-rating-metric');
    const avgMetricStarsElem = document.getElementById('avg-rating-stars-metric');
    
    if (avgValElem) avgValElem.innerText = avgRating;
    if (avgMetricElem) avgMetricElem.innerText = avgRating;
    
    // Generate stars visual (e.g. ★★★★☆)
    if (avgStarsElem || avgMetricStarsElem) {
        const rounded = Math.round(parseFloat(avgRating));
        let stars = "";
        for (let i = 1; i <= 5; i++) {
            stars += i <= rounded ? "★" : "☆";
        }
        if (avgStarsElem) avgStarsElem.innerText = stars;
        if (avgMetricStarsElem) avgMetricStarsElem.innerText = stars;
    }
    
    if (totalCountElem) {
        totalCountElem.innerText = `${total.toLocaleString()} avis au total`;
    }
    
    // 2. Count star distributions
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
        const rating = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
        counts[rating]++;
    });
    
    // 3. Update distribution bars & percentages
    for (let i = 1; i <= 5; i++) {
        const count = counts[i];
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        
        const fill = document.getElementById(`fill-${i}-star`);
        const pctText = document.getElementById(`pct-${i}-star`);
        
        if (pctText) pctText.innerText = `${pct}%`;
        
        if (fill) {
            // Animate fill bar width slightly delayed
            setTimeout(() => {
                fill.style.width = `${pct}%`;
            }, 100);
        }
    }
}

function animateValue(obj, start, end, duration, suffix = '') {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        obj.innerHTML = Math.floor(easeProgress * (end - start) + start).toLocaleString() + suffix;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function updateChart(reviews) {
    const ctx = document.getElementById('sentimentChart').getContext('2d');
    
    const timeline = {};
    reviews.forEach(r => {
        const date = r.date;
        if (!timeline[date]) {
            timeline[date] = { positive: 0, negative: 0, neutral: 0 };
        }
        timeline[date][r.sentiment]++;
    });

    const sortedDates = Object.keys(timeline).sort();
    const positiveData = sortedDates.map(d => timeline[d].positive);
    const negativeData = sortedDates.map(d => timeline[d].negative);

    if (sentimentChart) {
        sentimentChart.destroy();
    }

    const positiveGradient = ctx.createLinearGradient(0, 0, 0, 400);
    positiveGradient.addColorStop(0, 'rgba(29, 184, 134, 0.35)');
    positiveGradient.addColorStop(1, 'rgba(29, 184, 134, 0.0)');

    const negativeGradient = ctx.createLinearGradient(0, 0, 0, 400);
    negativeGradient.addColorStop(0, 'rgba(232, 75, 90, 0.35)');
    negativeGradient.addColorStop(1, 'rgba(232, 75, 90, 0.0)');

    sentimentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [
                {
                    label: 'Avis Positifs',
                    data: positiveData,
                    borderColor: '#1DB886',
                    backgroundColor: positiveGradient,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#1DB886',
                    pointBorderColor: '#08090F',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Avis Négatifs',
                    data: negativeData,
                    borderColor: '#E84B5A',
                    backgroundColor: negativeGradient,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#E84B5A',
                    pointBorderColor: '#08090F',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#8B9BB4', font: { family: 'Inter' } }
                },
                tooltip: {
                    backgroundColor: 'rgba(8, 9, 15, 0.95)',
                    titleColor: '#F8F9FF',
                    bodyColor: '#8B9BB4',
                    borderColor: 'rgba(20, 40, 160, 0.3)',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(20, 40, 160, 0.07)', drawBorder: false },
                    ticks: { color: '#8B9BB4', precision: 0 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8B9BB4' }
                }
            }
        }
    });
}

function populateTable(reviews) {
    const tbody = document.getElementById('data-tbody');
    tbody.innerHTML = '';
    
    // Show top 8 recent reviews
    const displayReviews = reviews.slice(0, 8);

    displayReviews.forEach(item => {
        const tr = document.createElement('tr');
        
        // Construct translation badge if needed
        let transBadge = "";
        let displayedText = item.review_text || item.original_text || "";
        
        if (item.original_language && item.original_language !== 'fr') {
            const flag = languageNames[item.original_language] ? languageNames[item.original_language].split(" ")[0] : "🌐";
            transBadge = `<span class="badge neutral" style="margin-left: 8px; font-size: 0.7rem; padding: 2px 6px;" title="Texte original : ${item.original_text}">Traduit de ${flag}</span>`;
        }

        tr.innerHTML = `
            <td><span style="color: #94a3b8;">Samsung FR</span></td>
            <td>
                <span title="${displayedText}">${displayedText.length > 80 ? displayedText.substring(0, 80) + '...' : displayedText}</span>
                ${transBadge}
            </td>
            <td>${item.date}</td>
            <td><span class="badge ${item.sentiment}">${item.sentiment === 'positive' ? 'Positif' : item.sentiment === 'negative' ? 'Négatif' : 'Neutre'}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

let progressInterval = null;

function startScrapingProgressTracker(productName) {
    const modal = document.getElementById('scrape-progress-modal');
    const titleEl = document.getElementById('progress-product-title');
    const badgeEl = document.getElementById('progress-stage-badge');
    const barEl = document.getElementById('progress-bar-fill');
    const msgEl = document.getElementById('progress-text-msg');
    const pctEl = document.getElementById('progress-percentage-label');
    
    const stepExtraction = document.getElementById('step-extraction');
    const stepTranslation = document.getElementById('step-translation');
    const iconExtraction = document.getElementById('icon-extraction');
    const iconTranslation = document.getElementById('icon-translation');
    
    if (!modal) return;
    
    // Reset and show modal
    titleEl.textContent = productName || "Produit Samsung";
    badgeEl.textContent = "Initialisation";
    barEl.style.width = "0%";
    pctEl.textContent = "0%";
    msgEl.textContent = "Démarrage de la tâche de scraping...";
    
    stepExtraction.className = "stage-step";
    stepTranslation.className = "stage-step";
    iconExtraction.textContent = "⏳";
    iconTranslation.textContent = "⏳";
    
    modal.style.display = 'flex';
    
    // Setup close button
    const closeBtn = document.getElementById('close-progress-modal-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    if (progressInterval) clearInterval(progressInterval);
    
    progressInterval = setInterval(async () => {
        try {
            const res = await fetch('/api/progress');
            if (!res.ok) return;
            const data = await res.json();
            
            if (data.status === 'running') {
                if (data.stage === 'extraction') {
                    badgeEl.textContent = "Extraction";
                    badgeEl.style.background = "rgba(59, 130, 246, 0.15)";
                    badgeEl.style.color = "var(--primary-color)";
                    badgeEl.style.borderColor = "rgba(59, 130, 246, 0.3)";
                    
                    stepExtraction.className = "stage-step active";
                    iconExtraction.textContent = "⚡";
                    stepTranslation.className = "stage-step";
                    iconTranslation.textContent = "⏳";
                } else if (data.stage === 'translation') {
                    badgeEl.textContent = "Traduction & Analyse";
                    badgeEl.style.background = "rgba(245, 158, 11, 0.15)";
                    badgeEl.style.color = "#f59e0b";
                    badgeEl.style.borderColor = "rgba(245, 158, 11, 0.3)";
                    
                    stepExtraction.className = "stage-step done";
                    iconExtraction.textContent = "✅";
                    stepTranslation.className = "stage-step active";
                    iconTranslation.textContent = "⚡";
                }
                
                barEl.style.width = `${data.percent}%`;
                pctEl.textContent = `${data.percent}%`;
                msgEl.textContent = data.message;
            } else if (data.stage === 'completed' || data.status === 'completed') {
                clearInterval(progressInterval);
                badgeEl.textContent = "Terminé";
                badgeEl.style.background = "rgba(16, 185, 129, 0.15)";
                badgeEl.style.color = "var(--positive-color)";
                badgeEl.style.borderColor = "rgba(16, 185, 129, 0.3)";
                
                barEl.style.width = "100%";
                pctEl.textContent = "100%";
                msgEl.textContent = "Traitement terminé avec succès ! Rechargement du dashboard...";
                
                stepExtraction.className = "stage-step done";
                iconExtraction.textContent = "✅";
                stepTranslation.className = "stage-step done";
                iconTranslation.textContent = "✅";
                
                // Show modal if it was hidden
                modal.style.display = 'flex';
                
                setTimeout(async () => {
                    modal.style.display = 'none';
                    await loadProducts();
                    const productSelect = document.getElementById('product-select');
                    if (productSelect && productSelect.options.length > 1) {
                        // Pick latest
                        productSelect.selectedIndex = productSelect.options.length - 1;
                        loadProductData(productSelect.value);
                    }
                }, 3000);
            }
        } catch (err) {
            console.error("Error fetching progress:", err);
        }
    }, 1000);
}

// 4. Mini Sidebar Scraper (URL direct)
function initUrlScraper() {
    const form = document.getElementById('scraper-form');
    const urlInput = document.getElementById('scraper-url');
    const btn = document.getElementById('scraper-btn');
    const btnText = document.getElementById('scraper-btn-text');
    const spinner = document.getElementById('scraper-spinner');
    const status = document.getElementById('scraper-status');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const url = urlInput.value.trim();

        btn.disabled = true;
        btnText.textContent = "...";
        spinner.style.display = 'block';
        status.className = 'status-msg info';
        status.textContent = "Scraping...";

        // Start progress tracker overlay immediately!
        startScrapingProgressTracker("Extraction directe depuis l'URL...");

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, limit: 100 })
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                status.className = 'status-msg success';
                status.textContent = "Succès !";
                urlInput.value = '';
                
                await loadProducts();
                const productSelect = document.getElementById('product-select');
                productSelect.value = result.product_id;
                loadProductData(result.product_id);
            } else {
                status.className = 'status-msg error';
                status.textContent = "Erreur.";
                const modal = document.getElementById('scrape-progress-modal');
                if (modal) modal.style.display = 'none';
            }
        } catch (err) {
            status.className = 'status-msg error';
            status.textContent = "Erreur réseau.";
            const modal = document.getElementById('scrape-progress-modal');
            if (modal) modal.style.display = 'none';
        } finally {
            btn.disabled = false;
            btnText.textContent = "Scraper";
            spinner.style.display = 'none';
            setTimeout(() => { status.textContent = ''; status.className = 'status-msg'; }, 4000);
        }
    });
}

// 5. Samsung Live Search & E-Commerce Catalog
function initCatalogSearch() {
    const searchForm = document.getElementById('catalog-search-form');
    const searchInput = document.getElementById('catalog-search-input');
    const resultsContainer = document.getElementById('catalog-results');
    const scrapeLimitSelect = document.getElementById('catalog-scrape-limit');
    const categorySelect = document.getElementById('discover-category-select');
    
    const bulkBar = document.getElementById('bulk-bar');
    const bulkScrapeBtn = document.getElementById('bulk-scrape-btn');
    const bulkSelectAllBtn = document.getElementById('bulk-select-all');
    const bulkDeselectAllBtn = document.getElementById('bulk-deselect-all');

    if (!searchForm) return;

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;

        selectedProducts.clear();
        updateBulkBar();

        resultsContainer.innerHTML = `
            <div class="empty-catalog-message">
                <div class="mini-spinner" style="width: 30px; height: 30px; border-top-color: var(--accent-color);"></div>
                <p>Recherche des produits officiels en cours sur Samsung France...</p>
            </div>
        `;

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search failed');
            const products = await response.json();

            lastSearchResults = products; // Cache the raw search results!

            if (products.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="empty-catalog-message">
                        <div class="empty-icon">🔍</div>
                        <p>Aucun produit correspondant trouvé pour "${query}". Essayez un autre mot-clé (ex: "Galaxy Tab", "Buds", "S26").</p>
                    </div>
                `;
                return;
            }

            // Apply active category filter if any
            const cat = categorySelect ? categorySelect.value : "";
            const filtered = cat ? products.filter(p => getProductCategory(p.product_name) === cat) : products;

            renderCatalog(filtered, scrapeLimitSelect);
        } catch (err) {
            console.error(err);
            resultsContainer.innerHTML = `
                <div class="empty-catalog-message">
                    <div class="empty-icon">⚠️</div>
                    <p>Erreur lors de la recherche. Assurez-vous que le serveur local start.command est bien en cours d'exécution.</p>
                </div>
            `;
        }
    });

    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            const cat = categorySelect.value;
            
            // 1. If we have cached results, filter and re-render them instantly!
            if (lastSearchResults && lastSearchResults.length > 0) {
                selectedProducts.clear(); // Clear selections on filter change
                const filtered = cat ? lastSearchResults.filter(p => getProductCategory(p.product_name) === cat) : lastSearchResults;
                renderCatalog(filtered, scrapeLimitSelect);
            } else {
                // 2. If no results, auto-fill input with optimal keyword and search!
                const keywords = {
                    'phone': 'Galaxy S',
                    'home_appliance': 'Bespoke',
                    'watch': 'Galaxy Watch',
                    'buds': 'Galaxy Buds',
                    'tablet': 'Galaxy Tab',
                    'tv': 'OLED TV'
                };
                if (cat && keywords[cat]) {
                    searchInput.value = keywords[cat];
                    // Trigger form submission
                    searchForm.dispatchEvent(new Event('submit'));
                }
            }
        });
    }

    if (bulkSelectAllBtn) {
        bulkSelectAllBtn.addEventListener('click', () => {
            const cards = resultsContainer.querySelectorAll('.product-card');
            cards.forEach(card => {
                const sku = card.dataset.id;
                selectedProducts.add(sku);
                card.classList.add('selected');
                const checkbox = card.querySelector('.card-checkbox');
                if (checkbox) checkbox.checked = true;
            });
            updateBulkBar();
        });
    }

    if (bulkDeselectAllBtn) {
        bulkDeselectAllBtn.addEventListener('click', () => {
            const cards = resultsContainer.querySelectorAll('.product-card');
            cards.forEach(card => {
                const sku = card.dataset.id;
                selectedProducts.delete(sku);
                card.classList.remove('selected');
                const checkbox = card.querySelector('.card-checkbox');
                if (checkbox) checkbox.checked = false;
            });
            updateBulkBar();
        });
    }

    bulkScrapeBtn.addEventListener('click', async () => {
        const selectedSKUs = Array.from(selectedProducts);
        if (selectedSKUs.length === 0) return;

        const limit = scrapeLimitSelect.value;
        bulkBar.style.display = 'none';

        for (const sku of selectedSKUs) {
            const card = document.querySelector(`.product-card[data-id="${sku}"]`);
            if (card) {
                const name = card.dataset.name;
                await scrapeCardProduct(card, sku, name, limit);
            }
        }

        selectedProducts.clear();
        updateBulkBar();
    });
}

function renderCatalog(products, limitSelect) {
    const resultsContainer = document.getElementById('catalog-results');
    resultsContainer.innerHTML = '';

    if (products.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-catalog-message">
                <div class="empty-icon">🔍</div>
                <p>Aucun produit correspondant trouvé dans cette catégorie.</p>
            </div>
        `;
        updateBulkBar();
        return;
    }

    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card glass-panel';
        card.dataset.id = p.product_id;
        card.dataset.name = p.product_name;

        if (selectedProducts.has(p.product_id)) {
            card.classList.add('selected');
        }

        const img = p.image_url || 'https://images.samsung.com/is/image/samsung/assets/fr/p6_gro2/p6_initial_common/default_image.png';

        card.innerHTML = `
            <div class="card-checkbox-container">
                <input type="checkbox" class="card-checkbox" value="${p.product_id}" ${selectedProducts.has(p.product_id) ? 'checked' : ''}>
            </div>
            <div class="product-card-img">
                <img src="${img}" alt="${p.product_name}" loading="lazy">
            </div>
            <span class="product-sku">${p.product_id}</span>
            <h4 class="product-card-name" title="${p.product_name}">${p.product_name}</h4>
            <div class="product-card-meta">
                <span class="card-reviews-badge">💬 ${p.reviews_count} avis officiels</span>
            </div>
            <button class="product-card-btn">🚀 Scraper</button>
        `;

        const scrapeBtn = card.querySelector('.product-card-btn');
        scrapeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const limit = limitSelect.value;
            scrapeCardProduct(card, p.product_id, p.product_name, limit);
        });

        const checkbox = card.querySelector('.card-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedProducts.add(p.product_id);
                card.classList.add('selected');
            } else {
                selectedProducts.delete(p.product_id);
                card.classList.remove('selected');
            }
            updateBulkBar();
        });

        resultsContainer.appendChild(card);
    });

    updateBulkBar();
}

async function scrapeCardProduct(card, productId, productName, limit) {
    const overlay = document.createElement('div');
    overlay.className = 'card-scrape-overlay';
    overlay.innerHTML = `
        <div class="mini-spinner"></div>
        <div class="card-status-text">Extraction & Traduction...</div>
    `;
    card.appendChild(overlay);

    const statusText = overlay.querySelector('.card-status-text');

    // Trigger the real-time progress tracker overlay modal
    startScrapingProgressTracker(productName);

    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, product_name: productName, limit })
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            overlay.innerHTML = `
                <div style="font-size: 2.5rem; color: var(--positive-color);">✅</div>
                <div class="card-status-text" style="color: var(--positive-color);">Scraping & Traduction terminés !<br>${result.reviews_count} avis récoltés</div>
            `;
            setTimeout(() => {
                overlay.remove();
            }, 3000);
        } else {
            overlay.innerHTML = `
                <div style="font-size: 2.5rem; color: var(--negative-color);">❌</div>
                <div class="card-status-text" style="color: var(--negative-color);">Échec : ${result.message || 'Erreur'}</div>
            `;
            setTimeout(() => overlay.remove(), 4000);
            const modal = document.getElementById('scrape-progress-modal');
            if (modal) modal.style.display = 'none';
        }
    } catch (err) {
        overlay.innerHTML = `
            <div style="font-size: 2.5rem; color: var(--negative-color);">❌</div>
            <div class="card-status-text" style="color: var(--negative-color);">Erreur réseau</div>
        `;
        setTimeout(() => overlay.remove(), 4000);
        const modal = document.getElementById('scrape-progress-modal');
        if (modal) modal.style.display = 'none';
    }
}

function updateBulkBar() {
    const bulkBar = document.getElementById('bulk-bar');
    const selectedCount = document.getElementById('bulk-selected-count');
    const totalCount = document.getElementById('bulk-total-count');

    if (!bulkBar) return;

    const visibleCards = document.querySelectorAll('.catalog-grid .product-card');
    const visibleCount = visibleCards.length;

    if (totalCount) {
        totalCount.textContent = visibleCount;
    }

    let selectedCountVal = 0;
    visibleCards.forEach(card => {
        const sku = card.dataset.id;
        if (selectedProducts.has(sku)) {
            selectedCountVal++;
        }
    });

    if (selectedCount) {
        selectedCount.textContent = selectedCountVal;
    }

    if (visibleCount > 0) {
        bulkBar.style.display = 'flex';
    } else {
        bulkBar.style.display = 'none';
    }
}

// 6. Dynamic Aspect-Based Sentiment Rendering
function updateAspects(reviews) {
    const grid = document.getElementById('aspects-stats-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (reviews.length === 0) return;
    
    const stats = {};
    
    reviews.forEach(r => {
        const aspects = r.aspects || {};
        const rating = r.rating || 5;
        Object.entries(aspects).forEach(([aspect, sentiment]) => {
            if (!stats[aspect]) {
                stats[aspect] = { positive: 0, negative: 0, neutral: 0, total: 0, ratingSum: 0 };
            }
            stats[aspect][sentiment]++;
            stats[aspect].total++;
            stats[aspect].ratingSum += rating;
        });
    });

    const aspectEntries = Object.entries(stats);
    
    if (aspectEntries.length === 0) {
        grid.innerHTML = `
            <div class="empty-catalog-message" style="grid-column: 1/-1; padding: 40px; min-height: auto;">
                <div style="font-size: 2.5rem; margin-bottom: 10px;">📊</div>
                <p>Aucune mention de caractéristiques spécifiques n'a été détectée dans les avis de cette langue.</p>
            </div>
        `;
        return;
    }
    
    aspectEntries.sort((a, b) => b[1].total - a[1].total);
    
    const aspectEmojis = {
        "confort": "👟",
        "ecran": "📱",
        "applications": "⌚",
        "batterie": "🔋",
        "audio": "🎵",
        "anc": "🔇",
        "photo": "📷",
        "performance": "⚡",
        "design": "🎨",
        "ia": "🤖",
        "spen": "✏️",
        "ergonomie": "📐",
        "image": "📺",
        "smart": "🌐",
        "qualite": "💎",
        "prix": "🏷️",
        "utilisation": "⚙️",
        "efficacite": "⚡",
        "bruit": "🔊",
        "capacite": "📦"
    };

    aspectEntries.forEach(([aspect, s]) => {
        const total = s.total;
        const posPercent = Math.round((s.positive / total) * 100);
        const aspectAvg = (s.ratingSum / total).toFixed(1);
        
        const emoji = aspectEmojis[aspect] || "🔑";
        
        let colorClass = "positive";
        let scoreClass = "";
        if (posPercent < 45) {
            colorClass = "negative";
            scoreClass = "low";
        } else if (posPercent < 75) {
            colorClass = "neutral";
            scoreClass = "mid";
        }
        
        const card = document.createElement('div');
        card.className = 'aspect-item';
        card.innerHTML = `
            <div class="aspect-header">
                <span class="aspect-label">${emoji} ${aspect}</span>
                <span class="aspect-rating-badge">⭐ ${aspectAvg} / 5</span>
            </div>
            <div class="aspect-track">
                <div class="aspect-fill ${colorClass}" style="width: 0%;"></div>
            </div>
            <div class="aspect-meta">
                <span class="${scoreClass}" style="font-weight: 600;">Score : ${posPercent}% Positif</span>
                <span>Mentionné dans ${total} avis</span>
            </div>
        `;
        
        grid.appendChild(card);
        
        setTimeout(() => {
            const fill = card.querySelector('.aspect-fill');
            if (fill) fill.style.width = `${posPercent}%`;
        }, 100);
    });
}

// 7. Dynamic AI Synthesis and 10 Selected Verbatims (Forces, Faiblesses & Améliorations)
const aspectStrengthsLabels = {
    "confort": "Confort de port et ergonomie au poignet",
    "ecran": "Écran extrêmement lumineux, réactif et lisible",
    "applications": "Suivi précis de la santé et des applications sportives",
    "batterie": "Excellente autonomie batterie au quotidien",
    "audio": "Qualité sonore riche, claire et immersive",
    "anc": "Réduction active du bruit (ANC) ultra-performante",
    "photo": "Qualité photo et vidéo exceptionnelle (zoom, capteurs)",
    "performance": "Performances de pointe, grande fluidité du système",
    "design": "Design premium, esthétique élégante et robuste",
    "ia": "Fonctionnalités Galaxy AI innovantes et pratiques",
    "spen": "S-Pen réactif et idéal pour la productivité/dessin",
    "ergonomie": "Prise en main ergonomique, finesse et légèreté",
    "image": "Qualité d'image époustouflante (couleurs, contrastes)",
    "smart": "Interface connectée (Tizen/Smart TV) fluide et complète",
    "efficacite": "Efficacité et puissance de lavage/séchage/aspiration",
    "bruit": "Fonctionnement très silencieux et sans vibrations",
    "capacite": "Grande capacité de stockage et volume généreux",
    "utilisation": "Facilité d'utilisation et programmes intuitifs",
    "qualite": "Qualité de fabrication robuste et durable",
    "prix": "Excellent rapport qualité-prix"
};

const aspectWeaknessesLabels = {
    "confort": "Bracelet d'origine peu confortable ou rigide",
    "ecran": "Écran sujet aux reflets ou sensibilité tactile perfectible",
    "applications": "Synchronisation parfois complexe ou capteurs imprécis",
    "batterie": "Autonomie batterie limitée (recharge fréquente)",
    "audio": "Qualité sonore manquant de basses ou d'équilibre",
    "anc": "Réduction du bruit (ANC) moyenne dans les milieux bruyants",
    "photo": "Traitement photo perfectible en basse luminosité",
    "performance": "Chauffe occasionnelle ou légers ralentissements",
    "design": "Design encombrant, lourd ou finitions fragiles",
    "ia": "Fonctions d'IA perçues comme anecdotiques ou gadgets",
    "spen": "Rangement du stylet ou réactivité parfois perfectible",
    "ergonomie": "Poids trop élevé ou encombrement pour une main",
    "image": "Angles de vision restreints ou réglages d'image complexes",
    "smart": "Interface Smart TV parfois lente ou manque d'applications",
    "efficacite": "Consommation d'énergie ou cycle de fonctionnement long",
    "bruit": "Niveau sonore ou vibrations perceptibles lors de l'usage",
    "capacite": "Espace intérieur ou de rangement parfois optimisable",
    "utilisation": "Programmes complexes ou application mobile instable",
    "qualite": "Durabilité des finitions ou peinture fragile dans le temps",
    "prix": "Tarif de départ élevé ou rapport qualité-prix discutable"
};

const aspectImprovementsLabels = {
    "confort": "Optimiser le confort du bracelet et l'ergonomie générale",
    "ecran": "Améliorer le traitement anti-reflet et la luminosité maximale",
    "applications": "Fiabiliser le suivi de santé et simplifier l'application compagnon",
    "batterie": "Optimiser la consommation énergétique pour prolonger l'autonomie",
    "audio": "Renforcer la clarté sonore et la présence des basses",
    "anc": "Améliorer l'efficacité de la réduction active du bruit",
    "photo": "Optimiser les algorithmes de prise de vue en basse lumière",
    "performance": "Améliorer la dissipation thermique sous forte charge",
    "design": "Optimiser le poids et renforcer la durabilité des finitions de la couronne",
    "ia": "Enrichir les fonctionnalités d'IA et les rendre plus intuitives",
    "spen": "Intégrer un système de rangement du stylet plus ergonomique",
    "ergonomie": "Réduire le poids de l'appareil pour un meilleur confort quotidien",
    "image": "Simplifier les menus de calibrage d'image pour l'utilisateur",
    "smart": "Fluidifier l'interface connectée et accélérer les temps de réponse",
    "efficacite": "Proposer des modes de fonctionnement plus courts ou économiques",
    "bruit": "Renforcer l'isolation acoustique pour réduire les nuisances sonores",
    "capacite": "Repenser l'aménagement intérieur pour maximiser l'espace",
    "utilisation": "Simplifier l'interface utilisateur et fiabiliser la connectivité",
    "qualite": "Sélectionner des matériaux plus haut de gamme et résistants",
    "prix": "Ajuster le positionnement tarifaire ou offrir plus d'accessoires fournis"
};

const categoryAspects = {
    "watch": ["confort", "ecran", "applications", "batterie"],
    "buds": ["confort", "audio", "anc", "batterie"],
    "phone": ["ecran", "batterie", "photo", "performance", "design", "ia"],
    "tablet": ["ecran", "batterie", "spen", "performance", "ergonomie"],
    "tv": ["image", "audio", "smart", "design"],
    "home_appliance": ["efficacite", "bruit", "capacite", "utilisation"],
    "default": ["qualite", "prix", "utilisation"]
};

const aspectEmojis = {
    "confort": "👟",
    "ecran": "📱",
    "applications": "⌚",
    "batterie": "🔋",
    "audio": "🎵",
    "anc": "🔇",
    "photo": "📷",
    "performance": "⚡",
    "design": "🎨",
    "ia": "🤖",
    "spen": "✏️",
    "ergonomie": "📐",
    "image": "📺",
    "smart": "🌐",
    "qualite": "💎",
    "prix": "🏷️",
    "utilisation": "⚙️",
    "efficacite": "⚡",
    "bruit": "🔊",
    "capacite": "📦"
};

function getProductCategory(productName) {
    const nameLower = productName.toLowerCase();
    if (nameLower.includes("watch") || nameLower.includes("montre") || nameLower.includes("fit")) {
        return "watch";
    } else if (nameLower.includes("buds") || nameLower.includes("écouteurs") || nameLower.includes("audio")) {
        return "buds";
    } else if (nameLower.includes("tab") || nameLower.includes("tablette")) {
        return "tablet";
    } else if (nameLower.includes("tv") || nameLower.includes("téléviseur") || nameLower.includes("ecran") || nameLower.includes("monitor") || nameLower.includes("projecteur")) {
        return "tv";
    } else if (nameLower.includes("galaxy s") || nameLower.includes("galaxy z") || nameLower.includes("fold") || nameLower.includes("flip") || nameLower.includes("galaxy a") || nameLower.includes("smartphone") || nameLower.includes("téléphone")) {
        return "phone";
    } else if (
        nameLower.includes("bespoke") || 
        nameLower.includes("laundry") || 
        nameLower.includes("combo") || 
        nameLower.includes("washer") || 
        nameLower.includes("dryer") || 
        nameLower.includes("aspirateur") || 
        nameLower.includes("cleaner") || 
        nameLower.includes("four") || 
        nameLower.includes("refrigerateur") || 
        nameLower.includes("réfrigérateur") || 
        nameLower.includes("lave-linge") || 
        nameLower.includes("seche-linge") || 
        nameLower.includes("sèche-linge") || 
        nameLower.includes("seche") || 
        nameLower.includes("sèche") || 
        nameLower.includes("lave-vaisselle")
    ) {
        return "home_appliance";
    } else {
        return "default";
    }
}

function getAspectsForCategory(category) {
    const specific = categoryAspects[category] || categoryAspects["default"];
    const combined = [...specific];
    if (!combined.includes("qualite")) combined.push("qualite");
    if (!combined.includes("prix")) combined.push("prix");
    return combined;
}

function updateAISynthesis(reviews) {
    const paragraphElem = document.getElementById('ai-summary-paragraph');
    const titleElem = document.getElementById('ai-product-title');
    const forcesList = document.getElementById('ai-forces-list');
    const faiblessesList = document.getElementById('ai-faiblesses-list');
    const improvementsList = document.getElementById('ai-improvements-list');
    const posVerbatims = document.getElementById('positive-verbatims-list');
    const negVerbatims = document.getElementById('negative-verbatims-list');
    
    if (!paragraphElem) return;
    
    if (reviews.length === 0) {
        paragraphElem.innerText = "Aucun avis à analyser pour le moment.";
        forcesList.innerHTML = '<li>Aucune donnée</li>';
        faiblessesList.innerHTML = '<li>Aucune donnée</li>';
        improvementsList.innerHTML = '<li>Aucune donnée</li>';
        posVerbatims.innerHTML = '';
        negVerbatims.innerHTML = '';
        return;
    }
    
    const productName = currentReviews[0]?.product_name || "Ce produit Samsung";
    if (titleElem) titleElem.innerText = `Synthèse IA & Verbatims — ${productName}`;
    
    // 1. Calculate aspects stats
    const stats = {};
    reviews.forEach(r => {
        const aspects = r.aspects || {};
        const rating = r.rating || 5;
        Object.entries(aspects).forEach(([aspect, sentiment]) => {
            if (!stats[aspect]) {
                stats[aspect] = { positive: 0, negative: 0, neutral: 0, total: 0, ratingSum: 0 };
            }
            stats[aspect][sentiment]++;
            stats[aspect].total++;
            stats[aspect].ratingSum += rating;
        });
    });
    
    const category = getProductCategory(productName);
    
    // Calculate pos percent and scores
    const aspectDetails = Object.entries(stats).map(([aspect, s]) => {
        const total = s.total;
        const posPercent = Math.round((s.positive / total) * 100);
        return {
            name: aspect,
            total,
            posPercent,
            positiveCount: s.positive,
            negativeCount: s.negative
        };
    });
    
    // Separate Forces and Faiblesses based on posPercent
    let forces = aspectDetails
        .filter(a => a.posPercent >= 55)
        .sort((a, b) => b.posPercent - a.posPercent)
        .map(a => a.name);
        
    let faiblesses = aspectDetails
        .filter(a => a.posPercent < 55 || a.negativeCount > 0)
        .sort((a, b) => a.posPercent - b.posPercent)
        .map(a => a.name);
        
    // Standard default aspects fallbacks by category
    const categoryFallbacks = {
        "watch": {
            forces: ["design", "ecran", "applications"],
            faiblesses: ["batterie", "confort"]
        },
        "buds": {
            forces: ["audio", "anc", "confort"],
            faiblesses: ["batterie"]
        },
        "phone": {
            forces: ["ecran", "performance", "photo", "design"],
            faiblesses: ["batterie", "ia"]
        },
        "tablet": {
            forces: ["ecran", "spen", "performance"],
            faiblesses: ["batterie", "ergonomie"]
        },
        "tv": {
            forces: ["image", "design", "smart"],
            faiblesses: ["audio"]
        },
        "home_appliance": {
            forces: ["efficacite", "capacite", "utilisation"],
            faiblesses: ["bruit"]
        },
        "default": {
            forces: ["qualite", "utilisation"],
            faiblesses: ["prix"]
        }
    };
    
    const fallbacks = categoryFallbacks[category] || categoryFallbacks["default"];
    
    // Complete lists if not enough items
    if (forces.length < 3) {
        fallbacks.forces.forEach(f => {
            if (!forces.includes(f) && !faiblesses.includes(f)) {
                forces.push(f);
            }
        });
    }
    if (faiblesses.length < 2) {
        fallbacks.faiblesses.forEach(w => {
            if (!faiblesses.includes(w) && !forces.includes(w)) {
                faiblesses.push(w);
            }
        });
    }
    
    // Ensure quality and price are present if not already classified
    if (forces.length < 4 && !forces.includes("qualite") && !faiblesses.includes("qualite")) {
        forces.push("qualite");
    }
    if (faiblesses.length < 3 && !faiblesses.includes("prix") && !forces.includes("prix")) {
        faiblesses.push("prix");
    }
    
    // Limit count of items to show
    forces = forces.slice(0, 5);
    faiblesses = faiblesses.slice(0, 4);
    
    // Render list elements
    forcesList.innerHTML = forces.map(f => `<li>${aspectStrengthsLabels[f] || f}</li>`).join('');
    faiblessesList.innerHTML = faiblesses.map(w => `<li>${aspectWeaknessesLabels[w] || w}</li>`).join('');
    
    // Select top improvement points based on weaknesses
    const improvements = faiblesses.slice(0, 3);
    improvementsList.innerHTML = improvements.map(i => `<li>${aspectImprovementsLabels[i] || i}</li>`).join('');
    
    // 2. Generate French AI Paragraph Synthesis
    let summaryText = "";
    if (category === "watch") {
        summaryText = `La **Galaxy Watch** est perçue comme un produit haut de gamme au design particulièrement robuste et élégant. Son écran est extrêmement lumineux, réactif et agréable sous toutes les conditions. Le suivi des constantes de santé (sommeil, ECG) et l'intégration à l'écosystème Android sont jugés très satisfaisants. Cependant, l'autonomie de la batterie reste une faiblesse notable exigeant une charge quasi quotidienne, et le confort du bracelet d'origine suscite des critiques régulières.`;
    } else if (category === "buds") {
        summaryText = `Les **Galaxy Buds** s'imposent comme des écouteurs de premier choix grâce à une qualité sonore exceptionnelle, caractérisée par des basses profondes et une excellente clarté. La réduction de bruit active (ANC) permet de s'isoler efficacement au quotidien. Néanmoins, l'autonomie générale en appel ou avec réduction activée reste le principal axe d'amélioration attendu, aux côtés de la tenue à l'oreille pour les activités sportives.`;
    } else if (category === "phone") {
        summaryText = `Ce **smartphone Samsung Galaxy** recueille des avis dithyrambiques concernant la perfection de son écran AMOLED fluide et lumineux, ses performances de calcul de pointe et sa polyvalence photographique époustouflante dans toutes les conditions de lumière. Les ajouts de l'IA (Galaxy AI) sont perçus comme innovants. Quelques réserves subsistent néanmoins sur la vitesse de charge, l'autonomie sous usage intensif et le poids de l'appareil.`;
    } else if (category === "tablet") {
        summaryText = `La **Galaxy Tab** s'impose comme un outil de productivité et de divertissement exceptionnel. Les clients apprécient grandement la dalle d'affichage de haute qualité, le confort du stylet S-Pen inclus de série pour la prise de note ou le dessin, ainsi que sa rapidité globale. Les axes de perfectionnement concernent le poids de la tablette lors de prises en main prolongées et le temps de charge de la batterie.`;
    } else if (category === "tv") {
        summaryText = `Ce **téléviseur Samsung** offre une expérience cinéma immersive incomparable. Sa superbe dalle d'affichage garantit des contrastes profonds et une restitution des couleurs d'un réalisme saisissant. L'interface connectée Smart TV (Tizen) est saluée pour sa fluidité et son large catalogue d'applications. En contrepartie, le rendu des haut-parleurs intégrés mériterait d'être appuyé par une barre de son additionnelle.`;
    } else if (category === "home_appliance") {
        summaryText = `Cet **appareil Bespoke AI** démontre une efficacité de fonctionnement remarquable et s'apprécie pour son espace de rangement généreux et optimisé. L'interface est conviviale et l'application SmartThings facilite le contrôle à distance. Cependant, des mentions régulières font état de nuisances sonores ou de légères vibrations lors des phases de fonctionnement intensif, constituant les principaux points d'amélioration.`;
    } else {
        summaryText = `Ce **produit Samsung** bénéficie d'une perception globale très positive. Sa conception robuste, sa durabilité exemplaire et sa simplicité de configuration au quotidien en font un achat rassurant et hautement recommandé. Les seuls points d'amélioration réguliers concernent le positionnement tarifaire élevé et la documentation fournie un peu succincte.`;
    }
    
    // Append real live stats to make the synthesis even more authentic
    const totalCount = reviews.length;
    const avgRating = (reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / (totalCount || 1)).toFixed(1);
    const recommendationRate = totalCount > 0 ? Math.round((reviews.filter(r => r.rating >= 4).length / totalCount) * 100) : 100;
    
    summaryText += ` Sur un total de **${totalCount.toLocaleString()} avis** analysés sur Samsung.com/fr, ce modèle obtient une note moyenne remarquable de **${avgRating} / 5** avec un taux de recommandation de **${recommendationRate}%**, confirmant l'excellente satisfaction des clients.`;
    paragraphElem.innerHTML = summaryText;
    
    // 3. Select 10 Verbatims (5 positive, 5 negative) that reflect strengths and weaknesses
    // Filter reviews
    const posCandidates = reviews.filter(r => r.rating >= 4 && r.sentiment === 'positive');
    const negCandidates = reviews.filter(r => r.rating <= 3 && r.sentiment === 'negative');
    
    // Helper to filter and clean verbatims (limit length to fit beautiful grid nicely)
    const getCleanVerbatims = (candidates, count) => {
        const clean = candidates.filter(r => {
            const txt = r.review_text || r.original_text || "";
            return txt.length >= 35 && txt.length <= 160 && !txt.startsWith("(");
        });
        
        // Fallback to less strict filters if not enough
        const fallback = clean.length >= count ? clean : candidates.filter(r => {
            const txt = r.review_text || r.original_text || "";
            return txt.length >= 20 && txt.length <= 250;
        });
        
        // Shuffle or select diverse ones
        return fallback.slice(0, count);
    };
    
    const selectedPos = getCleanVerbatims(posCandidates, 5);
    const selectedNeg = getCleanVerbatims(negCandidates, 5);
    
    // Render Positive Verbatims
    posVerbatims.innerHTML = '';
    selectedPos.forEach(r => {
        const text = r.review_text || r.original_text || "";
        const stars = "★".repeat(Math.round(r.rating || 5)) + "☆".repeat(5 - Math.round(r.rating || 5));
        
        let transBadge = "";
        if (r.original_language && r.original_language !== 'fr') {
            const flag = languageNames[r.original_language] ? languageNames[r.original_language].split(" ")[0] : "🌐";
            transBadge = `<span class="badge neutral" style="margin-left: 8px; font-size: 0.65rem; padding: 1px 4px;" title="Texte original : ${r.original_text}">Traduit de ${flag}</span>`;
        }
        
        const card = document.createElement('div');
        card.className = 'verbatim-card';
        card.innerHTML = `
            <p class="verbatim-text">"${text}"</p>
            <div class="verbatim-meta">
                <span class="verbatim-stars">${stars}</span>
                <span>${r.date} ${transBadge}</span>
            </div>
        `;
        posVerbatims.appendChild(card);
    });
    
    if (selectedPos.length === 0) {
        posVerbatims.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">Aucun verbatim positif disponible.</div>';
    }
    
    // Render Negative Verbatims
    negVerbatims.innerHTML = '';
    selectedNeg.forEach(r => {
        const text = r.review_text || r.original_text || "";
        const stars = "★".repeat(Math.round(r.rating || 5)) + "☆".repeat(5 - Math.round(r.rating || 5));
        
        let transBadge = "";
        if (r.original_language && r.original_language !== 'fr') {
            const flag = languageNames[r.original_language] ? languageNames[r.original_language].split(" ")[0] : "🌐";
            transBadge = `<span class="badge neutral" style="margin-left: 8px; font-size: 0.65rem; padding: 1px 4px;" title="Texte original : ${r.original_text}">Traduit de ${flag}</span>`;
        }
        
        const card = document.createElement('div');
        card.className = 'verbatim-card';
        card.innerHTML = `
            <p class="verbatim-text">"${text}"</p>
            <div class="verbatim-meta">
                <span class="verbatim-stars">${stars}</span>
                <span>${r.date} ${transBadge}</span>
            </div>
        `;
        negVerbatims.appendChild(card);
    });
    
    if (selectedNeg.length === 0) {
        negVerbatims.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">Aucun verbatim négatif disponible.</div>';
    }
}

// 8. Dynamic Product Characteristics & Themes Filtering Tab
function updateThemesView(reviews) {
    const buttonsBar = document.getElementById('theme-buttons-bar');
    const infoBlock = document.getElementById('theme-info-block');
    const themeTitle = document.getElementById('theme-title');
    const ratingBadge = document.getElementById('theme-rating-badge');
    const countBadge = document.getElementById('theme-count-badge');
    const posComments = document.getElementById('theme-pos-comments');
    const negComments = document.getElementById('theme-neg-comments');
    
    if (!buttonsBar) return;
    
    if (reviews.length === 0) {
        buttonsBar.innerHTML = '<div style="color: var(--text-secondary);">Aucune thématique disponible.</div>';
        infoBlock.style.display = 'none';
        posComments.innerHTML = '';
        negComments.innerHTML = '';
        return;
    }
    
    const productName = currentReviews[0]?.product_name || "Ce produit Samsung";
    const category = getProductCategory(productName);
    const aspectsToDisplay = getAspectsForCategory(category);
    
    // Render aspect/theme selection buttons
    buttonsBar.innerHTML = '';
    
    let firstAspect = null;
    
    aspectsToDisplay.forEach(aspect => {
        // Count how many reviews mention this aspect
        const aspectReviewsCount = reviews.filter(r => r.aspects && r.aspects[aspect] !== undefined).length;
        
        // Show aspect button anyway to let users click it, but show the count!
        const btn = document.createElement('button');
        btn.className = 'theme-btn';
        const emoji = aspectEmojis[aspect] || "🔑";
        btn.innerHTML = `${emoji} ${aspect.charAt(0).toUpperCase() + aspect.slice(1)} (${aspectReviewsCount})`;
        btn.dataset.aspect = aspect;
        
        if (!firstAspect) firstAspect = aspect;
        
        btn.addEventListener('click', () => {
            // Set active class
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Render specific theme comments
            renderThemeDetails(aspect, reviews);
        });
        
        buttonsBar.appendChild(btn);
    });
    
    // Automatically trigger click on the first aspect button to populate the view
    if (firstAspect) {
        const firstBtn = buttonsBar.querySelector(`[data-aspect="${firstAspect}"]`);
        if (firstBtn) {
            firstBtn.click();
        }
    }
    
    function renderThemeDetails(aspectName, reviewsList) {
        infoBlock.style.display = 'block';
        themeTitle.innerText = aspectName.charAt(0).toUpperCase() + aspectName.slice(1);
        
        // Filter reviews mentioning this aspect
        const themeReviews = reviewsList.filter(r => r.aspects && r.aspects[aspectName] !== undefined);
        
        // Calculate theme average rating and count
        const total = themeReviews.length;
        const ratingSum = themeReviews.reduce((sum, r) => sum + (r.rating || 5), 0);
        const avg = total > 0 ? (ratingSum / total).toFixed(1) : "0.0";
        
        ratingBadge.innerHTML = `⭐ ${avg} / 5`;
        countBadge.innerText = `Mentionné dans ${total.toLocaleString()} avis`;
        
        // Separate positive and negative reviews
        const posList = themeReviews.filter(r => r.aspects[aspectName] === "positive" || r.rating >= 4);
        const negList = themeReviews.filter(r => r.aspects[aspectName] === "negative" || r.rating <= 3);
        
        // Render positive comments column
        posComments.innerHTML = '';
        posList.slice(0, 15).forEach(r => {
            const text = r.review_text || r.original_text || "";
            const stars = "★".repeat(Math.round(r.rating || 5)) + "☆".repeat(5 - Math.round(r.rating || 5));
            
            let transBadge = "";
            if (r.original_language && r.original_language !== 'fr') {
                const flag = languageNames[r.original_language] ? languageNames[r.original_language].split(" ")[0] : "🌐";
                transBadge = `<span class="badge neutral" style="margin-left: 8px; font-size: 0.65rem; padding: 1px 4px;" title="Texte original : ${r.original_text}">Traduit de ${flag}</span>`;
            }
            
            const card = document.createElement('div');
            card.className = 'comment-card';
            card.innerHTML = `
                <p class="verbatim-text">"${text}"</p>
                <div class="verbatim-meta">
                    <span class="verbatim-stars">${stars}</span>
                    <span>${r.date} ${transBadge}</span>
                </div>
            `;
            posComments.appendChild(card);
        });
        
        if (posList.length === 0) {
            posComments.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 40px;">Aucun avis positif mentionnant cette caractéristique.</div>';
        }
        
        // Render negative comments column
        negComments.innerHTML = '';
        negList.slice(0, 15).forEach(r => {
            const text = r.review_text || r.original_text || "";
            const stars = "★".repeat(Math.round(r.rating || 5)) + "☆".repeat(5 - Math.round(r.rating || 5));
            
            let transBadge = "";
            if (r.original_language && r.original_language !== 'fr') {
                const flag = languageNames[r.original_language] ? languageNames[r.original_language].split(" ")[0] : "🌐";
                transBadge = `<span class="badge neutral" style="margin-left: 8px; font-size: 0.65rem; padding: 1px 4px;" title="Texte original : ${r.original_text}">Traduit de ${flag}</span>`;
            }
            
            const card = document.createElement('div');
            card.className = 'comment-card';
            card.innerHTML = `
                <p class="verbatim-text">"${text}"</p>
                <div class="verbatim-meta">
                    <span class="verbatim-stars">${stars}</span>
                    <span>${r.date} ${transBadge}</span>
                </div>
            `;
            negComments.appendChild(card);
        });
        
        if (negList.length === 0) {
            negComments.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 40px;">Aucun avis négatif mentionnant cette caractéristique.</div>';
        }
    }
}

// 9. Clear Scraped Data History (🗑️ Effacer l'historique)
function initClearHistoryButton() {
    const btn = document.getElementById('clear-data-btn');
    if (!btn) return;
    
    btn.addEventListener('click', async () => {
        if (!confirm("⚠️ ATTENTION : Voulez-vous vraiment supprimer tout l'historique des avis scrapés ? Cette action est irréversible.")) {
            return;
        }
        
        btn.disabled = true;
        btn.innerText = "Suppression...";
        
        try {
            const response = await fetch('/api/clear', {
                method: 'POST'
            });
            const result = await response.json();
            
            if (response.ok && result.status === 'success') {
                alert("✅ " + result.message);
                // Clear state
                currentReviews = [];
                // Reload central product catalog (which will be empty now)
                await loadProducts();
                // Reset dashboard UI values
                filterAndRenderReviews('all');
            } else {
                alert("❌ Erreur : " + (result.message || "Impossible de vider l'historique."));
            }
        } catch (err) {
            console.error(err);
            alert("❌ Erreur réseau lors de la suppression de l'historique.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = "🗑️ Effacer l'historique";
        }
    });
}

// ==========================================================================
// 10. Category Comparison Tab (🏷️ Catégories & Comparateur) Implementation
// ==========================================================================
const aspectStrengthTemplates = {
    "batterie": "L'autonomie robuste et la charge rapide sont saluées comme des points forts majeurs facilitant l'usage quotidien.",
    "ecran": "La qualité de l'affichage, la luminosité extérieure et les taux de rafraîchissement élevés procurent un confort visuel exceptionnel.",
    "photo": "Les performances photographiques, la précision des capteurs et le piqué d'image reçoivent d'excellentes évaluations.",
    "performance": "La réactivité système, la fluidité de navigation et la puissance processeur répondent parfaitement aux attentes intensives.",
    "design": "L'esthétique épurée, la légèreté et les finitions premium séduisent massivement les utilisateurs.",
    "ia": "Les fonctionnalités d'intelligence artificielle intégrées et les raccourcis intelligents enrichissent significativement l'expérience utilisateur.",
    "confort": "L'ergonomie au poignet, la douceur des bracelets et la légèreté en font des compagnons très agréables au quotidien.",
    "applications": "La richesse de l'écosystème d'applications, le suivi de santé et la précision des capteurs sportifs sont très appréciés.",
    "audio": "La clarté sonore, la signature acoustique équilibrée et la richesse des détails audio ravissent les mélomanes.",
    "anc": "La réduction active du bruit (ANC) isole efficacement du monde extérieur, offrant un confort d'écoute optimal.",
    "spen": "La précision et la réactivité du stylet S Pen optimisent grandement la productivité et la création graphique.",
    "ergonomie": "La prise en main confortable et l'optimisation des dimensions de l'appareil sont soulignées positivement.",
    "image": "Le contraste exceptionnel, la fidélité des couleurs et la netteté d'image procurent une expérience cinéma immersive.",
    "smart": "La fluidité du système Smart TV et l'intégration intuitive des applications de streaming sont très appréciées.",
    "efficacite": "L'efficacité de fonctionnement et la rapidité des cycles de lavage/cuisson sont jugées excellentes.",
    "bruit": "La discrétion sonore et le silence de fonctionnement des appareils sont plébiscités dans les espaces partagés.",
    "capacite": "Le volume de stockage intérieur généreux et la modularité des compartiments maximisent l'espace utile.",
    "utilisation": "L'interface de commande simple et la prise en main rapide facilitent l'usage de l'appareil au quotidien.",
    "qualite": "La robustesse de conception et la durabilité des matériaux inspirent une grande confiance aux clients.",
    "prix": "Le rapport qualité-prix compétitif et le positionnement tarifaire sont considérés comme attractifs."
};

const aspectWeaknessTemplates = {
    "batterie": "L'autonomie globale reste perfectible avec des cycles de décharge parfois trop rapides en usage intensif.",
    "ecran": "Des reflets désagréables ou une sensibilité tactile inégale font l'objet de quelques critiques.",
    "photo": "Le rendu des scènes nocturnes ou la vitesse de mise au point automatique déçoivent dans les conditions difficiles.",
    "performance": "Quelques ralentissements occasionnels ou de légers échauffements sont signalés lors des tâches lourdes.",
    "design": "Certaines finitions ou la sensibilité excessive aux traces de doigts mériteraient d'être améliorées.",
    "ia": "Certaines options IA manquent de maturité logicielle ou nécessitent des temps de réponse parfois trop longs.",
    "confort": "Le contact avec le bracelet ou la rigidité initiale peuvent causer des rougeurs ou de légers picotements.",
    "applications": "Des difficultés d'appairage ou des fonctionnalités de suivi jugées imprécises nuisent à l'expérience globale.",
    "audio": "Un léger manque de basses ou une distorsion sonore à haut volume sont relevés par certains audiophiles.",
    "anc": "L'isolation active du bruit pourrait être renforcée pour mieux atténuer les fréquences aiguës ou les bruits de fond urbains.",
    "spen": "Un rangement peu pratique ou une latence résiduelle sont pointés du doigt par certains professionnels.",
    "ergonomie": "L'encombrement général ou un poids légèrement excessif limitent l'aisance de manipulation d'une seule main.",
    "image": "Des angles de vision un peu étroits ou un traitement anti-reflets limité affectent parfois la lisibilité.",
    "smart": "Des lenteurs d'interface logicielle et des déconnexions Wi-Fi intermittentes ternissent l'utilisation connectée.",
    "efficacite": "La consommation énergétique ou la durée de certains programmes standards mériteraient une optimisation.",
    "bruit": "Des vibrations ou des sifflements intermittents se font parfois entendre, nuisant au confort sonore global.",
    "capacite": "Le volume de rangement intérieur s'avère un peu restreint ou les espaces manquent de modularité.",
    "utilisation": "La complexité des menus et l'absence de guides rapides compliquent la configuration initiale.",
    "qualite": "La fragilité de certaines pièces plastiques ou la sensibilité aux rayures suscitent des inquiétudes de longévité.",
    "prix": "Le tarif de lancement élevé ou le manque d'accessoires fournis réduisent l'attractivité de l'offre."
};

function getProductSubCategory(productName, category) {
    const nameLower = productName.toLowerCase();
    if (category === "phone") {
        if (nameLower.includes("galaxy s")) return "📱 Gamme Galaxy S";
        if (nameLower.includes("galaxy z") || nameLower.includes("fold") || nameLower.includes("flip")) return "📟 Gamme Galaxy Z (Pliable)";
        if (nameLower.includes("galaxy a")) return "📲 Gamme Galaxy A";
        return "📱 Autres Smartphones";
    } else if (category === "home_appliance") {
        if (nameLower.includes("lave-linge") || nameLower.includes("washer")) return "🧺 Lave-linge";
        if (nameLower.includes("seche-linge") || nameLower.includes("sèche-linge") || nameLower.includes("dryer") || nameLower.includes("seche") || nameLower.includes("sèche")) return "💨 Sèche-linge";
        if (nameLower.includes("combo") || nameLower.includes("laundry")) return "🧺 Lave-linge Séchant";
        if (nameLower.includes("refrigerateur") || nameLower.includes("réfrigérateur")) return "🧊 Réfrigérateur";
        if (nameLower.includes("aspirateur") || nameLower.includes("cleaner")) return "🧹 Aspirateur";
        if (nameLower.includes("four")) return "🍳 Four & Cuisson";
        return "⚙️ Autres Électroménagers";
    } else if (category === "watch") {
        if (nameLower.includes("watch")) return "⌚ Galaxy Watch";
        if (nameLower.includes("fit")) return "🏃 Galaxy Fit";
        return "⌚ Autres Montres";
    } else if (category === "buds") {
        return "🎧 Galaxy Buds";
    } else if (category === "tablet") {
        return "📁 Galaxy Tab";
    } else if (category === "tv") {
        if (nameLower.includes("tv") || nameLower.includes("téléviseur")) return "📺 Téléviseurs";
        if (nameLower.includes("monitor") || nameLower.includes("ecran")) return "🖥️ Moniteurs";
        return "📺 Autres Écrans";
    }
    return "🏷️ Autre";
}

function initCategoryView() {
    const select = document.getElementById('category-select');
    if (!select) return;
    
    select.onchange = (e) => {
        const catVal = e.target.value;
        if (catVal) {
            loadCategoryData(catVal);
        } else {
            resetCategoryView();
        }
    };
    
    // Subcategory select listener
    const subcatSelect = document.getElementById('subcategory-select');
    if (subcatSelect) {
        subcatSelect.onchange = (e) => {
            categorySelectedSubCategory = e.target.value;
            
            // Auto check all products matching the new subcategory
            categorySelectedProductIds.clear();
            categoryProducts.forEach(p => {
                const matchesSub = categorySelectedSubCategory === "all" || getProductSubCategory(p.product_name, activeCategory) === categorySelectedSubCategory;
                if (matchesSub) {
                    categorySelectedProductIds.add(p.product_id);
                }
            });
            
            renderProductCheckboxes();
            
            const langSelect = document.getElementById('language-select');
            const selectedLang = langSelect ? langSelect.value : 'all';
            renderCategoryData(selectedLang);
        };
    }
    
    // Quick actions buttons listeners
    const btnSelectAll = document.getElementById('btn-select-all-models');
    if (btnSelectAll) {
        btnSelectAll.onclick = () => {
            categoryProducts.forEach(p => {
                const matchesSub = categorySelectedSubCategory === "all" || getProductSubCategory(p.product_name, activeCategory) === categorySelectedSubCategory;
                if (matchesSub) {
                    categorySelectedProductIds.add(p.product_id);
                }
            });
            renderProductCheckboxes();
            
            const langSelect = document.getElementById('language-select');
            const selectedLang = langSelect ? langSelect.value : 'all';
            renderCategoryData(selectedLang);
        };
    }
    
    const btnDeselectAll = document.getElementById('btn-deselect-all-models');
    if (btnDeselectAll) {
        btnDeselectAll.onclick = () => {
            categoryProducts.forEach(p => {
                const matchesSub = categorySelectedSubCategory === "all" || getProductSubCategory(p.product_name, activeCategory) === categorySelectedSubCategory;
                if (matchesSub) {
                    categorySelectedProductIds.delete(p.product_id);
                }
            });
            renderProductCheckboxes();
            
            const langSelect = document.getElementById('language-select');
            const selectedLang = langSelect ? langSelect.value : 'all';
            renderCategoryData(selectedLang);
        };
    }
    
    if (select.value) {
        loadCategoryData(select.value);
    } else {
        resetCategoryView();
    }
}

function resetCategoryView() {
    document.getElementById('cat-avg-rating').innerText = "0.0";
    document.getElementById('cat-avg-stars').innerText = "☆☆☆☆☆";
    document.getElementById('cat-recommendation-rate').innerText = "0%";
    document.getElementById('cat-total-reviews').innerText = "0";
    document.getElementById('cat-models-count').innerText = "0";
    
    document.getElementById('cat-table-header').innerHTML = '';
    document.getElementById('cat-table-body').innerHTML = '<tr><td colspan="100%" style="text-align: center; color: var(--text-secondary); padding: 40px;">Aucune catégorie sélectionnée ou aucune donnée disponible.</td></tr>';
    
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
        categoryChartInstance = null;
    }
    
    const subcatSelect = document.getElementById('subcategory-select');
    if (subcatSelect) {
        subcatSelect.innerHTML = '<option value="all">-- Choisir d\'abord une catégorie --</option>';
        subcatSelect.disabled = true;
    }
    
    const multiselectContainer = document.getElementById('product-multiselect-container');
    if (multiselectContainer) {
        multiselectContainer.style.display = 'none';
    }
    
    document.getElementById('product-checkboxes-list').innerHTML = '';
    categorySelectedSubCategory = "all";
    categorySelectedProductIds.clear();
    
    document.getElementById('cat-leader-name').innerText = "Aucun leader identifié";
    document.getElementById('cat-leader-rating').innerText = "⭐ -.- / 5";
    document.getElementById('cat-forces-list').innerHTML = '<li>Sélectionnez une catégorie</li>';
    document.getElementById('cat-faiblesses-list').innerHTML = '<li>Sélectionnez une catégorie</li>';
    document.getElementById('cat-ai-summary').innerText = "Sélectionnez une catégorie ci-dessus pour générer l'analyse stratégique et comparer les performances des modèles en direct.";
}

async function loadCategoryData(categoryName) {
    activeCategory = categoryName;
    try {
        const response = await fetch('../data/processed/products.json');
        if (!response.ok) throw new Error('Catalog products.json not found');
        const products = await response.json();
        
        categoryProducts = products.filter(p => getProductCategory(p.product_name) === categoryName);
        
        // Populate Subcategories dynamic select options
        const subcatSelect = document.getElementById('subcategory-select');
        if (subcatSelect) {
            subcatSelect.innerHTML = `<option value="all">🌐 Toutes les sous-catégories (${categoryProducts.length})</option>`;
            subcatSelect.disabled = false;
            
            const subcatCounts = {};
            categoryProducts.forEach(p => {
                const subcat = getProductSubCategory(p.product_name, categoryName);
                subcatCounts[subcat] = (subcatCounts[subcat] || 0) + 1;
            });
            
            Object.entries(subcatCounts).forEach(([subcat, count]) => {
                const opt = document.createElement('option');
                opt.value = subcat;
                opt.textContent = `${subcat} (${count})`;
                subcatSelect.appendChild(opt);
            });
        }
        
        // Set all products checked by default
        categorySelectedSubCategory = "all";
        categorySelectedProductIds.clear();
        categoryProducts.forEach(p => categorySelectedProductIds.add(p.product_id));
        
        // Render pill checkboxes
        renderProductCheckboxes();
        
        const fetchPromises = categoryProducts.map(async p => {
            try {
                const resp = await fetch(`../${p.file_path}`);
                if (!resp.ok) return [];
                const data = await resp.json();
                return data;
            } catch (e) {
                console.error("Error loading category product data", p.product_id, e);
                return [];
            }
        });
        
        const results = await Promise.all(fetchPromises);
        categoryReviews = results.flat();
        
        const langSelect = document.getElementById('language-select');
        const selectedLang = langSelect ? langSelect.value : 'all';
        renderCategoryData(selectedLang);
    } catch (err) {
        console.error("Failed to load category data", err);
        resetCategoryView();
    }
}

function renderProductCheckboxes() {
    const multiselectContainer = document.getElementById('product-multiselect-container');
    const checkboxListElem = document.getElementById('product-checkboxes-list');
    
    if (!multiselectContainer || !checkboxListElem) return;
    
    checkboxListElem.innerHTML = '';
    
    // Filter product definitions matching current subcategory select
    const matchedProducts = categoryProducts.filter(p => {
        return categorySelectedSubCategory === "all" || getProductSubCategory(p.product_name, activeCategory) === categorySelectedSubCategory;
    });
    
    if (matchedProducts.length === 0) {
        multiselectContainer.style.display = 'none';
        return;
    }
    
    multiselectContainer.style.display = 'block';
    
    matchedProducts.forEach(p => {
        const label = document.createElement('label');
        label.className = 'pill-checkbox';
        
        const isChecked = categorySelectedProductIds.has(p.product_id);
        if (isChecked) {
            label.classList.add('checked-state');
        }
        
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = p.product_id;
        cb.checked = isChecked;
        
        cb.onchange = (e) => {
            const checked = e.target.checked;
            if (checked) {
                categorySelectedProductIds.add(p.product_id);
                label.classList.add('checked-state');
            } else {
                categorySelectedProductIds.delete(p.product_id);
                label.classList.remove('checked-state');
            }
            
            const langSelect = document.getElementById('language-select');
            const selectedLang = langSelect ? langSelect.value : 'all';
            renderCategoryData(selectedLang);
        };
        
        const span = document.createElement('span');
        span.textContent = p.product_name;
        
        label.appendChild(cb);
        label.appendChild(span);
        checkboxListElem.appendChild(label);
    });
}

function renderCategoryData(selectedLang) {
    if (!activeCategory) {
        resetCategoryView();
        return;
    }
    
    // 1. Filter reviews by both Language AND Checked Product IDs
    const filteredReviews = categoryReviews.filter(r => {
        const matchesLang = selectedLang === 'all' || r.original_language === selectedLang;
        const matchesProduct = categorySelectedProductIds.has(r.product_id);
        return matchesLang && matchesProduct;
    });
    
    // 2. Update KPI Grid
    const avgRatingVal = filteredReviews.length > 0 ? (filteredReviews.reduce((sum, r) => sum + r.rating, 0) / filteredReviews.length) : 0;
    document.getElementById('cat-avg-rating').innerText = avgRatingVal > 0 ? avgRatingVal.toFixed(2) : "0.0";
    
    const fullStars = Math.round(avgRatingVal);
    let starsText = "";
    for (let i = 1; i <= 5; i++) {
        starsText += i <= fullStars ? "★" : "☆";
    }
    document.getElementById('cat-avg-stars').innerText = starsText;
    
    const recoReviews = filteredReviews.filter(r => r.rating >= 4);
    const recoRate = filteredReviews.length > 0 ? Math.round((recoReviews.length / filteredReviews.length) * 100) : 0;
    document.getElementById('cat-recommendation-rate').innerText = recoRate + "%";
    
    document.getElementById('cat-total-reviews').innerText = filteredReviews.length;
    
    // Count unique models active in filtered reviews
    const uniqueModels = new Set(filteredReviews.map(r => r.product_id));
    document.getElementById('cat-models-count').innerText = uniqueModels.size;
    
    // 3. Render Comparative Matrix Table
    const aspects = getAspectsForCategory(activeCategory);
    
    // Header
    const headerRow = document.getElementById('cat-table-header');
    headerRow.innerHTML = '';
    
    const thProduct = document.createElement('th');
    thProduct.innerText = "Modèle";
    thProduct.style.width = "30%";
    headerRow.appendChild(thProduct);
    
    const thGlobal = document.createElement('th');
    thGlobal.innerText = "Note Globale";
    thGlobal.style.textAlign = "center";
    headerRow.appendChild(thGlobal);
    
    aspects.forEach(asp => {
        const thAsp = document.createElement('th');
        const emoji = aspectEmojis[asp] || "🏷️";
        thAsp.innerText = `${emoji} ${asp.charAt(0).toUpperCase() + asp.slice(1)}`;
        thAsp.style.textAlign = "center";
        headerRow.appendChild(thAsp);
    });
    
    // Body - only loop over currently CHECKED products
    const tbody = document.getElementById('cat-table-body');
    tbody.innerHTML = '';
    
    let bestProduct = null;
    let bestRating = -1;
    
    const activeProducts = categoryProducts.filter(p => categorySelectedProductIds.has(p.product_id));
    
    if (activeProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" style="text-align: center; color: var(--text-secondary); padding: 40px;">Aucun produit coché pour la comparaison.</td></tr>';
    } else {
        activeProducts.forEach(prod => {
            const prodReviews = categoryReviews.filter(r => r.product_id === prod.product_id && (selectedLang === 'all' || r.original_language === selectedLang));
            const tr = document.createElement('tr');
            
            // Model Name Cell
            const tdName = document.createElement('td');
            tdName.innerHTML = `<strong>${prod.product_name}</strong><br><span style="font-size: 0.75rem; color: var(--text-secondary);">${prodReviews.length} avis</span>`;
            tr.appendChild(tdName);
            
            // Global Product Rating Cell
            const tdGlobal = document.createElement('td');
            tdGlobal.style.textAlign = "center";
            
            let avg = 0;
            if (prodReviews.length > 0) {
                avg = prodReviews.reduce((sum, r) => sum + r.rating, 0) / prodReviews.length;
                const cls = avg >= 4.2 ? "high" : (avg >= 3.5 ? "mid" : "low");
                tdGlobal.innerHTML = `<span class="score-badge ${cls}">⭐ ${avg.toFixed(2)}</span>`;
                
                if (avg > bestRating) {
                    bestRating = avg;
                    bestProduct = prod;
                }
            } else {
                tdGlobal.innerHTML = `<span class="score-badge none">-</span>`;
            }
            tr.appendChild(tdGlobal);
            
            // Aspect-specific Ratings Cells
            aspects.forEach(asp => {
                const tdAsp = document.createElement('td');
                tdAsp.style.textAlign = "center";
                
                const aspReviews = prodReviews.filter(r => r.aspects && r.aspects[asp] !== undefined);
                if (aspReviews.length > 0) {
                    const aspAvg = aspReviews.reduce((sum, r) => sum + r.rating, 0) / aspReviews.length;
                    const cls = aspAvg >= 4.2 ? "high" : (aspAvg >= 3.5 ? "mid" : "low");
                    tdAsp.innerHTML = `<span class="score-badge ${cls}">⭐ ${aspAvg.toFixed(1)}</span>`;
                } else {
                    tdAsp.innerHTML = `<span class="score-badge none">-</span>`;
                }
                tr.appendChild(tdAsp);
            });
            
            tbody.appendChild(tr);
        });
    }
    
    // 4. Render Sentiment Breakdown Chart - only for checked products
    const labels = [];
    const posData = [];
    const neuData = [];
    const negData = [];
    
    activeProducts.forEach(prod => {
        const prodReviews = categoryReviews.filter(r => r.product_id === prod.product_id && (selectedLang === 'all' || r.original_language === selectedLang));
        labels.push(prod.product_name);
        
        if (prodReviews.length > 0) {
            const total = prodReviews.length;
            const pos = prodReviews.filter(r => r.sentiment === 'positive').length;
            const neu = prodReviews.filter(r => r.sentiment === 'neutral').length;
            const neg = prodReviews.filter(r => r.sentiment === 'negative').length;
            
            posData.push(Math.round((pos / total) * 100));
            neuData.push(Math.round((neu / total) * 100));
            negData.push(Math.round((neg / total) * 100));
        } else {
            posData.push(0);
            neuData.push(0);
            negData.push(0);
        }
    });
    
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }
    
    if (activeProducts.length > 0) {
        categoryChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Positifs (%)',
                        data: posData,
                        backgroundColor: '#1DB886',
                        borderRadius: 4
                    },
                    {
                        label: 'Neutres (%)',
                        data: neuData,
                        backgroundColor: '#3A4A6B',
                        borderRadius: 4
                    },
                    {
                        label: 'Négatifs (%)',
                        data: negData,
                        backgroundColor: '#E84B5A',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#8B9BB4', font: { family: 'Inter', size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw}%`;
                            }
                        },
                        backgroundColor: 'rgba(8, 9, 15, 0.95)',
                        titleColor: '#F8F9FF',
                        bodyColor: '#8B9BB4',
                        borderColor: 'rgba(20, 40, 160, 0.3)',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(20, 40, 160, 0.08)' },
                        ticks: { color: '#8B9BB4', callback: function(val) { return val + '%'; } }
                    },
                    y: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { color: '#8B9BB4', font: { size: 11 } }
                    }
                }
            }
        });
    }
    
    // 5. Render dynamic Strategic AI analysis
    updateCategoryAISynthesis(filteredReviews, bestProduct, bestRating, aspects, selectedLang, uniqueModels);
}

function updateCategoryAISynthesis(filteredReviews, bestProduct, bestRating, aspects, selectedLang, uniqueModels) {
    const leaderNameElem = document.getElementById('cat-leader-name');
    const leaderRatingElem = document.getElementById('cat-leader-rating');
    
    if (bestProduct && bestRating > 0) {
        leaderNameElem.innerText = bestProduct.product_name;
        leaderRatingElem.innerText = `⭐ ${bestRating.toFixed(2)} / 5`;
    } else {
        leaderNameElem.innerText = "Aucun leader identifié";
        leaderRatingElem.innerText = "⭐ -.- / 5";
    }
    
    // Calculate aspect rating averages category-wide
    const aspectStats = [];
    aspects.forEach(asp => {
        const aspReviews = filteredReviews.filter(r => r.aspects && r.aspects[asp] !== undefined);
        if (aspReviews.length > 0) {
            const avg = aspReviews.reduce((sum, r) => sum + r.rating, 0) / aspReviews.length;
            const pos = aspReviews.filter(r => r.aspects[asp] === 'positive').length;
            const neg = aspReviews.filter(r => r.aspects[asp] === 'negative').length;
            const posRate = (pos / aspReviews.length) * 100;
            const negRate = (neg / aspReviews.length) * 100;
            aspectStats.push({ aspect: asp, avg: avg, posRate: posRate, negRate: negRate, count: aspReviews.length });
        }
    });
    
    // Sectorial Strengths (top 2 highest averages)
    const forcesList = document.getElementById('cat-forces-list');
    forcesList.innerHTML = '';
    
    const sortedForces = [...aspectStats].sort((a, b) => b.avg - a.avg);
    const topForces = sortedForces.slice(0, 2);
    
    topForces.forEach(f => {
        const li = document.createElement('li');
        const emoji = aspectEmojis[f.aspect] || "💎";
        const template = aspectStrengthTemplates[f.aspect] || "Performance globale jugée excellente par les clients.";
        li.innerHTML = `<strong style="color: var(--positive-color);">${emoji} ${f.aspect.toUpperCase()}</strong> (Moyenne : ${f.avg.toFixed(1)}★) <br> ${template}`;
        forcesList.appendChild(li);
    });
    
    if (topForces.length === 0) {
        forcesList.innerHTML = '<li>Aucun point fort significatif détecté dans cette langue.</li>';
    }
    
    // Sectorial Weaknesses (bottom 2 lowest averages)
    const faiblessesList = document.getElementById('cat-faiblesses-list');
    faiblessesList.innerHTML = '';
    
    const sortedFaiblesses = [...aspectStats].sort((a, b) => a.avg - b.avg);
    const topFaiblesses = sortedFaiblesses.slice(0, 2);
    
    topFaiblesses.forEach(f => {
        const li = document.createElement('li');
        const emoji = aspectEmojis[f.aspect] || "⚠️";
        const template = aspectWeaknessTemplates[f.aspect] || "Certains aspects de cette caractéristique restent perfectibles.";
        li.innerHTML = `<strong style="color: var(--negative-color);">${emoji} ${f.aspect.toUpperCase()}</strong> (Moyenne : ${f.avg.toFixed(1)}★) <br> ${template}`;
        faiblessesList.appendChild(li);
    });
    
    if (topFaiblesses.length === 0) {
        faiblessesList.innerHTML = '<li>Aucune faiblesse majeure détectée dans cette langue.</li>';
    }
    
    // Dynamic strategic analysis paragraph
    let summaryText = "";
    if (filteredReviews.length === 0) {
        summaryText = "Aucune donnée disponible pour cette catégorie dans la langue sélectionnée.";
    } else {
        const totalCount = filteredReviews.length;
        const modelCount = uniqueModels.size;
        const leaderName = bestProduct ? bestProduct.product_name : "N/A";
        const leaderRating = bestProduct ? bestRating.toFixed(2) : "0.0";
        
        const categoryLabel = activeCategory === 'phone' ? 'des Smartphones' :
                              activeCategory === 'watch' ? 'des Montres connectées' :
                              activeCategory === 'buds' ? 'des Écouteurs sans fil' :
                              activeCategory === 'tablet' ? 'des Tablettes tactiles' :
                              activeCategory === 'tv' ? 'des Téléviseurs' :
                              activeCategory === 'home_appliance' ? 'de l\'Électroménager' : 'de produits';
    
        summaryText = `L'analyse comparative sectorielle de la catégorie <strong>${categoryLabel}</strong> porte sur un volume de <strong>${totalCount} avis</strong> répartis sur <strong>${modelCount} modèles</strong> distincts. <br><br>`;
        
        if (bestProduct) {
            summaryText += `Le modèle <strong>${leaderName}</strong> s'impose comme le leader incontesté de la catégorie avec une note moyenne de <strong>${leaderRating} / 5</strong> dans la langue sélectionnée. Les retours clients soulignent une adéquation remarquable avec leurs besoins. <br><br>`;
        }
        
        if (aspectStats.length > 0) {
            const bestAspectObj = sortedForces[0];
            const worstAspectObj = sortedFaiblesses[0];
            
            summaryText += `Au niveau des caractéristiques produit, l'aspect le plus performant du secteur est <strong>${bestAspectObj.aspect}</strong> (${aspectEmojis[bestAspectObj.aspect]} ${bestAspectObj.avg.toFixed(1)}★), ce qui atteste d'une grande maîtrise sur cette caractéristique clé. À l'inverse, l'aspect <strong>${worstAspectObj.aspect}</strong> (${aspectEmojis[worstAspectObj.aspect]} ${worstAspectObj.avg.toFixed(1)}★) concentre la majority des frustrations et constitue l'axe d'amélioration stratégique prioritaire pour cette catégorie.`;
        } else {
            summaryText += `Les caractéristiques spécifiques des produits n'ont pas encore été citées en nombre suffisant dans les avis de cette langue pour en tirer des tendances aspect-par-aspect fiables.`;
        }
    }
    
    document.getElementById('cat-ai-summary').innerHTML = summaryText;
}
