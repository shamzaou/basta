// Page navigation
// Track current page for navigation
let currentPage = 'home';

function showPage(pageId, pushState = true) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    // Handle page access permissions
    if (isLoggedIn && ['login', 'register'].includes(pageId)) {
        console.log('Redirecting to home: logged-in user attempting to access auth page');
        pageId = 'home';
    } else if (!isLoggedIn && ['profile', 'settings'].includes(pageId)) {
        console.log('Redirecting to login: non-logged-in user attempting to access protected page');
        pageId = 'login';
    }

    // Validate page exists
    const targetPage = document.getElementById(pageId);
    if (!targetPage) {
        console.error(`Page ${pageId} not found`);
        pageId = 'home'; // Fallback to home page if target doesn't exist
        targetPage = document.getElementById(pageId);
    }

    // Only push state if we're actually changing pages and pushState is true
    if (pushState && pageId !== currentPage) {
        const newUrl = pageId === 'home' ? '/' : `/${pageId}`;
        history.pushState({ pageId }, '', newUrl);
    }

    // Store current page
    currentPage = pageId;

    // Update active page in navigation
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `/${pageId}` || (pageId === 'home' && link.getAttribute('href') === '/')) {
            link.classList.add('active');
        }
    });

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    // Show target page
    targetPage.classList.add('active');
    targetPage.style.display = 'block';

    if (pageId === 'profile') {
        loadProfileData();
    }

    // Clean up any existing game
    if (window.currentGame) {
        window.currentGame.cleanup();
        window.currentGame = null;
    }

    if (pageId === 'settings') {
        loadProfileData();
        loadSettingsData();
    }

    // Handle game initializations
    initializeGameIfNeeded(pageId);
}

// Separate function for game initialization
function initializeGameIfNeeded(pageId) {
    if (pageId === 'game') {
        const modeSelection = document.getElementById('modeSelection');
        
        // Check if we're coming from a tournament match
        if (window.currentMatchId) {
            modeSelection.style.display = 'none';
            const gameContainer = document.querySelector('.game-container');
            window.currentGame = new window.PongGame(gameContainer, 'pvp');
            window.currentGame.physics.resetBall();
        } else if (modeSelection) {
            modeSelection.style.display = 'flex';
            
            const pvpButton = document.getElementById('pvpButton');
            const aiButton = document.getElementById('aiButton');
            
            if (pvpButton) {
                pvpButton.onclick = () => {
                    modeSelection.style.display = 'none';
                    const gameContainer = document.querySelector('.game-container');
                    window.currentGame = new window.PongGame(gameContainer, 'pvp');
                    window.currentGame.physics.resetBall();
                };
            }
            
            if (aiButton) {
                aiButton.onclick = () => {
                    modeSelection.style.display = 'none';
                    const gameContainer = document.querySelector('.game-container');
                    window.currentGame = new window.PongGame(gameContainer, 'ai');
                    window.currentGame.physics.resetBall();
                };
            }
        }
    } else if (pageId === 'tictactoe') {
        const gameContainer = document.querySelector('.tictactoe-container');
        if (gameContainer) {
            window.currentGame = new window.TicTacToeGame(gameContainer);
        }
    }
}

// Handle browser back/forward navigation
window.addEventListener('popstate', (event) => {
    if (!event.state) {
        // If no state exists, create one based on current URL
        const path = window.location.pathname;
        const pageId = path.substring(1) || 'home';
        history.replaceState({ pageId }, '', path);
        showPage(pageId, false);
        return;
    }

    showPage(event.state.pageId, false);
});

// Initialize history state on page load
window.addEventListener('load', () => {
    const path = window.location.pathname;
    const initialPage = path.substring(1) || 'home';
    
    // Set initial history state if it doesn't exist
    if (!history.state) {
        history.replaceState({ pageId: initialPage }, '', path);
    }
    
    showPage(initialPage, false);
    checkLoginState(); // Ensure login state is checked after page is shown
});

// Add click handler for navigation links to prevent default behavior
document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link && link.getAttribute('href')?.startsWith('/')) {
        event.preventDefault();
        const pageId = link.getAttribute('href').substring(1) || 'home';
        showPage(pageId, true);
    }
});

// Check login state and update UI accordingly
function checkLoginState() {
    console.log('Checking login state...');
    
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    console.log('isLoggedIn:', isLoggedIn);
    
    document.body.classList.remove('is-logged-in', 'is-logged-out');
    document.body.classList.add(isLoggedIn ? 'is-logged-in' : 'is-logged-out');
    
    console.log('Body classes after update:', document.body.classList.toString());
    
    // Get all nav links
    const loggedInNav = document.querySelector('.nav-links.logged-in');
    const loggedOutNav = document.querySelector('.nav-links.logged-out');
    
    if (loggedInNav) loggedInNav.style.display = isLoggedIn ? 'flex' : 'none';
    if (loggedOutNav) loggedOutNav.style.display = isLoggedIn ? 'none' : 'flex';
}

// Helper function to get CSRF token
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    try {
        const response = await fetch('/api/auth/login/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            credentials: 'include',
            body: JSON.stringify({
                email: document.getElementById('login-username').value,
                password: document.getElementById('password').value
            })
        });

        const data = await response.json();
        console.log('Login response:', data); // Debug log
        
        if (response.ok && data.token) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userData', JSON.stringify(data.user));
            localStorage.setItem('authToken', data.token);
            checkLoginState();
            showPage('home');
        } else {
            console.error('Login failed:', data.message);
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

// Handle logout
async function handleLogout() {
    try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('/api/auth/logout/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Authorization': `Token ${authToken}`
            }
        });

        if (response.ok) {
            // Clear all auth data
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userData');
            localStorage.removeItem('authToken');
            checkLoginState();
            showPage('home');
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    }
}

// Handle registration
async function handleRegister(event) {
    event.preventDefault();
    
    // First ensure we have a CSRF token
    try {
        // Get fresh CSRF token
        await fetch('/api/auth/check-auth/', {
            method: 'GET',
            credentials: 'include'
        });

        const username = document.getElementById('id_username').value;
        const email = document.getElementById('id_email').value;
        const password1 = document.getElementById('id_password1').value;
        const password2 = document.getElementById('id_password2').value;

        if (password1 !== password2) {
            alert('Passwords do not match');
            return;
        }

        const formData = {
            username,
            email,
            password1,
            password2
        };

        console.log('Sending registration data:', formData); // Debug log

        const response = await fetch('/api/auth/register/', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        console.log('Server response:', data); // Debug log

        if (response.ok) {
            alert('Registration successful!');
            showPage('login');
        } else {
            alert(data.message || data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please check the console for details.');
    }
}

// Add function to start tournament match
function startTournamentMatch(matchId) {
    // Получаем CSRF токен
    const csrftoken = getCookie('csrftoken');
    
    fetch(`/tournaments/match/${matchId}/start/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: 'include'  // Важно для передачи куки
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Store match info
            window.currentMatchId = matchId;
            window.currentMatchPlayers = {
                player1: data.player1,
                player2: data.player2
            };
            window.tournamentId = data.tournament_id;
            
            // Show game page and hide tournament view
            document.querySelectorAll('.section').forEach(section => {
                section.style.display = 'none';
            });
            
            const gameContainer = document.getElementById('game');
            if (gameContainer) {
                gameContainer.style.display = 'block';
                
                // Initialize game in PvP mode
                const pongContainer = gameContainer.querySelector('.game-container');
                window.currentGame = new window.PongGame(pongContainer, 'pvp');
                window.currentGame.physics.resetBall();
            }
        } else {
            alert(data.message || 'Failed to start match');
        }
    })
    .catch(error => {
        console.error('Error starting match:', error);
        alert('Failed to start match. Please try again.');
    });
}

// Main initialization
document.addEventListener('DOMContentLoaded', () => {

    console.log('DOM loaded, setting up event listeners');
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        console.log('Register form found, adding submit handler');
        registerForm.addEventListener('submit', handleRegister);
    } else {
        console.log('Register form not found');
    }

    // Force initial logout state
    // localStorage.removeItem('isLoggedIn');
    // localStorage.removeItem('userData');
    
    // Check login state
    checkLoginState();
    
    // Initial page load
    const path = window.location.pathname;
    const pageId = path.substring(1) || 'home';
    showPage(pageId);
    
    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Sign in button handler
    const signInButton = document.getElementById('sign-in');
    if (signInButton) {
        signInButton.addEventListener('click', handleLogin);
    }
    
    // Register button in navbar
    const registerNavLink = document.querySelector('a[href="/register"]');
    if (registerNavLink) {
        registerNavLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('register');
        });
    }
    
    // "Have no account" button in login form
    const registerButton = document.getElementById('register-btn');
    if (registerButton) {
        registerButton.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('register');
        });
    }
    
    // Register form handler
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Mobile menu handling
    const hamburger = document.getElementById('hamburger-menu');
    const navLinksLoggedIn = document.querySelector('.nav-links.logged-in');
    const navLinksLoggedOut = document.querySelector('.nav-links.logged-out');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            const navLinks = document.body.classList.contains('is-logged-in') 
                ? navLinksLoggedIn 
                : navLinksLoggedOut;
            navLinks?.classList.toggle('active');
        });
    }
    
    // Settings form handling
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Settings saved successfully!');
        });
    }
    
    // Edit buttons in settings
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const fieldContainer = button.closest('.field-container');
            const input = fieldContainer.querySelector('.field-input');
            const display = fieldContainer.querySelector('.field-display');
            const isEditing = fieldContainer.classList.contains('editing');
            const fieldType = input.id; // This will be either 'username' or 'email'
            
            if (isEditing) {
                const newValue = input.value;
                const authToken = localStorage.getItem('authToken');
                
                try {
                    const response = await fetch('/api/auth/profile/', {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Token ${authToken}`,
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken')
                        },
                        body: JSON.stringify({
                            [fieldType]: newValue
                        })
                    });

                    const data = await response.json();
                    
                    if (response.ok) {
                        display.textContent = newValue;
                        // Update userData in localStorage
                        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
                        userData[fieldType] = newValue;
                        localStorage.setItem('userData', JSON.stringify(userData));
                        alert(`${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} updated successfully!`);
                    } else {
                        alert(data.message || `Failed to update ${fieldType}`);
                        input.value = display.textContent; // Reset to original value
                    }
                } catch (error) {
                    console.error(`Error updating ${fieldType}:`, error);
                    alert(`Failed to update ${fieldType}`);
                    input.value = display.textContent; // Reset to original value
                }
                
                fieldContainer.classList.remove('editing');
                button.textContent = 'Edit';
            } else {
                fieldContainer.classList.add('editing');
                button.textContent = 'Save';
                input.focus();
            }
        });
    });
    
    // Avatar upload handling
    const avatarUpload = document.getElementById('avatar-upload');
    if (avatarUpload) {
        avatarUpload.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.querySelector('.current-avatar').src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Delete account confirmation
    const deleteAccountBtn = document.getElementById('delete-account');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                alert('Account deletion initiated...');
            }
        });
    }

    // Add logo click handler
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('home');
        });
    }

    // Add auth check for game buttons
    const playNowButton = document.getElementById('play-now-button');
    const tournamentButton = document.querySelector('a[href="/tournaments/create/"]');

    function checkAuthAndRedirect(e, destination) {
        e.preventDefault();
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        
        if (!isLoggedIn) {
            alert('Please log in to access this feature');
            showPage('login');
            return;
        }

        if (destination === 'game') {
            showPage('game');
        } else if (destination === 'tournament') {
            window.location.href = '/tournaments/create/';
        }
    }

    // Add handlers for game buttons
    if (playNowButton) {
        playNowButton.onclick = (e) => checkAuthAndRedirect(e, 'game');
    }

    if (tournamentButton) {
        tournamentButton.onclick = (e) => checkAuthAndRedirect(e, 'tournament');
    }
});

async function loadProfileData() {
    try {
        const authToken = localStorage.getItem('authToken');
        console.log('Attempting to load profile with token:', authToken); // Debug log
        
        if (!authToken) {
            console.error('No auth token found');
            showPage('login');
            return;
        }

        const response = await fetch('/api/auth/profile/', {
            method: 'GET',
            headers: {
                'Authorization': `Token ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Profile data loaded:', data);
            
            // Update UI elements
            const avatarElement = document.getElementById('profile-avatar');
            const usernameElement = document.getElementById('profile-username');
            const joinedElement = document.getElementById('profile-joined');
            
            if (avatarElement) {
                avatarElement.src = data.avatar || '/static/frontend/assets/man.png';
            }
            if (usernameElement) {
                usernameElement.textContent = data.username;
            }
            if (joinedElement) {
                joinedElement.textContent = data.date_joined;
            }
        } else {
            if (response.status === 401) {
                console.log('Token expired or invalid, redirecting to login');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('authToken');
                showPage('login');
            } else {
                console.error('Failed to load profile:', await response.text());
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function loadSettingsData() {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            showPage('login');
            return;
        }

        const response = await fetch('/api/auth/profile/', {
            method: 'GET',
            headers: {
                'Authorization': `Token ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Settings data loaded:', data);
            
            // Update username field in settings
            const usernameDisplay = document.querySelector('#settings-form .field-container .field-display');
            const usernameInput = document.querySelector('#settings-form .field-container .field-input');
            
            if (usernameDisplay && data.username) {
                usernameDisplay.textContent = data.username;
            }
            if (usernameInput && data.username) {
                usernameInput.value = data.username;
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}
