// Configuration
const config = {
    API_BASE_URL: 'http://localhost:5000' // Local Flask server URL
};

// Utility function for API calls
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        console.log('Making API call to:', endpoint);
        console.log('Method:', method);
        console.log('Data:', data);

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include'  // Include credentials for session support
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${config.API_BASE_URL}${endpoint}`, options);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
            console.error('API error:', errorData);
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        // For file downloads
        if (response.headers.get('content-type')?.includes('application/')) {
            return response;
        }

        // For JSON responses
        const jsonResponse = await response.json();
        console.log('API response:', jsonResponse);
        return jsonResponse;
    } catch (error) {
        console.error(`API call failed: ${error.message}`);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                window.scrollTo({
                    top: targetSection.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // YouTube Video Submission Functionality
    const videosList = document.getElementById('videos-list');
    const addMoreBtn = document.getElementById('add-more-btn');
    const submitAllBtn = document.getElementById('submit-all-btn');
    const linkTypeSelect = document.getElementById('link-type');
    const languageSelect = document.getElementById('language-select');
    const heroSubmitBtn = document.getElementById('hero-submit-btn');
    const modal = document.getElementById('submission-success-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const closeModalX = document.querySelector('.close-modal');
    const resultsSection = document.getElementById('results-section');
    const videoResults = document.getElementById('video-results');
    const videoTemplate = document.getElementById('video-result-template');
    
    // Connect hero button to the submit videos section
    if (heroSubmitBtn) {
        heroSubmitBtn.addEventListener('click', () => {
            const submitVideosSection = document.getElementById('submit-videos');
            if (submitVideosSection) {
                window.scrollTo({
                    top: submitVideosSection.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    }
    
    // Function to create a new video entry row
    function createVideoRow(index) {
        const row = document.createElement('div');
        row.className = 'table-row';
        row.innerHTML = `
            <div class="col-index">${index}</div>
            <div class="col-link">
                <input type="url" class="video-url" placeholder="Paste YouTube URL here" required>
            </div>
            <div class="col-action">
                <button class="remove-btn" onclick="this.closest('.table-row').remove(); updateRowNumbers();">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        return row;
    }

    // Add initial video row
    videosList.appendChild(createVideoRow(1));

    // Update row numbers
    function updateRowNumbers() {
        const rows = videosList.querySelectorAll('.table-row');
        rows.forEach((row, index) => {
            row.querySelector('.col-index').textContent = index + 1;
        });
    }
    
    // Handle link type change
    linkTypeSelect.addEventListener('change', () => {
        const isPlaylist = linkTypeSelect.value === 'playlist';
        
        // Clear existing rows
        videosList.innerHTML = '';
        
        // Add one row
        videosList.appendChild(createVideoRow(1));
        
        // Update UI based on selection
        addMoreBtn.style.display = isPlaylist ? 'none' : 'flex';
        
        // Update placeholders
        const urlInput = videosList.querySelector('.video-url');
        urlInput.placeholder = isPlaylist ? 'Paste YouTube Playlist URL here' : 'Paste YouTube Video URL here';
        
        // Hide results when changing type
        resultsSection.style.display = 'none';
        videoResults.innerHTML = '';
    });

    // Add More button functionality
    addMoreBtn.addEventListener('click', () => {
        if (linkTypeSelect.value === 'video') {
            const newIndex = videosList.children.length + 1;
            videosList.appendChild(createVideoRow(newIndex));
        }
    });

    // Create video result tab
    function createVideoTab(videoData) {
        console.log('Creating video tab for:', videoData);
        
        // Create a new div for the video result
        const videoResult = document.createElement('div');
        videoResult.className = 'video-result';
        
        // Create the tab header
        const tabHeader = document.createElement('div');
        tabHeader.className = 'tab-header';
        tabHeader.innerHTML = `
            <h3 class="video-title">${videoData.title || 'Untitled Video'}</h3>
            <button class="toggle-btn"><i class="fas fa-chevron-down"></i></button>
        `;
        
        // Create the tab content
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        tabContent.innerHTML = `
            <div class="content-section">
                <h4>Video</h4>
                <div class="video-embed">
                    <div class="video-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Loading video...</span>
                    </div>
                </div>
            </div>
            <div class="content-section">
                <h4>Summary</h4>
                <p class="summary-text">${videoData.summary || 'No summary available'}</p>
            </div>
            <div class="content-section">
                <h4>Translation</h4>
                <p class="translation-text">${videoData.translated_summary || ''}</p>
            </div>
            <div class="content-section">
                <h4>TL;DW</h4>
                <div class="tldw-text"></div>
                <button class="highlight-btn"><i class="fas fa-film"></i><span class="highlight-text">Generate TL;DW</span></button>
                <button class="download-highlight-btn" style="display: none;"><i class="fas fa-download"></i> Download TL;DW</button>
            </div>
        `;
        
        // Set up video embed
        const videoEmbed = tabContent.querySelector('.video-embed');
        let videoId = videoData.videoId;
        
        // Extract video ID if it's a full URL
        if (videoId && (videoId.includes('youtube.com') || videoId.includes('youtu.be'))) {
            const extracted = extractYouTubeId(videoId);
            videoId = extracted.videoId;
        }
        
        if (videoId) {
            // Create iframe with error handling and privacy-enhanced mode
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0`;
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            iframe.title = videoData.title || 'YouTube video';
            iframe.loading = 'lazy';
            
            // Add fallback content
            const fallbackContent = document.createElement('div');
            fallbackContent.className = 'video-fallback';
            fallbackContent.innerHTML = `
                <div class="fallback-content">
                    <i class="fas fa-play-circle"></i>
                    <p>Click to watch on YouTube</p>
                </div>
            `;
            
            // Handle iframe load
            iframe.onload = () => {
                const loadingElement = videoEmbed.querySelector('.video-loading');
                if (loadingElement) {
                    loadingElement.remove();
                }
            };
            
            // Handle iframe error
            iframe.onerror = () => {
                const loadingElement = videoEmbed.querySelector('.video-loading');
                if (loadingElement) {
                    loadingElement.remove();
                }
                videoEmbed.appendChild(fallbackContent);
                
                // Add click handler to open video in new tab
                fallbackContent.addEventListener('click', () => {
                    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
                });
            };
            
            // Add click handler for fallback
            fallbackContent.addEventListener('click', () => {
                window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
            });
            
            videoEmbed.appendChild(iframe);
        } else {
            const loadingElement = videoEmbed.querySelector('.video-loading');
            if (loadingElement) {
                loadingElement.innerHTML = `
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Invalid video ID</span>
                `;
                loadingElement.classList.add('error');
            }
        }
        
        // Only show translation section if we have a translation
        const translationSection = tabContent.querySelector('.content-section:nth-child(3)');
        if (translationSection) {
            translationSection.style.display = videoData.translated_summary ? 'block' : 'none';
        }
        
        // Set up highlight video button
        const highlightBtn = tabContent.querySelector('.highlight-btn');
        const downloadHighlightBtn = tabContent.querySelector('.download-highlight-btn');
        
        if (highlightBtn) {
            highlightBtn.addEventListener('click', async () => {
                try {
                    highlightBtn.disabled = true;
                    highlightBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing...';
                    
                    const response = await fetch('/highlight', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            video_url: `https://www.youtube.com/watch?v=${videoId}`
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to generate highlight video');
                    }

                    const blob = await response.blob();
                    const videoUrl = window.URL.createObjectURL(blob);
                    
                    const videoElement = document.createElement('video');
                    videoElement.controls = true;
                    videoElement.style.width = '100%';
                    videoElement.style.marginTop = '15px';
                    videoElement.style.borderRadius = '8px';
                    
                    const sourceElement = document.createElement('source');
                    sourceElement.src = videoUrl;
                    sourceElement.type = 'video/mp4';
                    
                    videoElement.appendChild(sourceElement);
                    
                    const tldwSection = tabContent.querySelector('.tldw-text');
                    tldwSection.innerHTML = '';
                    tldwSection.appendChild(videoElement);
                    
                    downloadHighlightBtn.style.display = 'inline-flex';
                    
                    downloadHighlightBtn.onclick = () => {
                        const a = document.createElement('a');
                        a.href = videoUrl;
                        a.download = `highlight_${videoId}.mp4`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    };
                    
                    highlightBtn.innerHTML = '<i class="fas fa-check"></i> TL;DW Generated!';
                    highlightBtn.style.background = '#4CAF50';
                    highlightBtn.style.color = 'white';
                    
                    setTimeout(() => {
                        highlightBtn.innerHTML = '<i class="fas fa-film"></i><span class="highlight-text">Generate TL;DW</span>';
                        highlightBtn.style.background = 'white';
                        highlightBtn.style.color = 'black';
                        highlightBtn.disabled = false;
                    }, 2000);
                    
                    videoElement.addEventListener('removed', () => {
                        window.URL.revokeObjectURL(videoUrl);
                    });
                    
                    if (tabContent.classList.contains('active')) {
                        tabContent.style.maxHeight = tabContent.scrollHeight + 'px';
                    }
                } catch (error) {
                    console.error('Error generating TL;DW:', error);
                    highlightBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error Generating';
                    highlightBtn.style.background = '#ff4444';
                    highlightBtn.style.color = 'white';
                    
                    setTimeout(() => {
                        highlightBtn.innerHTML = '<i class="fas fa-film"></i><span class="highlight-text">Generate TL;DW</span>';
                        highlightBtn.style.background = 'white';
                        highlightBtn.style.color = 'black';
                        highlightBtn.disabled = false;
                    }, 2000);
                }
            });
        }
        
        // Set up toggle functionality
        tabHeader.addEventListener('click', () => {
            const isActive = tabContent.classList.contains('active');
            tabContent.classList.toggle('active');
            tabHeader.querySelector('.toggle-btn').classList.toggle('active');
            
            if (isActive) {
                tabContent.style.maxHeight = '0';
            } else {
                tabContent.style.maxHeight = tabContent.scrollHeight + 'px';
            }
        });
        
        // Assemble the video result
        videoResult.appendChild(tabHeader);
        videoResult.appendChild(tabContent);
        
        return videoResult;
    }
    async function downloadHighlight(videoUrl) {
        try {
            const response = await apiCall('/highlight', 'POST', { video_url: videoUrl });
            const blob = await response.blob();
            const link = document.createElement("a");
            link.href = window.URL.createObjectURL(blob);
            link.download = "highlight.mp4";
            link.click();
        } catch (error) {
            console.error('Error downloading highlight:', error);
            throw error;
        }
    }
    
    // Extract YouTube video ID
    function extractYouTubeId(url) {
        if (!url) return { videoId: null, playlistId: null };
        
        try {
            // Handle various YouTube URL formats
            const patterns = {
                video: [
                    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
                    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
                    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
                    /youtube\.com\/watch\?.*&v=([a-zA-Z0-9_-]{11})/
                ],
                playlist: [
                    /youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/,
                    /youtube\.com\/watch\?.*&list=([a-zA-Z0-9_-]+)/
                ]
            };

            // Check for video ID
            for (const pattern of patterns.video) {
                const match = url.match(pattern);
                if (match) {
                    return { videoId: match[1], playlistId: null };
                }
            }

            // Check for playlist ID
            for (const pattern of patterns.playlist) {
                const match = url.match(pattern);
                if (match) {
                    return { videoId: null, playlistId: match[1] };
                }
            }

            // Check if it's already a video ID
            if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
                return { videoId: url, playlistId: null };
            }

            return { videoId: null, playlistId: null };
        } catch (error) {
            console.error('Error extracting YouTube ID:', error);
            return { videoId: null, playlistId: null };
        }
    }

    // Validate YouTube URL
    function isValidYouTubeUrl(url, type) {
        if (!url) return false;
        
        try {
            const { videoId, playlistId } = extractYouTubeId(url);
            
            if (type === 'video') {
                return videoId !== null;
            } else {
                return playlistId !== null;
            }
        } catch (error) {
            console.error('Error validating YouTube URL:', error);
            return false;
        }
    }
    
    async function processVideo(videoId) {
        const selectedLanguage = languageSelect.value;
        try {
            console.log('Processing video:', videoId);
            
            const response = await fetch(`${config.API_BASE_URL}/summarize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    links: [`https://youtu.be/${videoId}`],
                    language: selectedLanguage
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Received result:', result);  // Debug log

            if (!result || !Array.isArray(result)) {
                console.error('Invalid result format:', result);  // Debug log
                throw new Error('Invalid response format from server');
            }

            const videoData = result[0];  // Get first video result
            console.log('Video data:', videoData);  // Debug log
            
            if (!videoData || typeof videoData !== 'object') {
                console.error('Invalid video data:', videoData);
                throw new Error('Invalid video data format');
            }
            
            return {
                videoId: videoId,
                title: videoData.title || 'Unknown Title',
                summary: videoData.summary || 'No summary available',
                translated_summary: videoData.translated_summary || '',
                language: selectedLanguage
            };
        } catch (error) {
            console.error('Error processing video:', error);
            throw error;
        }
    }
    


    // Submit All button functionality
    submitAllBtn.addEventListener('click', async () => {
        console.log('Submit button clicked - Starting video processing');
        console.log('Selected language:', languageSelect.value);
        
        // Disable the submit button
        submitAllBtn.disabled = true;
        submitAllBtn.style.opacity = '0.5';
        submitAllBtn.style.cursor = 'not-allowed';
        
        const type = linkTypeSelect.value;
        const urls = Array.from(document.querySelectorAll('.video-url'))
            .map(input => input.value.trim())
            .filter(url => url !== '');

        console.log('Processing URLs:', urls);
        console.log('Link type:', type);

        if (urls.length === 0) {
            console.warn('No URLs provided');
            alert('Please add at least one URL');
            submitAllBtn.disabled = false;
            submitAllBtn.style.opacity = '1';
            submitAllBtn.style.cursor = 'pointer';
            return;
        }

        // Show loading state
        resultsSection.style.display = 'block';
        videoResults.innerHTML = '<div class="loading"></div>';

        try {
            console.log('Sending request to summarize API');
            
            // Process all URLs, whether they're individual videos or playlists
            const response = await fetch(`${config.API_BASE_URL}/summarize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    links: urls,
                    language: languageSelect.value
                })
            });

            console.log('Received response status:', response.status);
            
            if (!response.ok) {
                console.error('API request failed:', response.status);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            console.log('Received results from API:', results);

            if (!results || !Array.isArray(results)) {
                console.error('Invalid result format:', results);
                throw new Error('Invalid response format from server');
            }

            // Clear loading and show results
            videoResults.innerHTML = '';
            console.log('Creating video tabs for results');
            
            results.forEach((videoData, index) => {
                console.log(`Processing video ${index + 1}:`, videoData);
                const videoTab = createVideoTab(videoData);
                if (videoTab) {
                    videoResults.appendChild(videoTab);
                }
            });

            // Update tab content based on language selection
            const translationSections = document.querySelectorAll('.content-section:has(.translation-text)');
            console.log('Updating translation sections visibility');
            translationSections.forEach(section => {
                section.style.display = languageSelect.value === 'English' ? 'none' : 'block';
            });
            
            console.log('Video processing completed successfully');
            
            // Re-enable the submit button after successful processing
            submitAllBtn.disabled = false;
            submitAllBtn.style.opacity = '1';
            submitAllBtn.style.cursor = 'pointer';
            
        } catch (error) {
            console.error('Error processing videos:', error);
            console.error('Error stack:', error.stack);
            videoResults.innerHTML = `
                <div class="error-message">
                    <h3>Error Processing Videos</h3>
                    <p>${error.message}</p>
                    <p>Please check your internet connection and try again.</p>
                    <p>If the problem persists, please check the console for more details.</p>
                </div>
            `;
            // Re-enable the button if there's an error
            submitAllBtn.disabled = false;
            submitAllBtn.style.opacity = '1';
            submitAllBtn.style.cursor = 'pointer';
        }
    });
    
    // Language selection change handler
    languageSelect.addEventListener('change', () => {
        const translationSections = document.querySelectorAll('.content-section:has(.translation-text)');
        const isEnglish = languageSelect.value === 'English';
        
        translationSections.forEach(section => {
            section.style.display = isEnglish ? 'none' : 'block';
        });
    });
    
    // Close modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideModal);
    }
    
    if (closeModalX) {
        closeModalX.addEventListener('click', hideModal);
    }
    
    // Close modal when clicking outside of it
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });
    
    // Initialize first row with remove button disabled
    enableRemoveButtons();
    
    // Function to add new video row
    function addVideoRow() {
        const newRow = document.createElement('div');
        newRow.className = 'table-row';
        newRow.innerHTML = `
            <div class="col-index">${videosList.children.length + 1}</div>
            <div class="col-link">
                <input type="url" class="video-url" placeholder="Paste YouTube URL here" required>
            </div>
            <div class="col-action">
                <button class="remove-btn"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        
        videosList.appendChild(newRow);
        
        // Add event listener to the new remove button
        const newRemoveBtn = newRow.querySelector('.remove-btn');
        newRemoveBtn.addEventListener('click', () => {
            newRow.remove();
            updateRowNumbers();
            enableRemoveButtons();
        });
        
        // Add event listener to detect video title
        const newUrlInput = newRow.querySelector('.video-url');
        newUrlInput.addEventListener('input', debounce(function() {
            if (isValidYouTubeUrl(this.value, linkTypeSelect.value)) {
                const videoId = extractYouTubeId(this.value);
                if (videoId) {
                    fetchVideoTitle(videoId, newRow.querySelector('.col-title'));
                }
            }
        }, 500));
    }
    
    // Enable/disable remove buttons based on row count
    function enableRemoveButtons() {
        const rows = videosList.querySelectorAll('.table-row');
        const removeButtons = videosList.querySelectorAll('.remove-btn');
        
        removeButtons.forEach(btn => {
            if (rows.length > 1) {
                btn.removeAttribute('disabled');
            } else {
                btn.setAttribute('disabled', 'disabled');
            }
        });
    }
    
    // Show modal
    function showModal() {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';  // Prevent scrolling behind modal
    }
    
    // Hide modal
    function hideModal() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        document.getElementById('email-submission').value = '';
        const videoRows = document.querySelectorAll('.table-row');
        if (videoRows.length > 1) {
            for (let i = 1; i < videoRows.length; i++) {
                videoRows[i].remove();
            }
        }
        document.querySelector('.video-url').value = '';
        updateRowNumbers();
        enableRemoveButtons();
    }
    
    // Save submission to localStorage
    function saveSubmission(email, urls) {
        const submissions = JSON.parse(localStorage.getItem('submissions') || '[]');
        submissions.push({
            email,
            urls,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('submissions', JSON.stringify(submissions));
        
        // Update the submission history display
        updateSubmissionHistory();
    }
    
    // Update submission history display
    function updateSubmissionHistory() {
        const submissionHistory = document.querySelector('.submission-history');
        if (!submissionHistory) return;
        
        const submissions = JSON.parse(localStorage.getItem('submissions') || '[]');
        
        if (submissions.length === 0) {
            submissionHistory.innerHTML = '<p>You haven\'t submitted any videos yet.</p>';
            return;
        }
        
        // Get latest 3 submissions, reversed chronologically
        const recentSubmissions = submissions.slice(-3).reverse();
        
        let html = '';
        recentSubmissions.forEach(sub => {
            const date = new Date(sub.timestamp);
            const formattedDate = `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
            html += `
                <div class="history-item">
                    <p class="history-date">${formattedDate}</p>
                    <p class="history-count">${sub.urls.length} video${sub.urls.length !== 1 ? 's' : ''} submitted</p>
                </div>
            `;
        });
        
        submissionHistory.innerHTML = html;
    }
    
    // Load submission history on page load
    updateSubmissionHistory();
    
    // Utility function to debounce input events
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    // Testimonial slider functionality
    const testimonials = document.querySelectorAll('.testimonial');
    const dots = document.querySelectorAll('.dot');
    let currentTestimonial = 0;
    
    // Function to show a specific testimonial
    function showTestimonial(index) {
        testimonials.forEach((testimonial, i) => {
            testimonial.style.transform = `translateX(${100 * (i - index)}%)`;
        });
        
        // Update active dot
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }
    
    // Initialize testimonials position
    testimonials.forEach((testimonial, i) => {
        testimonial.style.transform = `translateX(${100 * i}%)`;
    });
    
    // Add click event to dots
    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
            currentTestimonial = i;
            showTestimonial(currentTestimonial);
        });
    });
    
    // Auto slide testimonials every 5 seconds
    setInterval(() => {
        currentTestimonial = (currentTestimonial + 1) % testimonials.length;
        showTestimonial(currentTestimonial);
    }, 5000);
    
    // Mobile menu toggle
    const createMobileMenu = () => {
        const nav = document.querySelector('nav');
        if (!nav) {
            console.log('Navigation element not found');
            return;
        }
        
        // Create mobile menu button if it doesn't exist
        if (!document.querySelector('.mobile-menu-btn')) {
            const mobileMenuBtn = document.createElement('div');
            mobileMenuBtn.classList.add('mobile-menu-btn');
            mobileMenuBtn.innerHTML = '<span></span><span></span><span></span>';
            nav.prepend(mobileMenuBtn);
            
            mobileMenuBtn.addEventListener('click', () => {
                if (nav) {
                    nav.classList.toggle('mobile-menu-open');
                }
            });
        }
    };
    
    // Call createMobileMenu on window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            createMobileMenu();
        }
    });
    
    // Initial call for mobile menu
    if (window.innerWidth <= 768) {
        createMobileMenu();
    }
    
    // Legacy video submission form handling (keeping this for compatibility)
    const setupVideoSubmissionForm = () => {
        const exploreBtn = document.querySelector('.cta-btn');
        const ctaSection = document.querySelector('#cta');
        
        if (exploreBtn && ctaSection && exploreBtn.textContent.includes('Get Started')) {
            exploreBtn.addEventListener('click', () => {
                const submitVideosSection = document.getElementById('submit-videos');
                if (submitVideosSection) {
                    window.scrollTo({
                        top: submitVideosSection.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            });
        }
    };
    
    // Call setupVideoSubmissionForm
    setupVideoSubmissionForm();
    
    // Animation for elements as they come into view
    const observeElements = () => {
        const elements = document.querySelectorAll('.feature-card, .category, .video-card, .step, .pricing-card');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1
        });
        
        elements.forEach(element => {
            observer.observe(element);
        });
    };
    
    // Call observeElements
    observeElements();
    
    // Add CSS for new JavaScript functionality
    const addDynamicStyles = () => {
        const dynamicStyles = document.createElement('style');
        dynamicStyles.textContent = `
            .sticky {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                background: var(--primary-color);
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                padding: 10px 5% !important;
                transition: all 0.3s ease;
            }
            
            .mobile-menu-btn {
                display: none;
            }
            
            @media (max-width: 768px) {
                .mobile-menu-btn {
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    width: 30px;
                    height: 20px;
                    cursor: pointer;
                    z-index: 1001;
                }
                
                .mobile-menu-btn span {
                    width: 100%;
                    height: 3px;
                    background-color: white;
                    border-radius: 3px;
                    transition: all 0.3s ease;
                }
                
                nav:not(.mobile-menu-open) .nav-links,
                nav:not(.mobile-menu-open) .search-bar,
                nav:not(.mobile-menu-open) .auth-buttons {
                    display: none;
                }
                
                nav.mobile-menu-open {
                    flex-direction: column;
                    align-items: center;
                    background-color: var(--primary-color);
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100vh;
                    z-index: 1000;
                    padding: 20px;
                }
                
                nav.mobile-menu-open .nav-links {
                    flex-direction: column;
                    margin-top: 50px;
                    align-items: center;
                }
                
                nav.mobile-menu-open .nav-links a {
                    font-size: 1.5rem;
                    margin-bottom: 20px;
                }
                
                nav.mobile-menu-open .search-bar,
                nav.mobile-menu-open .auth-buttons {
                    margin-top: 30px;
                }
            }
            
            .history-item {
                padding: 10px 0;
                border-bottom: 1px solid var(--border-color);
            }
            
            .history-item:last-child {
                border-bottom: none;
            }
            
            .history-date {
                font-size: 0.85rem;
                color: var(--primary-color);
                margin-bottom: 5px;
            }
            
            .history-count {
                font-size: 0.95rem;
            }
            
            .testimonial {
                transition: transform 0.5s ease-in-out;
            }
            
            .feature-card, .category, .video-card, .step, .pricing-card {
                opacity: 0;
                transform: translateY(20px);
                transition: opacity 0.5s ease, transform 0.5s ease;
            }
            
            .feature-card.visible, .category.visible, .video-card.visible, .step.visible, .pricing-card.visible {
                opacity: 1;
                transform: translateY(0);
            }

            .progress-container {
                margin-top: 10px;
                width: 100%;
            }

            .progress-bar {
                width: 100%;
                height: 6px;
                background-color: #e0e0e0;
                border-radius: 3px;
                overflow: hidden;
            }

            .progress-fill {
                width: 0%;
                height: 100%;
                background-color: var(--primary-color);
                transition: width 0.3s ease;
            }

            .progress-text {
                margin-top: 5px;
                font-size: 0.9rem;
                color: var(--text-color);
                text-align: center;
            }
        `;
        
        document.head.appendChild(dynamicStyles);
    };
    
    // Call addDynamicStyles
    addDynamicStyles();

    // Add download button functionality
    const downloadBtn = document.querySelector('.download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            try {
                // Get all video results
                const videoResults = document.querySelectorAll('.video-result');
                const summaries = Array.from(videoResults).map(result => {
                    return {
                        title: result.querySelector('.video-title').textContent,
                        summary: result.querySelector('.summary-text').textContent,
                        translated_summary: result.querySelector('.translation-text').textContent,
                        videoId: result.querySelector('.video-embed iframe').src.split('/').pop(),
                        language: document.querySelector('#language-select').value
                    };
                });

                // Send POST request to download endpoint
                const response = await fetch(`${config.API_BASE_URL}/download_docx`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(summaries)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // Get the blob from the response
                const blob = await response.blob();
                
                // Create a download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'summaries.docx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();

            } catch (error) {
                console.error('Error downloading document:', error);
                alert('Failed to download document. Please try again.');
            }
        });
    }
});

// DOCX download
async function generateDOCX() {
    try {
        const response = await apiCall('/download_docx');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate Word document');
        }
        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = "summary.docx";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Error generating DOCX:', error);
        alert('Failed to generate Word document. Please try again.');
    }
}

