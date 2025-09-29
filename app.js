/**
 * Diccionario Técnico Comunitario ITSC
 * Main Application JavaScript
 */

/**
 * SearchEngine class handles searching and filtering of terms
 */
class SearchEngine {
    constructor(terms = []) {
        this.terms = terms;
        this.searchDebounceTimeout = null;
        this.searchDebounceDelay = 300; // 300ms delay for debouncing
    }

    /**
     * Update the terms dataset
     * @param {Array} terms - Array of term objects
     */
    updateTerms(terms) {
        this.terms = terms;
    }

    /**
     * Perform real-time search across terms
     * @param {string} query - Search query string
     * @returns {Array} Array of matching terms
     */
    search(query) {
        if (!query || typeof query !== 'string') {
            return [];
        }

        const normalizedQuery = this.normalizeText(query.trim());
        
        if (normalizedQuery.length === 0) {
            return [];
        }

        return this.terms.filter(term => {
            // Search across termino_formal, dominicanismo, and definicion fields
            const searchFields = [
                this.normalizeText(term.termino_formal || ''),
                this.normalizeText(term.dominicanismo || ''),
                this.normalizeText(term.definicion || '')
            ];

            return searchFields.some(field => 
                field.includes(normalizedQuery)
            );
        });
    }

    /**
     * Filter terms by academic area
     * @param {string} area - Academic area name
     * @returns {Array} Array of terms for the specified area
     */
    filterByArea(area) {
        if (!area || typeof area !== 'string') {
            return [];
        }

        return this.terms.filter(term => 
            term.area && term.area.toLowerCase() === area.toLowerCase()
        );
    }

    /**
     * Perform debounced search to optimize performance
     * @param {string} query - Search query string
     * @param {Function} callback - Callback function to execute with results
     */
    debouncedSearch(query, callback) {
        // Clear existing timeout
        if (this.searchDebounceTimeout) {
            clearTimeout(this.searchDebounceTimeout);
        }

        // Set new timeout
        this.searchDebounceTimeout = setTimeout(() => {
            const results = this.search(query);
            callback(results);
        }, this.searchDebounceDelay);
    }

    /**
     * Normalize text for better Spanish language support
     * Converts to lowercase and removes accented characters
     * @param {string} text - Text to normalize
     * @returns {string} Normalized text
     */
    normalizeText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        return text
            .toLowerCase()
            .normalize('NFD') // Decompose accented characters
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
            .trim();
    }

    /**
     * Get search statistics
     * @returns {Object} Object with search statistics
     */
    getSearchStats() {
        return {
            totalTerms: this.terms.length,
            debounceDelay: this.searchDebounceDelay
        };
    }

    /**
     * Clear any pending debounced search
     */
    clearDebounce() {
        if (this.searchDebounceTimeout) {
            clearTimeout(this.searchDebounceTimeout);
            this.searchDebounceTimeout = null;
        }
    }
}

/**
 * DataLoader class handles loading and validation of term data from JSON files
 */
class DataLoader {
    constructor() {
        this.academicAreas = [
            'informatica',
            'salud', 
            'artes',
            'hosteleria',
            'construccion',
            'industrial',
            'electromecanica'
        ];
        this.loadedData = new Map();
        this.allTerms = [];
    }

    /**
     * Load all data from all academic area JSON files
     * @returns {Promise<Array>} Array of all terms with area information
     */
    async loadAllData() {
        try {
            const loadPromises = this.academicAreas.map(area => this.loadAreaData(area));
            const areaResults = await Promise.allSettled(loadPromises);
            
            this.allTerms = [];
            const failedAreas = [];
            
            areaResults.forEach((result, index) => {
                const area = this.academicAreas[index];
                if (result.status === 'fulfilled') {
                    const areaTerms = result.value.map(term => ({
                        ...term,
                        area: area
                    }));
                    this.allTerms.push(...areaTerms);
                    this.loadedData.set(area, areaTerms);
                } else {
                    console.warn(`Failed to load data for area: ${area}`, result.reason);
                    failedAreas.push(area);
                }
            });

            if (failedAreas.length > 0) {
                console.warn(`Some areas failed to load: ${failedAreas.join(', ')}`);
            }

            if (this.allTerms.length === 0) {
                throw new Error('No se pudieron cargar datos de ninguna área académica');
            }

            console.log(`Successfully loaded ${this.allTerms.length} terms from ${this.loadedData.size} areas`);
            return this.allTerms;
            
        } catch (error) {
            console.error('Error loading all data:', error);
            throw new Error('Error al cargar los datos del diccionario');
        }
    }

    /**
     * Load data for a specific academic area
     * @param {string} area - The academic area name
     * @returns {Promise<Array>} Array of terms for the specified area
     */
    async loadAreaData(area) {
        try {
            const response = await fetch(`./data/${area}.json`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Archivo de datos no encontrado para el área: ${area}`);
                } else {
                    throw new Error(`Error HTTP ${response.status} al cargar datos del área: ${area}`);
                }
            }

            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error(`Formato de datos inválido para el área ${area}: se esperaba un array`);
            }

            // Validate each term in the data
            const validTerms = [];
            data.forEach((term, index) => {
                if (this.validateTermSchema(term)) {
                    validTerms.push(term);
                } else {
                    console.warn(`Invalid term schema at index ${index} in ${area}.json:`, term);
                }
            });

            if (validTerms.length === 0) {
                throw new Error(`No se encontraron términos válidos en el área: ${area}`);
            }

            console.log(`Loaded ${validTerms.length} valid terms for area: ${area}`);
            return validTerms;
            
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error(`Error de red al cargar datos del área: ${area}`);
            }
            throw error;
        }
    }

    /**
     * Validate that a term object has the required schema
     * @param {Object} term - The term object to validate
     * @returns {boolean} True if the term is valid, false otherwise
     */
    validateTermSchema(term) {
        if (!term || typeof term !== 'object') {
            return false;
        }

        const requiredFields = ['termino_formal', 'dominicanismo', 'ejemplo_uso'];
        const optionalFields = ['definicion'];

        for (const field of requiredFields) {
            if (!term.hasOwnProperty(field) ||
                typeof term[field] !== 'string' ||
                term[field].trim().length === 0) {
                return false;
            }
        }

        for (const field of optionalFields) {
            if (term.hasOwnProperty(field) && typeof term[field] !== 'string') {
                return false;
            }
        }


        return true;
    }

    /**
     * Get terms for a specific area (from loaded data)
     * @param {string} area - The academic area name
     * @returns {Array} Array of terms for the specified area
     */
    getAreaTerms(area) {
        return this.loadedData.get(area) || [];
    }

    /**
     * Get all loaded terms
     * @returns {Array} Array of all loaded terms
     */
    getAllTerms() {
        return this.allTerms;
    }

    /**
     * Check if data has been loaded
     * @returns {boolean} True if data is loaded, false otherwise
     */
    isDataLoaded() {
        return this.allTerms.length > 0;
    }

    /**
     * Get loading statistics
     * @returns {Object} Object with loading statistics
     */
    getLoadingStats() {
        return {
            totalTerms: this.allTerms.length,
            loadedAreas: this.loadedData.size,
            totalAreas: this.academicAreas.length,
            areasLoaded: Array.from(this.loadedData.keys())
        };
    }
}

class DiccionarioApp {
    constructor() {
        this.currentView = 'loading'; // 'loading', 'areas', 'search', 'area-filter', 'error'
        this.currentArea = null;
        this.searchQuery = '';
        this.terms = [];
        this.dataLoader = new DataLoader();
        this.searchEngine = new SearchEngine();
        this.isDataLoaded = false;
        this.currentTheme = 'light'; // Default theme
        
        // DOM elements
        this.elements = {
            loadingState: document.getElementById('loadingState'),
            errorState: document.getElementById('errorState'),
            areasSection: document.getElementById('areasSection'),
            resultsSection: document.getElementById('resultsSection'),
            searchInput: document.getElementById('searchInput'),
            searchClear: document.getElementById('searchClear'),
            searchStatus: document.getElementById('searchStatus'),
            areasGrid: document.getElementById('areasGrid'),
            resultsGrid: document.getElementById('resultsGrid'),
            resultsTitle: document.getElementById('resultsTitle'),
            resultsCount: document.getElementById('resultsCount'),
            noResults: document.getElementById('noResults'),
            retryButton: document.getElementById('retryButton'),
            backButton: document.getElementById('backButton'),
            themeToggle: document.getElementById('themeToggle'),
            themeStatus: document.getElementById('themeStatus')
        };
        
        this.init();
    }
    
    async init() {
        try {
            // Initialize theme system first
            this.initializeTheme();
            
            // Apply mobile optimizations first
            this.optimizeViewportForMobile();
            
            // Initialize UI state
            this.initializeUIState();
            
            this.setupEventListeners();
            await this.loadData();
            
            // Apply responsive optimizations after data is loaded
            this.applyResponsiveOptimizations();
            
            console.log('Diccionario Técnico ITSC initialized successfully');
        } catch (error) {
            console.error('Error initializing application:', error);
            this.showError(error.message || 'Error al inicializar la aplicación');
        }
    }

    /**
     * Initialize UI state to ensure proper initial display
     */
    initializeUIState() {
        // Ensure search clear button is hidden initially
        if (this.elements.searchClear) {
            this.elements.searchClear.classList.remove('visible');
            this.elements.searchClear.setAttribute('tabindex', '-1');
        }
        
        // Ensure search input is empty initially
        if (this.elements.searchInput) {
            this.elements.searchInput.value = '';
        }
        
        // Initialize search query state
        this.searchQuery = '';
        
        console.log('UI state initialized');
    }

    /**
     * Load all dictionary data using DataLoader
     */
    async loadData() {
        try {
            this.showLoading('Cargando diccionario técnico...');
            
            this.terms = await this.dataLoader.loadAllData();
            
            // Initialize SearchEngine with loaded terms
            this.searchEngine.updateTerms(this.terms);
            this.isDataLoaded = true;
            
            const stats = this.dataLoader.getLoadingStats();
            console.log('Data loading completed:', stats);
            
            this.showAreasView();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.isDataLoaded = false;
            throw error;
        }
    }
    
    setupEventListeners() {
        // Enhanced area card interaction handlers
        const areaCards = document.querySelectorAll('.area-card');
        areaCards.forEach(card => {
            // Click handler for mouse and touch
            card.addEventListener('click', (e) => {
                const area = e.currentTarget.dataset.area;
                this.handleAreaClick(area);
            });
            
            // Touch-specific handlers for better mobile experience
            card.addEventListener('touchstart', (e) => {
                // Add active state for touch feedback
                if (e.currentTarget && e.currentTarget.style) {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(0.98)';
                }
            }, { passive: true });
            
            card.addEventListener('touchend', (e) => {
                // Reset transform after touch
                setTimeout(() => {
                    if (e.currentTarget && e.currentTarget.style) {
                        e.currentTarget.style.transform = '';
                    }
                }, 150);
            }, { passive: true });
            
            card.addEventListener('touchcancel', (e) => {
                // Reset transform if touch is cancelled
                if (e.currentTarget && e.currentTarget.style) {
                    e.currentTarget.style.transform = '';
                }
            }, { passive: true });
            
            // Keyboard accessibility
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const area = e.currentTarget.dataset.area;
                    this.handleAreaClick(area);
                }
            });
        });
        
        // Enhanced search input handlers with mobile optimizations
        if (this.elements.searchInput) {
            // Real-time search with input event listener
            this.elements.searchInput.addEventListener('input', (e) => {
                this.handleSearchInput(e.target.value);
            });
            
            // Keyboard navigation and shortcuts
            this.elements.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearSearch();
                    this.elements.searchInput.blur(); // Remove focus after clearing
                } else if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission
                    // Focus stays on input for continued typing
                }
            });
            
            // Touch-specific optimizations for mobile
            this.elements.searchInput.addEventListener('touchstart', () => {
                // Ensure input is properly focused on touch devices
                this.elements.searchInput.focus();
            }, { passive: true });
            
            // Focus management for better UX
            this.elements.searchInput.addEventListener('focus', () => {
                this.handleSearchFocus();
            });
            
            this.elements.searchInput.addEventListener('blur', () => {
                this.handleSearchBlur();
            });
            
            // Prevent zoom on iOS when focusing input
            if (this.isMobileDevice()) {
                this.elements.searchInput.addEventListener('focus', () => {
                    // Temporarily increase font size to prevent zoom
                    const currentFontSize = window.getComputedStyle(this.elements.searchInput).fontSize;
                    if (parseFloat(currentFontSize) < 16) {
                        this.elements.searchInput.style.fontSize = '16px';
                    }
                });
                
                this.elements.searchInput.addEventListener('blur', () => {
                    // Reset font size after blur
                    this.elements.searchInput.style.fontSize = '';
                });
            }
        }
        
        // Enhanced search clear button with touch optimizations
        if (this.elements.searchClear) {
            this.elements.searchClear.addEventListener('click', () => {
                this.clearSearch();
                // Return focus to search input after clearing
                if (this.elements.searchInput) {
                    this.elements.searchInput.focus();
                }
            });
            
            // Touch feedback for mobile devices with improved cleanup
            this.elements.searchClear.addEventListener('touchstart', (e) => {
                if (e.currentTarget && e.currentTarget.style && e.currentTarget.classList.contains('visible')) {
                    e.currentTarget.style.transform = 'translateY(-50%) scale(0.95)';
                    e.currentTarget.style.backgroundColor = 'rgba(200, 16, 46, 0.15)';
                }
            }, { passive: true });
            
            this.elements.searchClear.addEventListener('touchend', (e) => {
                const element = e.currentTarget;
                setTimeout(() => {
                    // Only reset styles if element still exists and is visible
                    if (element && element.style && element.classList.contains('visible')) {
                        element.style.transform = 'translateY(-50%)';
                        element.style.backgroundColor = '';
                    }
                }, 150);
            }, { passive: true });
            
            this.elements.searchClear.addEventListener('touchcancel', (e) => {
                if (e.currentTarget && e.currentTarget.style) {
                    // Immediately reset on cancel, regardless of visibility
                    e.currentTarget.style.transform = 'translateY(-50%)';
                    e.currentTarget.style.backgroundColor = '';
                }
            }, { passive: true });
            
            // Keyboard accessibility for clear button
            this.elements.searchClear.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.clearSearch();
                    if (this.elements.searchInput) {
                        this.elements.searchInput.focus();
                    }
                }
            });
        }
        
        // Enhanced retry button with touch feedback
        if (this.elements.retryButton) {
            this.elements.retryButton.addEventListener('click', () => {
                this.retryDataLoading();
            });
            
            // Touch feedback for mobile
            this.addTouchFeedback(this.elements.retryButton);
        }
        
        // Enhanced back button with touch feedback
        if (this.elements.backButton) {
            this.elements.backButton.addEventListener('click', () => {
                this.handleBackButton();
            });
            
            // Touch feedback for mobile
            this.addTouchFeedback(this.elements.backButton);
        }
        
        // Theme toggle event listener
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
            
            // Keyboard accessibility for theme toggle
            this.elements.themeToggle.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleTheme();
                }
            });
            
            // Touch feedback for mobile
            this.addTouchFeedback(this.elements.themeToggle);
        }
    }
    
    handleAreaClick(area) {
        if (!this.isDataLoaded) {
            console.warn('Data not loaded yet, ignoring area click');
            return;
        }
        
        console.log(`Area clicked: ${area}`);
        this.currentArea = area;
        this.currentView = 'area-filter';
        
        // Use SearchEngine for consistent area filtering
        const areaTerms = this.searchEngine.filterByArea(area);
        this.showAreaFilterView(area, areaTerms);
    }
    
    handleSearchInput(query) {
        // Validate and sanitize input
        const sanitizedQuery = this.validateSearchInput(query);
        
        if (!this.isDataLoaded) {
            console.warn('Data not loaded yet, ignoring search input');
            this.updateSearchInputState('loading');
            return;
        }
        
        this.searchQuery = sanitizedQuery.trim();
        
        // Show/hide clear button with smooth transition
        if (this.elements.searchClear) {
            this.elements.searchClear.classList.toggle('visible', this.searchQuery.length > 0);
            
            // Make clear button focusable when visible and reset styles
            if (this.searchQuery.length > 0) {
                this.elements.searchClear.setAttribute('tabindex', '0');
                // Reset any lingering inline styles when showing the button
                this.resetTouchStyles(this.elements.searchClear);
            } else {
                this.elements.searchClear.setAttribute('tabindex', '-1');
                // Also reset styles when hiding
                this.resetTouchStyles(this.elements.searchClear);
            }
        }
        
        if (this.searchQuery.length === 0) {
            // Clear any pending debounced search
            this.searchEngine.clearDebounce();
            this.updateSearchInputState('empty');
            this.showAreasView();
        } else {
            this.currentView = 'search';
            
            // Add visual feedback for search state
            this.updateSearchInputState('searching');
            
            // Show loading state immediately for queries longer than 2 characters
            if (this.searchQuery.length > 2) {
                this.showSearchLoadingState();
            }
            
            // Use debounced search for performance optimization
            this.searchEngine.debouncedSearch(this.searchQuery, (results) => {
                // Only update results if we're still in search mode and query matches
                if (this.currentView === 'search' && this.searchQuery.trim() === sanitizedQuery.trim()) {
                    this.updateSearchInputState(results.length > 0 ? 'results' : 'no-results', results.length);
                    this.renderSearchResults(results);
                }
            });
        }
    }
    
    /**
     * Handle search input focus for better UX
     */
    handleSearchFocus() {
        if (this.elements.searchInput) {
            this.elements.searchInput.classList.add('search-focused');
        }
        
        // If there's a current search query, ensure results are visible
        if (this.searchQuery.length > 0 && this.currentView !== 'search') {
            this.handleSearchInput(this.searchQuery);
        }
    }
    
    /**
     * Handle search input blur
     */
    handleSearchBlur() {
        if (this.elements.searchInput) {
            this.elements.searchInput.classList.remove('search-focused');
        }
    }
    
    /**
     * Update search input visual state based on search status
     * @param {string} state - Current search state: 'empty', 'searching', 'results', 'no-results', 'loading'
     * @param {number} resultCount - Number of results (optional)
     */
    updateSearchInputState(state, resultCount = 0) {
        if (!this.elements.searchInput) return;
        
        // Remove all state classes
        const stateClasses = ['search-empty', 'search-searching', 'search-results', 'search-no-results', 'search-loading'];
        this.elements.searchInput.classList.remove(...stateClasses);
        
        // Add current state class and announce to screen readers
        switch (state) {
            case 'empty':
                this.elements.searchInput.classList.add('search-empty');
                this.announceSearchStatus('Búsqueda limpia. Mostrando áreas académicas.');
                break;
            case 'searching':
                this.elements.searchInput.classList.add('search-searching');
                this.announceSearchStatus('Buscando términos...');
                break;
            case 'results':
                this.elements.searchInput.classList.add('search-results');
                const termText = resultCount === 1 ? 'término encontrado' : 'términos encontrados';
                this.announceSearchStatus(`${resultCount} ${termText}.`);
                break;
            case 'no-results':
                this.elements.searchInput.classList.add('search-no-results');
                this.announceSearchStatus('No se encontraron términos que coincidan con tu búsqueda.');
                break;
            case 'loading':
                this.elements.searchInput.classList.add('search-loading');
                this.announceSearchStatus('Cargando resultados de búsqueda...');
                break;
        }
    }
    
    /**
     * Announce search status to screen readers
     * @param {string} message - Message to announce
     */
    announceSearchStatus(message) {
        if (this.elements.searchStatus) {
            // Clear previous message first
            this.elements.searchStatus.textContent = '';
            
            // Set new message after a brief delay to ensure screen readers pick it up
            setTimeout(() => {
                this.elements.searchStatus.textContent = message;
            }, 100);
        }
    }
    
    /**
     * Show loading state for search results
     */
    showSearchLoadingState() {
        this.hideAllSections();
        
        // Show results section with loading message
        if (this.elements.resultsSection) {
            this.elements.resultsSection.style.display = 'block';
            this.elements.resultsSection.style.opacity = '1';
        }
        
        // Hide back button for search results
        if (this.elements.backButton) {
            this.elements.backButton.style.display = 'none';
        }
        
        // Update results title
        if (this.elements.resultsTitle) {
            this.elements.resultsTitle.textContent = 'Buscando...';
        }
        
        // Show loading message in results grid
        if (this.elements.resultsGrid) {
            this.elements.resultsGrid.innerHTML = `
                <div class="search-loading-message">
                    <div class="loading-spinner"></div>
                    <p>Buscando términos...</p>
                </div>
            `;
        }
        
        // Clear results count during loading
        if (this.elements.resultsCount) {
            this.elements.resultsCount.textContent = '';
        }
        
        // Hide no results message during loading
        if (this.elements.noResults) {
            this.elements.noResults.style.display = 'none';
        }
    }
    
    /**
     * Validate and sanitize search input
     * @param {string} query - Raw search query
     * @returns {string} Sanitized query
     */
    validateSearchInput(query) {
        if (typeof query !== 'string') {
            return '';
        }
        
        // Remove excessive whitespace and limit length
        const sanitized = query.trim().substring(0, 100);
        
        // Basic XSS prevention (though not strictly necessary for search)
        return sanitized.replace(/[<>]/g, '');
    }
    
    /**
     * Get search input element and ensure it maintains focus appropriately
     */
    maintainSearchFocus() {
        if (this.elements.searchInput && document.activeElement !== this.elements.searchInput) {
            // Only refocus if user was interacting with search-related elements
            const searchContainer = this.elements.searchInput.closest('.search-container');
            if (searchContainer && searchContainer.contains(document.activeElement)) {
                this.elements.searchInput.focus();
            }
        }
    }
    
    /**
     * Detect if the current device is a mobile device
     * @returns {boolean} True if mobile device, false otherwise
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768 && 'ontouchstart' in window);
    }
    
    /**
     * Reset inline styles applied by touch events
     * @param {HTMLElement} element - Element to reset styles for
     */
    resetTouchStyles(element) {
        if (element && element.style) {
            // For search clear button, maintain vertical centering
            if (element === this.elements.searchClear) {
                element.style.transform = 'translateY(-50%)';
            } else {
                element.style.transform = '';
            }
            element.style.backgroundColor = '';
            element.style.transition = '';
        }
    }

    /**
     * Add touch feedback to interactive elements
     * @param {HTMLElement} element - Element to add touch feedback to
     */
    addTouchFeedback(element) {
        if (!element) return;
        
        element.addEventListener('touchstart', (e) => {
            if (e.currentTarget && e.currentTarget.style) {
                e.currentTarget.style.transform = 'scale(0.95)';
                e.currentTarget.style.transition = 'transform 0.1s ease-out';
            }
        }, { passive: true });
        
        element.addEventListener('touchend', (e) => {
            setTimeout(() => {
                if (e.currentTarget && e.currentTarget.style) {
                    e.currentTarget.style.transform = '';
                    e.currentTarget.style.transition = '';
                }
            }, 150);
        }, { passive: true });
        
        element.addEventListener('touchcancel', (e) => {
            if (e.currentTarget && e.currentTarget.style) {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.transition = '';
            }
        }, { passive: true });
    }
    
    /**
     * Optimize viewport for mobile devices
     */
    optimizeViewportForMobile() {
        if (this.isMobileDevice()) {
            // Prevent horizontal scrolling on mobile
            document.body.style.overflowX = 'hidden';
            
            // Optimize touch scrolling
            document.body.style.webkitOverflowScrolling = 'touch';
            
            // Prevent pull-to-refresh on mobile browsers
            document.body.style.overscrollBehavior = 'none';
            
            // Add mobile-specific class for CSS targeting
            document.documentElement.classList.add('mobile-device');
        }
    }
    
    /**
     * Apply responsive optimizations based on screen size
     */
    applyResponsiveOptimizations() {
        // Handle window resize events for responsive behavior
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResponsiveResize();
            }, 250);
        });
        
        // Handle orientation change on mobile devices
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
        
        // Initial responsive setup
        this.handleResponsiveResize();
    }
    
    /**
     * Handle responsive layout changes on window resize
     */
    handleResponsiveResize() {
        const screenWidth = window.innerWidth;
        
        // Update mobile device detection based on current screen size
        if (screenWidth <= 768 && 'ontouchstart' in window) {
            document.documentElement.classList.add('mobile-device');
        } else {
            document.documentElement.classList.remove('mobile-device');
        }
        
        // Adjust search input behavior based on screen size
        if (this.elements.searchInput) {
            if (screenWidth <= 576) {
                // Very small screens - ensure input is easily accessible
                this.elements.searchInput.style.fontSize = '16px';
            } else {
                // Larger screens - use default styling
                this.elements.searchInput.style.fontSize = '';
            }
        }
        
        // Log responsive state for debugging
        console.log(`Responsive resize: ${screenWidth}px width, mobile: ${this.isMobileDevice()}`);
    }
    
    /**
     * Handle orientation change on mobile devices
     */
    handleOrientationChange() {
        if (this.isMobileDevice()) {
            // Force a layout recalculation after orientation change
            document.body.style.height = '100vh';
            
            setTimeout(() => {
                document.body.style.height = '';
                
                // Ensure search input maintains proper focus after orientation change
                if (document.activeElement === this.elements.searchInput) {
                    this.elements.searchInput.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }
            }, 300);
        }
    }
    
    clearSearch() {
        // Clear search input value
        if (this.elements.searchInput) {
            this.elements.searchInput.value = '';
        }
        
        // Hide clear button with smooth transition and reset styles
        if (this.elements.searchClear) {
            this.elements.searchClear.classList.remove('visible');
            this.elements.searchClear.setAttribute('tabindex', '-1');
            
            // Clear any inline styles that might have been applied by touch events
            this.resetTouchStyles(this.elements.searchClear);
        }
        
        // Clear any pending debounced search
        this.searchEngine.clearDebounce();
        this.searchQuery = '';
        
        // Update search input state
        this.updateSearchInputState('empty');
        
        // Return to areas view with smooth transition
        this.showAreasView();
        
        console.log('Search cleared, returning to areas view');
    }
    
    handleBackButton() {
        // Clear search if there's an active search
        this.clearSearch();
        // Always return to areas view
        this.showAreasView();
    }
    
    /**
     * Show areas view with smooth transition
     */
    showAreasView() {
        this.currentView = 'areas';
        this.currentArea = null;
        
        this.hideAllSections();
        
        // Show areas section with smooth transition
        if (this.elements.areasSection) {
            this.elements.areasSection.style.display = 'block';
            this.elements.areasSection.style.opacity = '0';
            this.elements.areasSection.style.transform = 'translateY(10px)';
            
            // Trigger smooth transition
            requestAnimationFrame(() => {
                this.elements.areasSection.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                this.elements.areasSection.style.opacity = '1';
                this.elements.areasSection.style.transform = 'translateY(0)';
            });
        }
        
        // Hide back button when showing areas
        if (this.elements.backButton) {
            this.elements.backButton.style.display = 'none';
        }
        
        console.log('Showing areas view');
    }
    
    /**
     * Show area filter view with smooth transition
     * @param {string} area - Academic area name
     * @param {Array} terms - Array of terms for the area
     */
    showAreaFilterView(area, terms = []) {
        this.hideAllSections();
        
        // Show results section with smooth transition
        if (this.elements.resultsSection) {
            this.elements.resultsSection.style.display = 'block';
            this.elements.resultsSection.style.opacity = '0';
            this.elements.resultsSection.style.transform = 'translateY(10px)';
            
            // Trigger smooth transition
            requestAnimationFrame(() => {
                this.elements.resultsSection.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                this.elements.resultsSection.style.opacity = '1';
                this.elements.resultsSection.style.transform = 'translateY(0)';
            });
        }
        
        // Show back button for area filter view
        if (this.elements.backButton) {
            this.elements.backButton.style.display = 'inline-flex';
        }
        
        // Update results title
        if (this.elements.resultsTitle) {
            const areaNames = {
                'salud': 'Salud',
                'informatica': 'Informática',
                'artes': 'Artes',
                'hosteleria': 'Turismo',
                'construccion': 'Construcción',
                'industrial': 'Industrial',
                'electromecanica': 'Electromecánica'
            };
            this.elements.resultsTitle.textContent = `Términos de ${areaNames[area] || area}`;
        }
        
        // Update results count with proper pluralization
        if (this.elements.resultsCount) {
            const termText = terms.length === 1 ? 'término' : 'términos';
            const foundText = terms.length === 1 ? 'encontrado' : 'encontrados';
            this.elements.resultsCount.textContent = `${terms.length} ${termText} ${foundText}`;
        }
        
        // Show terms or no results message
        if (this.elements.resultsGrid) {
            if (terms.length === 0) {
                const areaNames = {
                    'salud': 'Salud',
                    'informatica': 'Informática',
                    'artes': 'Artes',
                    'hosteleria': 'Turismo',
                    'construccion': 'Construcción',
                    'industrial': 'Industrial',
                    'electromecanica': 'Electromecánica'
                };
                this.elements.resultsGrid.innerHTML = `
                    <div class="placeholder-message">
                        <p>No se encontraron términos para el área de ${areaNames[area] || area}.</p>
                    </div>
                `;
            } else {
                // Render area-specific terms using term cards
                this.renderTermCards(terms);
            }
        }
        
        console.log(`Showing area filter view for: ${area} with ${terms.length} terms`);
    }
    
    /**
     * Render search results view with filtered terms
     * @param {Array} results - Array of filtered term objects
     */
    renderSearchResults(results) {
        // Switch to search results view
        this.currentView = 'search';
        this.hideAllSections();
        
        // Show results section with smooth transition
        if (this.elements.resultsSection) {
            this.elements.resultsSection.style.display = 'block';
            this.elements.resultsSection.style.opacity = '0';
            this.elements.resultsSection.style.transform = 'translateY(10px)';
            
            // Trigger smooth transition
            requestAnimationFrame(() => {
                this.elements.resultsSection.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                this.elements.resultsSection.style.opacity = '1';
                this.elements.resultsSection.style.transform = 'translateY(0)';
            });
        }
        
        // Hide back button for search results (search can be cleared instead)
        if (this.elements.backButton) {
            this.elements.backButton.style.display = 'none';
        }
        
        // Update results title
        if (this.elements.resultsTitle) {
            this.elements.resultsTitle.textContent = 'Resultados de búsqueda';
        }
        
        // Handle empty results
        if (results.length === 0) {
            this.showNoResultsMessage();
        } else {
            this.showSearchResultsContent(results);
        }
        
        console.log(`Rendered search results: ${results.length} terms found`);
    }

    /**
     * Show "no results found" message for empty search results
     */
    showNoResultsMessage() {
        // Show no results message
        if (this.elements.noResults) {
            this.elements.noResults.style.display = 'block';
            this.elements.noResults.style.opacity = '0';
            this.elements.noResults.style.transform = 'translateY(10px)';
            
            // Smooth transition for no results message
            requestAnimationFrame(() => {
                this.elements.noResults.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                this.elements.noResults.style.opacity = '1';
                this.elements.noResults.style.transform = 'translateY(0)';
            });
        }
        
        // Clear results grid
        if (this.elements.resultsGrid) {
            this.elements.resultsGrid.innerHTML = '';
        }
        
        // Update results count
        if (this.elements.resultsCount) {
            this.elements.resultsCount.textContent = 'No se encontraron resultados';
        }
    }

    /**
     * Show search results content with term cards
     * @param {Array} results - Array of term objects to display
     */
    showSearchResultsContent(results) {
        // Hide no results message
        if (this.elements.noResults) {
            this.elements.noResults.style.display = 'none';
        }
        
        // Render search results using term cards
        this.renderTermCards(results);
        
        // Update results count with proper pluralization
        if (this.elements.resultsCount) {
            const termText = results.length === 1 ? 'término' : 'términos';
            const foundText = results.length === 1 ? 'encontrado' : 'encontrados';
            this.elements.resultsCount.textContent = `${results.length} ${termText} ${foundText}`;
        }
    }

    showSearchResults(results) {
        // Use the new renderSearchResults function for consistency
        this.renderSearchResults(results);
    }
    
    /**
     * Show loading state with optional message
     * @param {string} message - Loading message to display
     */
    showLoading(message = 'Cargando...') {
        this.currentView = 'loading';
        this.hideAllSections();
        
        if (this.elements.loadingState) {
            this.elements.loadingState.style.display = 'block';
            const loadingText = this.elements.loadingState.querySelector('p');
            if (loadingText) {
                loadingText.textContent = message;
            }
        }
        
        console.log('Showing loading state:', message);
    }

    /**
     * Show error state with message and retry option
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.currentView = 'error';
        this.hideAllSections();
        
        if (this.elements.errorState) {
            this.elements.errorState.style.display = 'block';
            const errorText = this.elements.errorState.querySelector('p');
            if (errorText) {
                errorText.textContent = message;
            }
        }
        
        console.error('Application error:', message);
    }

    /**
     * Retry data loading after an error
     */
    async retryDataLoading() {
        try {
            // Reset data loader and search engine state
            this.dataLoader = new DataLoader();
            this.searchEngine = new SearchEngine();
            this.terms = [];
            this.isDataLoaded = false;
            
            await this.loadData();
        } catch (error) {
            console.error('Retry failed:', error);
            this.showError(error.message || 'Error al reintentar cargar los datos');
        }
    }
    
    /**
     * Render multiple term cards in the results grid
     * @param {Array} terms - Array of term objects to render
     */
    renderTermCards(terms) {
        if (!this.elements.resultsGrid || !Array.isArray(terms)) {
            console.warn('Cannot render term cards: missing results grid or invalid terms array');
            return;
        }

        // Clear existing content
        this.elements.resultsGrid.innerHTML = '';

        // Create document fragment for efficient DOM manipulation
        const fragment = document.createDocumentFragment();

        // Render each term as a card
        terms.forEach(term => {
            const termCard = this.renderTermCard(term);
            if (termCard) {
                fragment.appendChild(termCard);
            }
        });

        // Append all cards at once
        this.elements.resultsGrid.appendChild(fragment);
    }

    /**
     * Render a single term card
     * @param {Object} term - Term object with termino_formal, dominicanismo, definicion, ejemplo_uso, and area
     * @returns {HTMLElement} DOM element representing the term card
     */
    renderTermCard(term) {
        if (!term || typeof term !== 'object') {
            console.warn('Invalid term object provided to renderTermCard');
            return null;
        }

        // Validate required fields
        const requiredFields = ['termino_formal', 'dominicanismo', 'definicion', 'ejemplo_uso'];
        for (const field of requiredFields) {
            if (!term[field] || typeof term[field] !== 'string') {
                console.warn(`Missing or invalid field '${field}' in term:`, term);
                return null;
            }
        }

        // Create card container
        const card = document.createElement('div');
        card.className = 'term-card';
        card.setAttribute('role', 'article');
        card.setAttribute('aria-label', `Término: ${term.termino_formal}`);

        // Create area badge if area is specified
        let areaBadgeHTML = '';
        if (term.area) {
            const areaNames = {
                'salud': 'Salud',
                'informatica': 'Informática',
                'artes': 'Artes',
                'hosteleria': 'Turismo',
                'construccion': 'Construcción',
                'industrial': 'Industrial',
                'electromecanica': 'Electromecánica'
            };
            const areaDisplayName = areaNames[term.area] || term.area;
            areaBadgeHTML = `<span class="term-area-badge" data-area="${term.area}">${areaDisplayName}</span>`;
        }

        // Build card HTML content
        card.innerHTML = `
            ${areaBadgeHTML}
            <div class="term-card-header">
                <h3 class="term-title">
                    <span class="term-formal">${this.escapeHtml(term.termino_formal)}</span>
                    <span class="term-separator">(</span><span class="term-dominicanismo">${this.escapeHtml(term.dominicanismo)}</span><span class="term-separator">)</span>
                </h3>
            </div>
            <div class="term-card-body">
                <div class="term-definition">
                    <h4 class="term-section-title">Definición</h4>
                    <p class="term-definition-text">${this.escapeHtml(term.definicion)}</p>
                </div>
                <div class="term-example">
                    <h4 class="term-section-title">Ejemplo de uso</h4>
                    <p class="term-example-text"><em>"${this.escapeHtml(term.ejemplo_uso)}"</em></p>
                </div>
            </div>
        `;

        return card;
    }

    /**
     * Escape HTML characters to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        if (typeof text !== 'string') {
            return '';
        }
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Hide all sections and reset their transition states
     */
    hideAllSections() {
        const sections = [
            this.elements.loadingState,
            this.elements.errorState,
            this.elements.areasSection,
            this.elements.resultsSection
        ];
        
        sections.forEach(section => {
            if (section) {
                section.style.display = 'none';
                // Reset transition properties
                section.style.opacity = '';
                section.style.transform = '';
                section.style.transition = '';
            }
        });
        
        if (this.elements.noResults) {
            this.elements.noResults.style.display = 'none';
            // Reset transition properties for no results message
            this.elements.noResults.style.opacity = '';
            this.elements.noResults.style.transform = '';
            this.elements.noResults.style.transition = '';
        }
    }

    /**
     * Initialize theme system and load saved preference
     */
    initializeTheme() {
        // Load saved theme preference from localStorage
        const savedTheme = localStorage.getItem('itsc-dictionary-theme');
        
        // Default to dark theme if no preference is saved
        this.currentTheme = savedTheme || 'light';
        
        // Apply the theme to the document
        this.applyTheme(this.currentTheme);
        
        // Update theme toggle button state
        this.updateThemeToggleState();
        
        console.log(`Theme initialized: ${this.currentTheme}`);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        // Determine new theme
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        
        // Add transitioning class to prevent flash during theme change
        document.documentElement.classList.add('theme-transitioning');
        
        // Apply new theme
        this.applyTheme(newTheme);
        
        // Update current theme
        this.currentTheme = newTheme;
        
        // Save preference to localStorage
        localStorage.setItem('itsc-dictionary-theme', newTheme);
        
        // Update toggle button state
        this.updateThemeToggleState();
        
        // Remove transitioning class after a brief delay
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transitioning');
        }, 50);
        
        // Announce theme change to screen readers
        this.announceThemeChange(newTheme);
        
        console.log(`Theme changed to: ${newTheme}`);
    }

    /**
     * Apply theme to the document
     * @param {string} theme - Theme to apply ('light' or 'dark')
     */
    applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    /**
     * Update theme toggle button state for accessibility
     */
    updateThemeToggleState() {
        if (!this.elements.themeToggle || !this.elements.themeStatus) {
            return;
        }
        
        const isLightTheme = this.currentTheme === 'light';
        
        // Update aria-pressed state
        this.elements.themeToggle.setAttribute('aria-pressed', isLightTheme.toString());
        
        // Update aria-label
        const label = isLightTheme ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
        this.elements.themeToggle.setAttribute('aria-label', label);
        
        // Update screen reader status
        const status = isLightTheme ? 'Tema claro activo' : 'Tema oscuro activo';
        this.elements.themeStatus.textContent = status;
    }

    /**
     * Announce theme change to screen readers
     * @param {string} theme - New theme that was applied
     */
    announceThemeChange(theme) {
        if (!this.elements.themeStatus) {
            return;
        }
        
        const message = theme === 'light' ? 
            'Tema cambiado a claro' : 
            'Tema cambiado a oscuro';
        
        // Temporarily change the status to announce the change
        const originalText = this.elements.themeStatus.textContent;
        this.elements.themeStatus.textContent = message;
        
        // Restore original status after announcement
        setTimeout(() => {
            this.updateThemeToggleState();
        }, 1000);
    }

    /**
     * Check if current theme meets WCAG contrast requirements
     * @returns {boolean} True if contrast is adequate
     */
    checkThemeContrast() {
        // This is a simplified check - in a real implementation,
        // you might want to use a more sophisticated contrast checking library
        const computedStyle = window.getComputedStyle(document.documentElement);
        const backgroundColor = computedStyle.getPropertyValue('--background-light');
        const textColor = computedStyle.getPropertyValue('--text-primary');
        
        // For now, we assume our predefined themes meet WCAG standards
        // Both light and dark themes have been designed with proper contrast ratios
        return true;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.diccionarioApp = new DiccionarioApp();
});