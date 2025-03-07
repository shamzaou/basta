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

    // Special handling for OAuth callback path
    if (pageId === 'oauth/callback') {
        console.log('Processing OAuth callback...');
        // Extract code from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
            // Process the code through our token exchange function
            checkOAuthLogin();
            // Redirect to home page
            pageId = 'home';
        } else {
            console.error('No code found in OAuth callback');
            pageId = 'login';
        }
    }

    // Check if this is an OAuth redirect on home page
    const urlParams = new URLSearchParams(window.location.search);
    if (pageId === 'home' && urlParams.has('code')) {
        checkOAuthLogin();
    }

    // Changed: Use let instead of const for targetPage since we need to reassign it
    let targetPage = document.getElementById(pageId);
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
        console.log('Starting game initialization...');
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            // Clear container and ensure it's visible
            gameContainer.innerHTML = '';
            gameContainer.style.display = 'block';
            
            // Initialize game without specifying mode to show selection first
            PongGame.initializeGame(gameContainer);
        } else {
            console.error('Game container not found');
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
    if (!cookieValue) {
        console.warn(`Cookie ${name} not found`);
    }
    return cookieValue;
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    try {
        const email = document.getElementById('login-username').value;  // Store email
        const password = document.getElementById('password').value;
        
        const response = await fetch('/api/auth/login/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        console.log('Login response:', data);
        
        if (response.ok) {
            if (data.requires_2fa) {
                // Store email for OTP verification
                localStorage.setItem('temp_email', email);
                console.log('Stored email for 2FA:', email);
                alert(data.message);
                
                // Show OTP modal
                document.getElementById('otp-modal').style.display = 'block';
                document.getElementById('otp-input').focus();
                
                // Clear password field for security
                document.getElementById('password').value = '';
            } else {
                // Normal login flow (no 2FA)
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('authToken', data.access_token);
                localStorage.setItem('refreshToken', data.refresh_token);  // ✅ Store refresh token
                checkLoginState();
                showPage('home');
            }
        } else {
            console.error('Login failed:', data.message);
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}


// Handle OTP verification
async function handleOTPVerification(event) {
    event.preventDefault();
    
    const otp = document.getElementById('otp-input').value;
    const email = localStorage.getItem('temp_email');

    console.log('Verifying OTP for email:', email);  // Debug log

    if (!otp || !email) {
        alert('Please enter the OTP code');
        return;
    }

    try {
        const response = await fetch('/api/auth/verify-otp/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            credentials: 'include',
            body: JSON.stringify({ email, otp })
        });

        const data = await response.json();
        console.log('OTP verification response:', data);

        if (response.ok && data.status === 'success') {
            // Clear temporary storage
            localStorage.removeItem('temp_email');
            
            // Hide OTP modal
            document.getElementById('otp-modal').style.display = 'none';
            
            // Complete login process
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userData', JSON.stringify(data.user));
            localStorage.setItem('authToken', data.access_token);
            localStorage.setItem('refreshToken', data.refresh_token);  // ✅ Store refresh token

            checkLoginState();
            showPage('home');
        } else {
            alert(data.message || 'OTP verification failed');
        }
    } catch (error) {
        console.error('OTP verification error:', error);
        alert('OTP verification failed. Please try again.');
    }
}


async function handleLogout() {
    try {
        const authToken = localStorage.getItem('authToken');

        if (authToken) {
            const response = await fetch('/api/auth/logout/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken'),
                    'Authorization': `Bearer ${authToken}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                console.warn('Logout request failed:', await response.text());
            }
        }

        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userData');
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');

        checkLoginState();
        showPage('login');

        alert('You have been logged out.');
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    }
}


// Handle registration
async function handleRegister(event) {
    event.preventDefault();
    
    // First, get CSRF token
    try {
        await fetch('/api/auth/register/', {
            method: 'GET',
            credentials: 'include',
        });
        
        const formData = {
            username: document.getElementById('id_username').value,
            email: document.getElementById('id_email').value,
            password1: document.getElementById('id_password1').value,
            password2: document.getElementById('id_password2').value,
            enable_2fa: document.getElementById('enable_2fa').checked
        };

        console.log('Sending registration data:', {
            ...formData,
            password1: '[HIDDEN]',
            password2: '[HIDDEN]'
        });

        const csrftoken = getCookie('csrftoken');
        console.log('CSRF Token:', csrftoken);

        const response = await fetch('/api/auth/register/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken,
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(formData)
        });

        console.log('Registration response status:', response.status);
        
        if (!response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const data = await response.json();
                throw new Error(data.message || 'Registration failed');
            } else {
                const text = await response.text();
                console.error('Non-JSON response:', text);
                throw new Error('Server error');
            }
        }

        const data = await response.json();
        console.log('Registration response data:', data);

        if (data.status === 'success') {
            alert('Registration successful! Please log in.');
            showPage('login');
        } else {
            alert(data.message || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert(error.message || 'Registration failed. Please try again.');
    }
}

// Add function to start tournament match
function startTournamentMatch(matchId) {
    const csrftoken = getCookie('csrftoken');
    
    fetch(`/tournaments/match/${matchId}/start/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrftoken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        credentials: 'include'
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
                const pongContainer = gameContainer.querySelector('.game-container');
                PongGame.initializeGame(pongContainer, 'pvp');
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
            const fieldType = input.id.replace('-', '_'); // Convert display-name to display_name
            
            if (isEditing) {
                const newValue = input.value;
                const authToken = localStorage.getItem('authToken');
                
                console.log('Sending update for:', fieldType);  // Debug log
                console.log('New value:', newValue);  // Debug log
                console.log('Auth token:', authToken);  // Debug log
                
                try {
                    const response = await fetch('/api/auth/profile/', {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken')
                        },
                        body: JSON.stringify({
                            [fieldType]: newValue
                        })
                    });

                    const data = await response.json();
                    console.log('Server response:', data);  // Debug log
                    
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
    // const deleteAccountBtn = document.getElementById('delete-account');
    // if (deleteAccountBtn) {
    //     deleteAccountBtn.addEventListener('click', () => {
    //         if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
    //             alert('Account deletion initiated...');
    //         }
    //     });
    // }

	async function deleteAccount() {
		if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
			return;
		}
	
		try {
			const response = await fetch('/api/auth/delete-account/', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
					'X-CSRFToken': getCookie('csrftoken')
				}
			});
	
			if (response.ok) {
				// Clear local storage
				localStorage.removeItem('authToken');
				localStorage.removeItem('userData');
				localStorage.removeItem('isLoggedIn');
				
				// Redirect to login page
				window.location.href = '/login';
				alert('Your account has been deleted successfully.');
			} else {
				const data = await response.json();
				throw new Error(data.message || 'Failed to delete account');
			}
		} catch (error) {
			console.error('Error deleting account:', error);
			alert('Failed to delete account: ' + error.message);
		}
	}
	
	// Add event listener to delete button
	document.getElementById('delete-account').addEventListener('click', deleteAccount);

    // OTP verification button
    const verifyOTPButton = document.getElementById('verify-otp');
    if (verifyOTPButton) {
        verifyOTPButton.addEventListener('click', handleOTPVerification);
    }

    // Close modal when clicking outside
    const modal = document.getElementById('otp-modal');
    if (modal) {
        window.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    }

    // OAuth button handler
    const loginWith42Button = document.getElementById('login-42');
    if (loginWith42Button) {
        loginWith42Button.addEventListener('click', initiate42OAuth);
    }

    // // Add tournament button handler
    // const tournamentButton = document.getElementById('tournament-button');
    // if (tournamentButton) {
    //     tournamentButton.addEventListener('click', (e) => {
    //         e.preventDefault();
    //         if (localStorage.getItem('isLoggedIn') === 'true') {
    //             showPage('tournament');
    //         } else {
    //             alert('Please log in to create or join tournaments');
    //             showPage('login');
    //         }
    //     });
    // }
    // Tournament button handling
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
    // Add tournament form handler
    const tournamentForm = document.getElementById('tournament-form');
    if (tournamentForm) {
        tournamentForm.addEventListener('submit', handleTournamentCreation);
    }
});

async function initiate42OAuth() {
    try {
        console.log("Initiating OAuth flow...");
        
        // Clear any existing OAuth data to ensure a fresh flow
        localStorage.removeItem('oauth_state');
        localStorage.removeItem('oauth_pending');
        
        const response = await fetch('/api/auth/redirect_uri/', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            credentials: 'include'
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("OAuth API Error:", data);
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        console.log("OAuth API Response:", data);

        if (data.oauth_link) {
            // Mark that we're starting OAuth flow
            localStorage.setItem('oauth_pending', 'true');
            
            // Force navigation to 42's authorization page
            console.log("Redirecting to:", data.oauth_link);
            window.location.href = data.oauth_link;
        } else {
            throw new Error('No OAuth link received');
        }
    } catch (error) {
        console.error('OAuth Initiation Error:', error);
        alert('Failed to initiate OAuth login. Please try again.');
    }
}

// Update the OAuth login function to ensure redirect to homepage
async function checkOAuthLogin() {
    console.log("Checking OAuth login status...");

    // Get the authorization code from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (!code) {
        console.log("No OAuth code found in URL");
        return Promise.resolve();
    }

    console.log("OAuth code found, exchanging for token...");

    // Clear the URL parameters without reloading the page
    window.history.replaceState({}, document.title, window.location.pathname);

    try {
        const response = await fetch('/api/auth/get-token/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            credentials: 'include',
            body: JSON.stringify({ code: code }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Token endpoint error:', response.status, errorText);
            throw new Error('Authentication failed: ' + response.status);
        }

        const data = await response.json();
        console.log("Token received successfully:", data);

        if (data.access_token) {
            localStorage.setItem('authToken', data.access_token);
        } else {
            console.warn("No access token found in response!");
        }

        if (data.refresh_token) {
            localStorage.setItem('refreshToken', data.refresh_token);
        } else {
            console.warn("No refresh token found in response!");
        }

        localStorage.setItem('userData', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');

        scheduleTokenRefresh();

        checkLoginState();

        // ✅ Redirect after a short delay to ensure UI update
        setTimeout(() => {
            console.log("Redirecting to home page after successful OAuth login");
            window.location.href = '/';  // Use direct navigation instead of showPage
        }, 100);

        return true;
    } catch (error) {
        console.error("OAuth Login Error:", error);
        showPage('login');
        return false;
    }
}

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
                'Authorization': `Bearer ${authToken}`,
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

            // Update stats 
            document.querySelector('.stat-card:nth-child(1) .stat-value').textContent = data.stats.games_played;
            document.querySelector('.stat-card:nth-child(2) .stat-value').textContent = data.stats.win_rate;
            document.querySelector('.stat-card:nth-child(3) .stat-value').textContent = data.stats.best_score;
            
            // Update match history
            const matchHistoryContainer = document.querySelector('.match-history');
            // Clear existing match cards except the title
            const title = matchHistoryContainer.querySelector('h2');
            matchHistoryContainer.innerHTML = '';
            matchHistoryContainer.appendChild(title);
            
            if (data.match_history && data.match_history.length > 0) {
                data.match_history.forEach(match => {
                    const matchCard = document.createElement('div');
                    matchCard.className = 'match-card';
                    
                    const opponent = document.createElement('span');
                    opponent.textContent = `vs. ${match.opponent}`;
                    
                    const score = document.createElement('span');
                    score.textContent = match.score;
                    
                    const result = document.createElement('span');
                    result.className = `match-result ${match.result === 'WIN' ? 'win' : 'loss'}`;
                    result.textContent = match.result;
                    
                    matchCard.appendChild(opponent);
                    matchCard.appendChild(score);
                    matchCard.appendChild(result);
                    
                    matchHistoryContainer.appendChild(matchCard);
                });
            } else {
                const noMatches = document.createElement('p');
                noMatches.textContent = 'No matches played yet.';
                matchHistoryContainer.appendChild(noMatches);
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
                'Authorization': `Bearer ${authToken}`,
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

// Add this function to handle tournament creation
async function handleTournamentCreation(event) {
    event.preventDefault();

    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        alert('Please log in to create a tournament');
        showPage('login');
        return;
    }

    const tournamentName = document.getElementById('tournament-name').value;
    const playerCount = document.getElementById('player-count').value;

    try {
        const response = await fetch('/api/tournaments/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                name: tournamentName,
                player_count: parseInt(playerCount)
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Tournament created successfully!');
            // You can add additional logic here to show the tournament details
            // or redirect to a tournament view page
        } else {
            alert(data.message || 'Failed to create tournament');
        }
    } catch (error) {
        console.error('Error creating tournament:', error);
        alert('Failed to create tournament. Please try again.');
    }
}

async function getAccessToken() {
    let token = localStorage.getItem("authToken");

    if (!token) return null;

    try {
        // Decode JWT to check expiry
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isExpired = payload.exp * 1000 < Date.now();

        if (isExpired) {
            console.log("Access token expired, refreshing...");
            return await refreshAccessToken();
        }

        return token;
    } catch (error) {
        console.error("Invalid token format:", error);
        return null;
    }
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
        console.error("No refresh token available, user needs to log in again.");
        return null;
    }

    try {
        const response = await fetch('/api/token/refresh/', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken })
        });

        if (!response.ok) {
            throw new Error("Failed to refresh token");
        }

        const data = await response.json();
        console.log("Token refreshed successfully:", data);

        localStorage.setItem("authToken", data.access);

        return data.access;
    } catch (error) {
        console.error("Failed to refresh token:", error);
        logout();  // Log the user out if refresh fails
        return null;
    }
}

function scheduleTokenRefresh() {
    let token = localStorage.getItem("authToken");

    if (!token) return;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresInMs = (payload.exp * 1000) - Date.now();
        const refreshTime = expiresInMs - 60000; // Refresh 1 min before expiry

        if (refreshTime > 0) {
            console.log(`Scheduling token refresh in ${refreshTime / 1000} seconds`);
            setTimeout(refreshAccessToken, refreshTime);
        }
    } catch (error) {
        console.error("Error scheduling token refresh:", error);
    }
}



