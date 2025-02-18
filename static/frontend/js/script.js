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

    // Clean up any existing game
    if (window.currentGame) {
        window.currentGame.cleanup();
        window.currentGame = null;
    }

    // Handle game initializations
    initializeGameIfNeeded(pageId);
}

// Separate function for game initialization
function initializeGameIfNeeded(pageId) {
    if (pageId === 'game') {
        const modeSelection = document.getElementById('modeSelection');
        if (modeSelection) {
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
    
    const email = document.getElementById('login-username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/auth/login/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include'  // Ensure cookies are included in the request
        });

        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userData', JSON.stringify(data.user));
            checkLoginState();
            showPage('home');
        } else {
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
        const response = await fetch('/api/auth/logout/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        });

        if (response.ok) {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userData');
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
        button.addEventListener('click', () => {
            const fieldContainer = button.closest('.field-container');
            const isEditing = fieldContainer.classList.contains('editing');
            
            if (isEditing) {
                const input = fieldContainer.querySelector('.field-input');
                const display = fieldContainer.querySelector('.field-display');
                display.textContent = input.value;
                fieldContainer.classList.remove('editing');
                button.textContent = 'Edit';
                button.classList.remove('save');
            } else {
                fieldContainer.classList.add('editing');
                button.textContent = 'Save';
                button.classList.add('save');
                fieldContainer.querySelector('.field-input').focus();
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
});