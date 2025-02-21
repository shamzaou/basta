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
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
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
                        username: document.getElementById('username').value,
                        email: document.getElementById('email').value,
                        display_name: document.getElementById('display-name').value
                    })
                });

                if (response.ok) {
                    alert('Settings saved successfully!');
                    loadProfileData(); // Refresh profile data
                } else {
                    alert('Failed to save settings');
                }
            } catch (error) {
                console.error('Error saving settings:', error);
                alert('Failed to save settings');
            }
        });
    }
    
    // Edit buttons in settings
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const fieldContainer = button.closest('.field-container');
            const input = fieldContainer.querySelector('.field-input');
            const display = fieldContainer.querySelector('.field-display');
            const isEditing = fieldContainer.classList.contains('editing');
            const fieldType = input.id; // This will be either 'username', 'email', or 'display-name'
            
            if (isEditing) {
                const newValue = input.value;
                const authToken = localStorage.getItem('authToken');
                
                // Debug logs
                console.log('Updating field:', fieldType);
                console.log('New value:', newValue);
                
                try {
                    const response = await fetch('/api/auth/profile/', {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Token ${authToken}`,
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken')
                        },
                        body: JSON.stringify({
                            [fieldType === 'display-name' ? 'display_name' : fieldType]: newValue
                        })
                    });

                    const data = await response.json();
                    console.log('Server response:', data); // Debug log
                    
                    if (response.ok) {
                        display.textContent = newValue;
                        // Update userData in localStorage
                        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
                        userData[fieldType === 'display-name' ? 'display_name' : fieldType] = newValue;
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
        avatarUpload.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                // Validate file size (5MB max)
                if (file.size > 5 * 1024 * 1024) {
                    alert('File size too large. Maximum size is 5MB.');
                    return;
                }

                // Validate file type
                if (!file.type.startsWith('image/')) {
                    alert('Please select an image file.');
                    return;
                }

                const uploadBtn = document.querySelector('.upload-btn');
                if (uploadBtn) {
                    uploadBtn.textContent = 'Uploading...';
                    uploadBtn.disabled = true;
                }

                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const base64Image = e.target.result;
                        const authToken = localStorage.getItem('authToken');
                        
                        console.log('Starting avatar upload...'); // Debug log
                        
                        const response = await fetch('/api/auth/profile/', {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Token ${authToken}`,
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCookie('csrftoken')
                            },
                            body: JSON.stringify({
                                profile_picture: base64Image
                            })
                        });

                        const data = await response.json();
                        console.log('Server response:', data); // Debug log

                        if (response.ok && data.avatar) {
                            // Update all avatar instances
                            const avatarElements = document.querySelectorAll('.profile-avatar, .nav-avatar, .current-avatar');
                            avatarElements.forEach(avatar => {
                                if (avatar) {
                                    avatar.src = data.avatar + '?t=' + new Date().getTime(); // Add timestamp to force refresh
                                    avatar.style.display = 'block'; // Ensure avatar is visible
                                    console.log('Updated avatar element:', avatar.className); // Debug log
                                }
                            });
                            
                            // Force profile page to reload avatar if we're on that page
                            if (currentPage === 'profile') {
                                loadProfileData();
                            }
                            
                            alert('Avatar updated successfully!');
                        } else {
                            throw new Error(data.message || 'Failed to update avatar');
                        }
                    } catch (error) {
                        console.error('Error updating avatar:', error);
                        alert('Failed to update avatar. Please try again.');
                    } finally {
                        if (uploadBtn) {
                            uploadBtn.textContent = 'Choose New Avatar';
                            uploadBtn.disabled = false;
                        }
                    }
                };

                reader.onerror = () => {
                    alert('Error reading file. Please try again.');
                    if (uploadBtn) {
                        uploadBtn.textContent = 'Choose New Avatar';
                        uploadBtn.disabled = false;
                    }
                };

                reader.readAsDataURL(file);
            }
        });
    }
    
    // Delete account handling with custom modal
    const deleteAccountBtn = document.getElementById('delete-account');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const cancelDeleteBtn = document.getElementById('cancel-delete');

    if (deleteAccountBtn && deleteModal) {
        // Show modal when delete button is clicked
        deleteAccountBtn.addEventListener('click', () => {
            deleteModal.style.display = 'block';
        });

        // Handle cancel button
        cancelDeleteBtn.addEventListener('click', () => {
            deleteModal.style.display = 'none';
        });

        // Handle delete confirmation
        confirmDeleteBtn.addEventListener('click', () => {
            // Get token before clearing storage
            const token = localStorage.getItem('authToken');
            
            // Hide modal
            deleteModal.style.display = 'none';
            
            // Clear storage
            localStorage.clear();
            
            // Send delete request without waiting
            fetch('/api/auth/delete-account/', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Token ${token}`,
                }
            }).catch(console.error);
            
            // Redirect immediately
            window.location.replace('/');
        });

        // Close modal if clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === deleteModal) {
                deleteModal.style.display = 'none';
            }
        });
    }

    const profileAvatar = document.getElementById('profile-avatar');
    console.log('Profile avatar element:', profileAvatar);
    console.log('Profile avatar src:', profileAvatar?.src);
});

async function loadProfileData() {
    try {
        const authToken = localStorage.getItem('authToken');
        
        if (!authToken) {
            console.error('No auth token found');
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
            console.log('Profile data loaded:', data);
            
            // Update all avatar instances
            const avatarElements = document.querySelectorAll('.profile-avatar, .nav-avatar, .current-avatar');
            avatarElements.forEach(avatar => {
                if (avatar) {
                    avatar.src = data.avatar || '/static/frontend/assets/man.png';
                    avatar.onerror = function() {
                        this.src = '/static/frontend/assets/man.png';
                    };
                }
            });

            // Update other profile elements
            const usernameElement = document.getElementById('profile-username');
            const joinedElement = document.getElementById('profile-joined');
            
            if (usernameElement) {
                usernameElement.textContent = data.username;
            }
            if (joinedElement) {
                joinedElement.textContent = data.date_joined;
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

			// Update email field in settings
			const emailContainer = document.querySelector('#email').closest('.field-container');
            const emailDisplay = emailContainer.querySelector('.field-display');
            const emailInput = document.querySelector('#email');
            
            console.log('Email from server:', data.email); // Debug log
            console.log('Found email display:', emailDisplay); // Debug log
            console.log('Found email input:', emailInput); // Debug log
            
            if (emailDisplay && data.email) {
                emailDisplay.textContent = data.email;
                console.log('Updated email display to:', data.email); // Debug log
            }
            if (emailInput && data.email) {
                emailInput.value = data.email;
                console.log('Updated email input to:', data.email); // Debug log
            }

			const displayNameContainer = document.querySelector('#display-name').closest('.field-container');
            const displayNameDisplay = displayNameContainer.querySelector('.field-display');
            const displayNameInput = document.querySelector('#display-name');
            
            if (displayNameDisplay && data.display_name) {
                displayNameDisplay.textContent = data.display_name;
            }
            if (displayNameInput && data.display_name) {
                displayNameInput.value = data.display_name;
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}