// static/frontend/js/script.js

// Page navigation
// Track current page for navigation
// scripts.js

// Page navigation
let currentPage = 'home';
// Tournament-specific variables
let currentTournamentId = null; // Хранит ID текущего турнира
let participantCount = 0;       // Хранит количество участников

function showPage(pageId, pushState = true) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    // Перенаправление при необходимости
    if (isLoggedIn && ['login', 'register'].includes(pageId)) {
        pageId = 'home';
    } else if (!isLoggedIn && ['profile', 'settings'].includes(pageId)) {
        pageId = 'login';
    }

// <<<<<<< master
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
// =======
    // Проверка OAuth
    if (pageId === 'home' && window.location.pathname === '/home') {
        checkOAuthLogin();
    }

    // Проверяем, существует ли вообще такой div
// >>>>>>> 8ec6d59
    let targetPage = document.getElementById(pageId);
    if (!targetPage) {
        console.error(`Page ${pageId} not found`);
        pageId = 'home';
        targetPage = document.getElementById(pageId);
    }

    // Работаем с history
    if (pushState && pageId !== currentPage) {
        const newUrl = pageId === 'home' ? '/' : `/${pageId}`;
        history.pushState({ pageId }, '', newUrl);
    }

    currentPage = pageId;

    // Обновляем активную ссылку
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `/${pageId}` || (pageId === 'home' && link.getAttribute('href') === '/')) {
            link.classList.add('active');
        }
    });

    // Скрываем все страницы
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    // Показываем нужную
    targetPage.classList.add('active');
    targetPage.style.display = 'block';

    // Загрузка профиля и т.д.
    if (pageId === 'profile') {
        loadProfileData();
    }
    if (pageId === 'settings') {
        loadProfileData();
        loadSettingsData();
    }

    // Очищаем существующий экземпляр игры, если переходим не на страницу 'game'
    if (window.currentGame && pageId !== 'game') {
        window.currentGame.cleanup();
        window.currentGame = null;
    }

    // Дополнительная инициализация (например, Pong или TicTacToe)
    initializeGameIfNeeded(pageId);

    // Если это турнирная «страница», покажем первый подблок
    if (pageId === 'tournament') {
        if (window.currentTournamentId) {
            showTournamentSubsection('view-tournament');
            loadTournamentData(window.currentTournamentId);
        } else {
            showTournamentSubsection('create-tournament');
        }
    }
}

window.showPage = showPage;

window.addEventListener('popstate', (event) => {
    if (!event.state) {
        const path = window.location.pathname;
        const pageId = path.substring(1) || 'home';
        history.replaceState({ pageId }, '', path);
        showPage(pageId, false);
        return;
    }
    showPage(event.state.pageId, false);
});

window.addEventListener('load', () => {
    const path = window.location.pathname;
    const initialPage = path.substring(1) || 'home';
    if (!history.state) {
        history.replaceState({ pageId: initialPage }, '', path);
    }
    showPage(initialPage, false);
// <<<<<<< master
    checkLoginState(); // Ensure login state is checked after page is shown

    // If user is logged in, fetch fresh profile data to update avatars
    if (localStorage.getItem('isLoggedIn') === 'true') {
        refreshUserData();
    }

    // Clear avatar cache on page load
    clearAvatarCache();
// =======
    checkLoginState();
// >>>>>>> 8ec6d59
});

document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link && link.getAttribute('href')?.startsWith('/')) {
        event.preventDefault();
        const pageId = link.getAttribute('href').substring(1) || 'home';
        showPage(pageId, true);
    }
});

function checkLoginState() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    document.body.classList.remove('is-logged-in', 'is-logged-out');
    document.body.classList.add(isLoggedIn ? 'is-logged-in' : 'is-logged-out');
    
    const loggedInNav = document.querySelector('.nav-links.logged-in');
    const loggedOutNav = document.querySelector('.nav-links.logged-out');
    
    if (loggedInNav) loggedInNav.style.display = isLoggedIn ? 'flex' : 'none';
    if (loggedOutNav) loggedOutNav.style.display = isLoggedIn ? 'none' : 'flex';
    
    // Update nav avatar when logged in
    if (isLoggedIn) {
        updateNavAvatar();
    }
}

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

// Инициализация игр (Pong / TicTacToe)
function initializeGameIfNeeded(pageId) {
    // Очищаем существующий экземпляр игры, если он есть
    if (window.currentGame) {
        window.currentGame.cleanup();
        window.currentGame = null;
    }

    if (pageId === 'game') {
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            gameContainer.innerHTML = '';
            gameContainer.style.display = 'block';
            // Инициализируем игру: для турнира используем режим 'pvp' и matchId,
            // для обычной игры — без параметров
            const mode = window.currentMatchId ? 'pvp' : null;
            PongGame.initializeGame(gameContainer, mode);
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

// // Show tournament subsection
// Функция для показа под-секций в блоке "tournament"
function showTournamentSubsection(subSection) {
    document.querySelectorAll('#tournament .sub-section').forEach(section => {
        section.style.display = 'none';
    });
    const target = document.getElementById(subSection);
    if (target) {
        target.style.display = 'block';
    }
}

// Загрузка данных турнира
async function loadTournamentData(tournamentId) {
    try {
        const response = await fetch(`/tournaments/api/tournaments/${tournamentId}/`);
        const data = await response.json();
        const displayDiv = document.getElementById('tournament-data');
        if (displayDiv) {
            displayDiv.innerText = JSON.stringify(data, null, 2);
        }
    } catch (error) {
        console.error('Error loading tournament data:', error);
    }
}

//================================================================================


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

function startTournamentMatch(matchId) {
    const authToken = localStorage.getItem('authToken');
    fetch(`/tournaments/api/tournaments/match/${matchId}/start/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken'),
            'Authorization': `Token ${authToken}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.currentMatchId = matchId;
            window.currentMatchPlayers = {
                player1: data.player1,
                player2: data.player2
            };
            window.tournamentId = data.tournament_id || currentTournamentId;
            
            // Переходим на страницу игры, инициализация произойдёт через initializeGameIfNeeded
            showPage('game');
        } else {
            alert(data.message || 'Failed to start match');
        }
    })
    .catch(error => {
        console.error('Error starting match:', error);
        alert('Failed to start match');
    });
}

// Finish match (called from Pong game after completion)
window.finishTournamentMatch = async function(scorePlayer1, scorePlayer2) {
    const authToken = localStorage.getItem('authToken');
    try {
        const response = await fetch(`/tournaments/api/tournaments/${window.currentMatchId}/finish/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${authToken}`,
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                score_player1: scorePlayer1,
                score_player2: scorePlayer2
            })
        });

        if (response.ok) {
            showPage('tournament');
            showTournamentSubsection('view-tournament');
            loadTournamentData();
        } else {
            alert('Failed to finish match');
        }
    } catch (error) {
        console.error('Error finishing match:', error);
        alert('Failed to finish match');
    }
};


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
    
    // Mobile menu handling - Improved version
    const hamburger = document.getElementById('hamburger-menu');
    const navLinksLoggedIn = document.querySelector('.nav-links.logged-in');
    const navLinksLoggedOut = document.querySelector('.nav-links.logged-out');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            // Determine which navigation to toggle based on login state
            const isLoggedIn = document.body.classList.contains('is-logged-in');
            const activeNav = isLoggedIn ? navLinksLoggedIn : navLinksLoggedOut;
            
            if (activeNav) {
                activeNav.classList.toggle('active');
                console.log('Toggle menu:', activeNav.classList.contains('active') ? 'opened' : 'closed');
            }
        });
        
        // Close mobile menu when clicking a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinksLoggedIn?.classList.remove('active');
                navLinksLoggedOut?.classList.remove('active');
            });
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', (event) => {
            const isClickInside = event.target.closest('.nav-links') || event.target.closest('#hamburger-menu');
            if (!isClickInside) {
                navLinksLoggedIn?.classList.remove('active');
                navLinksLoggedOut?.classList.remove('active');
            }
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
                
                console.log('Sending update for:', fieldType);
                console.log('New value:', newValue);
                console.log('Auth token:', authToken);
                
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
                    console.log('Server response:', data);
                    
                    if (response.ok) {
                        display.textContent = newValue;
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
        avatarUpload.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                try {
                    // First show preview
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        // Set preview image
                        const imagePreview = document.querySelector('.current-avatar');
                        imagePreview.src = e.target.result;
                        
                        // Now send to server
                        const authToken = localStorage.getItem('authToken');
                        if (!authToken) {
                            throw new Error('Not authenticated');
                        }
                        
                        const response = await fetch('/api/auth/profile/', {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCookie('csrftoken')
                            },
                            body: JSON.stringify({
                                profile_picture: e.target.result
                            })
                        });
                        
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || 'Failed to update avatar');
                        }
                        
                        const data = await response.json();
                        
                        // Update the avatar in all places - check for both field names
                        const avatarPath = data.profile_picture || data.avatar;
                        
                        if (avatarPath) {
                            const fixedUrl = fixImageUrl(avatarPath);
                            
                            // Update nav avatar if it exists
                            const navAvatar = document.querySelector('.nav-avatar');
                            if (navAvatar) {
                                navAvatar.src = fixedUrl + '?t=' + new Date().getTime(); // Force reload
                            }
                            
                            // Update profile avatar if on that page
                            const profileAvatar = document.getElementById('profile-avatar');
                            if (profileAvatar) {
                                profileAvatar.src = fixedUrl + '?t=' + new Date().getTime(); // Force reload
                            }
                            
                            // Update settings avatar if on that page
                            const settingsAvatar = document.querySelector('.current-avatar');
                            if (settingsAvatar) {
                                settingsAvatar.src = fixedUrl + '?t=' + new Date().getTime(); // Force reload
                            }
                            
                            // Update localStorage data with new avatar path
                            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
                            userData.profile_picture = avatarPath;
                            localStorage.setItem('userData', JSON.stringify(userData));
                            
                            alert('Avatar updated successfully!');
                        } else {
                            console.warn('No avatar path in response:', data);
                        }
                    };
                    reader.readAsDataURL(file);
                } catch (error) {
                    console.error('Error updating avatar:', error);
                    alert('Failed to update avatar: ' + error.message);
                }
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

    // Tournament button handling
    const playNowButton = document.getElementById('play-now-button');
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
            showPage('tournament');
            showTournamentSubsection('create-tournament'); // Добавляем переключение на создание
        }
    }

    if (playNowButton) {
        playNowButton.onclick = (e) => checkAuthAndRedirect(e, 'game');
    }

    // Перенос и обновление tournamentButton
    const tournamentButton = document.getElementById('tournament-button');
    if (tournamentButton) {
        tournamentButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (localStorage.getItem('isLoggedIn') === 'true') {
                showPage('tournament');
                showTournamentSubsection('create-tournament');
            } else {
                alert('Please log in to create or join tournaments');
                showPage('login');
            }
        });
    }

    // Перенос и обновление create-tournament-form (используем handleTournamentCreation)
    const createTournamentForm = document.getElementById('create-tournament-form');
    if (createTournamentForm) {
        createTournamentForm.addEventListener('submit', handleTournamentCreation);
    }

    // Перенос и обновление add-players-form (используем handleAddPlayers)
    const addPlayersForm = document.getElementById('add-players-form');
    if (addPlayersForm) {
        addPlayersForm.addEventListener('submit', handleAddPlayers);
    }

    // Add event listener for the download data button
    const downloadDataBtn = document.getElementById('download-data');
    if (downloadDataBtn) {
        downloadDataBtn.addEventListener('click', handleDownloadUserData);
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

// Fix loadProfileData to check for both avatar and profile_picture
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
                // Fix: Check for both profile_picture and avatar fields
                const avatarUrl = data.profile_picture || data.avatar;
                if (avatarUrl) {
                    // Get base URL without timestamp
                    const baseUrl = fixImageUrl(avatarUrl);
                    // Add timestamp only if not already present
                    const finalUrl = baseUrl.includes('?') ? baseUrl : baseUrl + '?t=' + new Date().getTime();
                    avatarElement.src = finalUrl;
                    console.log('Set avatar image source:', finalUrl);
                } else {
                    avatarElement.src = '/static/frontend/assets/man.png';
                    console.log('Using default avatar image');
                }
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
            
            // Create win rate pie chart
            if (data.stats) {
                // Extract numerical win rate and total games
                const gamesPlayed = parseInt(data.stats.games_played) || 0;
                const winRateStr = data.stats.win_rate || "0%";
                const winRate = parseInt(winRateStr) || 0;
                const wins = Math.round((winRate / 100) * gamesPlayed);
                
                // Create the pie chart
                createWinratePieChart(wins, gamesPlayed);
            }
            
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
                    
                    // Add game type indicator
                    const gameType = document.createElement('span');
                    gameType.className = 'game-type';
                    gameType.textContent = match.game_type || 'PONG'; // Default to PONG if not specified
                    
                    const opponent = document.createElement('span');
                    opponent.textContent = `vs. ${match.opponent}`;
                    
                    const score = document.createElement('span');
                    score.textContent = match.score;
                    
                    const result = document.createElement('span');
                    result.className = `match-result ${match.result === 'WIN' ? 'win' : 'loss'}`;
                    result.textContent = match.result;
                    
                    // Add date display
                    const dateSpan = document.createElement('span');
                    dateSpan.className = 'match-date';
                    
                    // Format date if available, otherwise show "No date"
                    if (match.date) {
                        // Try to parse and format the date
                        try {
                            const matchDate = new Date(match.date);
                            dateSpan.textContent = matchDate.toLocaleDateString();
                        } catch (e) {
                            dateSpan.textContent = match.date;
                        }
                    } else {
                        dateSpan.textContent = "No date";
                    }
                    
                    matchCard.appendChild(gameType);
                    matchCard.appendChild(opponent);
                    matchCard.appendChild(score);
                    matchCard.appendChild(result);
                    matchCard.appendChild(dateSpan); // Add the date to the card
                    
                    matchHistoryContainer.appendChild(matchCard);
                });
            } else {
                const noMatches = document.createElement('p');
                noMatches.textContent = 'No matches played yet.';
                matchHistoryContainer.appendChild(noMatches);
            }

            // Update avatar in localStorage
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            if (data.avatar || data.profile_picture) {
                userData.profile_picture = data.profile_picture || data.avatar;
                localStorage.setItem('userData', JSON.stringify(userData));
                
                // Update all avatar instances
                updateNavAvatar();
            }

            // After updating match history, load the friends data
            await loadFriendsList();
            await loadAllUsers();
            
            // Set up tab switching in the friends panel
            setupFriendsTabs();
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

// Also fix loadSettingsData to check for both field names
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
            
            // Update current avatar in settings
            const currentAvatar = document.querySelector('.current-avatar');
            if (currentAvatar) {
                const avatarUrl = data.profile_picture || data.avatar;
                if (avatarUrl) {
                    const fixedUrl = fixImageUrl(avatarUrl);
                    currentAvatar.src = fixedUrl + '?t=' + new Date().getTime(); // Force reload
                    console.log('Updated settings avatar to:', fixedUrl);
                }
            }
            
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

// <<<<<<< master
// Add this function to update the nav avatar from localStorage
async function updateNavAvatar() {
    const navAvatar = document.querySelector('.nav-avatar');
    if (!navAvatar) return;
    
    try {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const avatarUrl = userData.profile_picture || userData.avatar;
        
        if (avatarUrl) {
            // Get fixed URL without adding timestamp yet
            const baseUrl = fixImageUrl(avatarUrl);
            
            // Make sure we don't add duplicate timestamps
            const finalUrl = baseUrl.includes('?') ? baseUrl : baseUrl + '?t=' + new Date().getTime();
            
            navAvatar.src = finalUrl;
        }
    } catch (error) {
        console.error('Error updating nav avatar:', error);
    }
}

// Add a function to refresh user data
async function refreshUserData() {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) return;
        
        const response = await fetch('/api/auth/profile/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update avatar in localStorage
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            
            // Ensure we store user ID for avatar URLs
            if (data.id) {
                userData.id = data.id;
            }
            
            if (data.avatar || data.profile_picture) {
                userData.profile_picture = data.profile_picture || data.avatar;
                localStorage.setItem('userData', JSON.stringify(userData));
                
                // Update UI immediately
                updateNavAvatar();
            }
        } else if (response.status === 401) {
            // Token expired, try to refresh it
            const newToken = await refreshAccessToken();
            if (newToken) {
                refreshUserData(); // Try again with new token
            }
        }
    } catch (error) {
        console.error('Error refreshing user data:', error);
    }
}

// Add this function to handle tournament creation
// =======
// >>>>>>> 8ec6d59
async function handleTournamentCreation(event) {
    event.preventDefault();

    const authToken = localStorage.getItem('authToken');
    console.log('Creat tournament - Auth Token:', authToken); // Добавляем логирование
    if (!authToken) {
        alert('Please log in to create a tournament');
        showPage('login');
        return;
    }

    const participantsCount = document.getElementById('participants_count').value;
    if (participantsCount < 3 || participantsCount > 8) {
        alert('Number of participants must be between 3 and 8');
        return;
    }

    try {
        const response = await fetch('/tournaments/api/tournaments/create/', { // Исправленный URL
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ participants_count: parseInt(participantsCount) })
        });

        const data = await response.json();
        if (response.ok) {
            currentTournamentId = data.tournament_id;
            participantCount = parseInt(participantsCount, 10);
            generatePlayerInputs(participantCount);
            showTournamentSubsection('add-players');
        } else {
            alert(data.error || 'Failed to create tournament');
        }
    } catch (error) {
        console.error('Error creating tournament:', error);
        alert('Failed to create tournament. Please try again.');
    }
}

// <<<<<<< master
async function getAccessToken() {
    let token = localStorage.getItem("authToken");

    if (!token) return null;

    try {
        // Decode JWT to check expiry
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isExpired = payload.exp * 1000 < Date.now();

        if (isExpired) {
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
            setTimeout(refreshAccessToken, refreshTime);
        }
    } catch (error) {
        console.error("Error scheduling token refresh:", error);
    }
}

// Fix the duplicate timestamp in the URL
function fixImageUrl(url) {
    if (!url) return '/static/frontend/assets/man.png';
    
    // If it's a media/profile_pictures URL, use our direct avatar endpoint
    if (url.includes('profile_pictures')) {
        // Get user ID from localStorage
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            if (userData.id) {
                // Use direct avatar endpoint with single timestamp
                return `/api/auth/avatar/${userData.id}/?t=${new Date().getTime()}`;
            }
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
    
    // If the URL doesn't start with http or https, it's a relative URL
    if (!url.match(/^(http|https):\/\//)) {
        // Make sure the URL starts with a single forward slash
        if (!url.startsWith('/')) {
            url = '/' + url;
        }
    }
    
    return url;
}

// Add function to manually clear avatar image cache
function clearAvatarCache() {
    const avatars = document.querySelectorAll('img.nav-avatar, img.profile-avatar, img.current-avatar');
    
    avatars.forEach(avatar => {
        if (avatar.src && avatar.src !== '/static/frontend/assets/man.png') {
            const url = new URL(avatar.src);
            avatar.src = url.pathname + '?t=' + new Date().getTime();
        }
    });
}

// Enhance the handleDownloadUserData function to include the avatar as Base64
async function handleDownloadUserData() {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            alert('You must be logged in to download your data.');
            return;
        }

        // Show loading indicator
        const downloadBtn = document.getElementById('download-data');
        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = 'Preparing data...';
        downloadBtn.disabled = true;

        // Fetch complete user data including avatar from our export endpoint
        const response = await fetch('/api/auth/export-data/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();
        
        // Fetch avatar as Base64 if the user has one
        if (userData.profile && userData.profile.avatar_url) {
            try {
                // Get user ID from the data
                const userId = userData.user_information.id;
                
                // Get avatar directly from our avatar endpoint to ensure we get the actual file
                const avatarResponse = await fetch(`/api/auth/avatar/${userId}/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                if (avatarResponse.ok) {
                    // Convert the image to a blob
                    const blob = await avatarResponse.blob();
                    
                    // Convert blob to base64
                    const base64data = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    
                    // Add the base64 avatar to the user data
                    userData.profile.avatar_base64 = base64data;
                    console.log("Avatar successfully embedded as Base64");
                }
            } catch (avatarError) {
                console.error('Error fetching avatar:', avatarError);
                // Continue without avatar if there's an error
                userData.profile.avatar_base64_error = "Failed to retrieve avatar";
            }
        }

        // Add additional metadata
        userData.export_metadata = {
            export_date: new Date().toISOString(),
            export_format_version: '1.1',
            export_type: 'user_data_with_avatar',
            exported_by: userData.user_information.username
        };

        // Convert to JSON string with nice formatting
        const jsonData = JSON.stringify(userData, null, 2);

        // Create blob and download
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        
        // Create hidden download link and trigger it
        const a = document.createElement('a');
        const filename = `user_data_${userData.user_information.username}_${new Date().toISOString().split('T')[0]}.json`;
        
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Reset button
        downloadBtn.textContent = originalText;
        downloadBtn.disabled = false;
        
        alert('Your data has been downloaded successfully.');
        
    } catch (error) {
        console.error('Error downloading user data:', error);
        
        // Reset button
        const downloadBtn = document.getElementById('download-data');
        downloadBtn.textContent = 'Download My Data';
        downloadBtn.disabled = false;
        
        alert('Failed to download user data: ' + error.message);
    }
}

// Add these functions to handle friends functionality
function setupFriendsTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show corresponding tab content
            const tabName = button.dataset.tab;
            tabContents.forEach(tab => {
                tab.classList.remove('active');
                if (tab.id === tabName) {
                    tab.classList.add('active');
                }
            });
        });
    });
    
    // Setup search functionality
    const friendsSearchInput = document.getElementById('friends-search-input');
    const usersSearchInput = document.getElementById('users-search-input');
    
    if (friendsSearchInput) {
        friendsSearchInput.addEventListener('input', (e) => {
            filterFriendsList(e.target.value.toLowerCase());
        });
    }
    
    if (usersSearchInput) {
        usersSearchInput.addEventListener('input', (e) => {
            filterUsersList(e.target.value.toLowerCase());
        });
    }
}

function filterFriendsList(query) {
    const friendItems = document.querySelectorAll('#friends-list .friend-item');
    
    friendItems.forEach(item => {
        const name = item.querySelector('.friend-name').textContent.toLowerCase();
        const username = item.querySelector('.friend-username').textContent.toLowerCase();
        
        if (name.includes(query) || username.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function filterUsersList(query) {
    const userItems = document.querySelectorAll('#users-list .friend-item');
    
    userItems.forEach(item => {
        const name = item.querySelector('.friend-name').textContent.toLowerCase();
        const username = item.querySelector('.friend-username').textContent.toLowerCase();
        
        if (name.includes(query) || username.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

async function loadFriendsList() {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) return;
        
        const friendsList = document.getElementById('friends-list');
        if (!friendsList) return;
        
        // Show loading indicator
        friendsList.innerHTML = '<div class="loading-indicator">Loading your friends...</div>';
        
        const response = await fetch('/api/auth/friends/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const friends = data.friends;
            
            if (friends.length === 0) {
                friendsList.innerHTML = '<div class="empty-state">You haven\'t added any friends yet.</div>';
                return;
            }
            
            // Clear friends list
            friendsList.innerHTML = '';
            
            // Add each friend to the list
            friends.forEach(friend => {
                const friendItem = createFriendItem(friend, true);
                friendsList.appendChild(friendItem);
            });
        } else {
            friendsList.innerHTML = '<div class="empty-state">Failed to load friends.</div>';
        }
    } catch (error) {
        console.error('Error loading friends list:', error);
        const friendsList = document.getElementById('friends-list');
        if (friendsList) {
            friendsList.innerHTML = '<div class="empty-state">Failed to load friends.</div>';
        }
    }
}

async function loadAllUsers() {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) return;
        
        const usersList = document.getElementById('users-list');
        if (!usersList) return;
        
        // Show loading indicator
        usersList.innerHTML = '<div class="loading-indicator">Loading users...</div>';
        
        const response = await fetch('/api/auth/users/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const users = data.users;
            
            if (users.length === 0) {
                usersList.innerHTML = '<div class="empty-state">No users found.</div>';
                return;
            }
            
            // Clear users list
            usersList.innerHTML = '';
            
            // Add each user to the list
            users.forEach(user => {
                const userItem = createFriendItem(user, user.is_friend);
                usersList.appendChild(userItem);
            });
        } else {
            usersList.innerHTML = '<div class="empty-state">Failed to load users.</div>';
        }
    } catch (error) {
        console.error('Error loading users list:', error);
        const usersList = document.getElementById('users-list');
        if (usersList) {
            usersList.innerHTML = '<div class="empty-state">Failed to load users.</div>';
        }
    }
}

// Update the createFriendItem function to remove the avatar
function createFriendItem(user, isFriend) {
    const item = document.createElement('div');
    item.className = 'friend-item';
    item.dataset.userId = user.id;
    
    // Remove avatar creation and insertion code
    
    const info = document.createElement('div');
    info.className = 'friend-info';
    
    const name = document.createElement('div');
    name.className = 'friend-name';
    name.textContent = user.display_name || user.username;
    
    const username = document.createElement('div');
    username.className = 'friend-username';
    username.textContent = `@${user.username}`;
    
    info.appendChild(name);
    info.appendChild(username);
    
    const button = document.createElement('button');
    button.className = isFriend ? 'friend-action remove' : 'friend-action';
    button.textContent = isFriend ? 'Remove' : 'Add';
    button.onclick = () => isFriend ? removeFriend(user.id) : addFriend(user.id);
    
    // Only append info and button (no avatar)
    item.appendChild(info);
    item.appendChild(button);
    
    return item;
}

async function addFriend(userId) {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            alert('You must be logged in to add friends.');
            return;
        }
        
        const response = await fetch(`/api/auth/friends/add/${userId}/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            }
        });
        
        if (response.ok) {
            // Update UI to show user is now a friend
            const userItems = document.querySelectorAll(`.friend-item[data-user-id="${userId}"]`);
            
            userItems.forEach(item => {
                const button = item.querySelector('.friend-action');
                button.className = 'friend-action remove';
                button.textContent = 'Remove';
                button.onclick = () => removeFriend(userId);
            });
            
            // Refresh friends list
            loadFriendsList();
            
            // Optional: show success message
            // alert('Friend added successfully!');
        } else {
            const data = await response.json();
            alert(data.message || 'Failed to add friend.');
        }
    } catch (error) {
        console.error('Error adding friend:', error);
        alert('Failed to add friend. Please try again.');
    }
}

async function removeFriend(userId) {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            alert('You must be logged in to remove friends.');
            return;
        }
        
        const response = await fetch(`/api/auth/friends/remove/${userId}/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            }
        });
        
        if (response.ok) {
            // Update UI to show user is no longer a friend
            const userItems = document.querySelectorAll(`.friend-item[data-user-id="${userId}"]`);
            
            userItems.forEach(item => {
                const button = item.querySelector('.friend-action');
                button.className = 'friend-action';
                button.textContent = 'Add';
                button.onclick = () => addFriend(userId);
            });
            
            // Refresh friends list
            loadFriendsList();
            
            // Optional: show success message
            // alert('Friend removed successfully!');
        } else {
            const data = await response.json();
            alert(data.message || 'Failed to remove friend.');
        }
    } catch (error) {
        console.error('Error removing friend:', error);
        alert('Failed to remove friend. Please try again.');
    }
}

// Add this function to the script.js file to create the winrate pie chart
function createWinratePieChart(wins, total) {
    const container = document.getElementById('winrate-chart');
    if (!container) return;
    
    // Clear any existing chart
    container.innerHTML = '';
    
    // Calculate percentages
    const winPercent = total > 0 ? Math.round((wins / total) * 100) : 0;
    const lossPercent = 100 - winPercent;
    
    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '150');
    svg.setAttribute('height', '150');
    svg.setAttribute('viewBox', '0 0 100 100');
    
    // Calculate the circle segments
    const radius = 45; // Slightly smaller to fit in container with border
    const centerX = 50;
    const centerY = 50;
    
    // Create pie slices
    if (total === 0) {
        // If no games, show empty gray circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', centerX);
        circle.setAttribute('cy', centerY);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', '#444');
        svg.appendChild(circle);
    } else {
        // Win slice (green)
        if (winPercent > 0) {
            const winSlice = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const winAngle = winPercent * 3.6; // 3.6 degrees per percentage point
            
            // Calculate path for arc
            const winRad = (winAngle - 90) * Math.PI / 180;
            const x1 = centerX;
            const y1 = centerY - radius;
            const x2 = centerX + radius * Math.cos(winRad);
            const y2 = centerY + radius * Math.sin(winRad);
            
            // Create path
            const winPath = `M${centerX},${centerY} L${x1},${y1} A${radius},${radius} 0 ${winAngle > 180 ? 1 : 0},1 ${x2},${y2} Z`;
            winSlice.setAttribute('d', winPath);
            winSlice.setAttribute('fill', '#00ff00');
            svg.appendChild(winSlice);
        }
        
        // Loss slice (red)
        if (lossPercent > 0) {
            const lossSlice = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const lossStartAngle = winPercent * 3.6 - 90;
            const lossEndAngle = 270; // End at -90 degrees (back to top)
            
            // Calculate path for arc
            const startRad = lossStartAngle * Math.PI / 180;
            const endRad = lossEndAngle * Math.PI / 180;
            const x1 = centerX + radius * Math.cos(startRad);
            const y1 = centerY + radius * Math.sin(startRad);
            const x2 = centerX;
            const y2 = centerY - radius;
            
            // Create path
            const lossPath = `M${centerX},${centerY} L${x1},${y1} A${radius},${radius} 0 ${lossPercent > 50 ? 1 : 0},1 ${x2},${y2} Z`;
            lossSlice.setAttribute('d', lossPath);
            lossSlice.setAttribute('fill', '#ff4444');
            svg.appendChild(lossSlice);
        }
    }
    
    // Add heading text above the percentage
    const heading = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    heading.setAttribute('x', '50');
    heading.setAttribute('y', '38');
    heading.setAttribute('text-anchor', 'middle');
    heading.setAttribute('dominant-baseline', 'middle');
    heading.setAttribute('font-family', 'Press Start 2P, cursive');
    heading.setAttribute('font-size', '6');
    heading.setAttribute('fill', '#000');
    heading.textContent = 'WIN RATE';
    
    // Add percentage text in the center (made larger)
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '50');
    text.setAttribute('y', '55');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-family', 'Press Start 2P, cursive');
    text.setAttribute('font-size', '14');
    text.setAttribute('fill', '#000');
    text.textContent = `${winPercent}%`;
    
    // Add games count text
    const gamesText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    gamesText.setAttribute('x', '50');
    gamesText.setAttribute('y', '70');
    gamesText.setAttribute('text-anchor', 'middle');
    gamesText.setAttribute('font-family', 'Press Start 2P, cursive');
    gamesText.setAttribute('font-size', '5');
    gamesText.setAttribute('fill', '#000');
    gamesText.textContent = `${total} GAMES`;
    
    svg.appendChild(heading);
    svg.appendChild(text);
    svg.appendChild(gamesText);
    container.appendChild(svg);
}


// =======
// Generate input fields for players
function generatePlayerInputs(count) {
    const playerInputsDiv = document.getElementById('player-inputs');
    playerInputsDiv.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const inputGroup = document.createElement('div');
        inputGroup.classList.add('input-group');

        const label = document.createElement('label');
        label.textContent = `Player ${i + 1}:`;
        label.setAttribute('for', `player-${i}`);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `player-${i}`;
        input.name = `player-${i}`;
        input.required = true;

        inputGroup.appendChild(label);
        inputGroup.appendChild(input);
        playerInputsDiv.appendChild(inputGroup);
    }
}

// Handle adding players
async function handleAddPlayers(event) {
    event.preventDefault();
// >>>>>>> 8ec6d59

    const authToken = localStorage.getItem('authToken');
    console.log('Add Players - Auth Token:', authToken);
    const csrftoken = getCookie('csrftoken');
    console.log('Add Players - CSRF Token:', csrftoken); 
    
    // Изменяем селектор, чтобы выбирать только поля в #player-inputs
    const playerInputs = document.querySelectorAll('#player-inputs input');
    const nicknames = Array.from(playerInputs).map(input => input.value.trim());
    
    // Добавляем отладочные сообщения
    console.log('Player inputs count:', playerInputs.length);
    console.log('Expected participant count:', participantCount);
    console.log('Nicknames:', nicknames);

    if (nicknames.length !== participantCount) {
        console.log('problipaem with particntCount');
        document.getElementById('add-players-error').textContent = 'Please fill in all player fields';
        return;
    }

    const uniqueNicknames = new Set(nicknames);
    if (uniqueNicknames.size !== nicknames.length) {
        document.getElementById('add-players-error').textContent = 'Duplicate nicknames detected';
        return;
    }

    try {
        const response = await fetch(`/tournaments/api/tournaments/${currentTournamentId}/add_players/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${authToken}`,
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ nicknames })
        });

        console.log('Response status:', response.status);
        
        // Клонируем ответ для логирования
        const responseClone = response.clone();
        const responseText = await responseClone.text();
        console.log('Response text:', responseText);
        
        // Пробуем распарсить оригинальный ответ как JSON
        try {
            const data = await response.json();
            
            if (response.ok) {
                console.log("Before showing tournament subsection");
                showTournamentSubsection('view-tournament');
                console.log("After showing tournament subsection");
                await loadTournamentData();
            } else {
                document.getElementById('add-players-error').textContent = data.error || 'Failed to add players';
            }
        } catch (jsonError) {
            console.error('Error parsing JSON response:', jsonError);
            document.getElementById('add-players-error').textContent = 'Сервер вернул некорректный ответ. Попробуйте еще раз.';
        }
    } catch (error) {
        console.error('Error adding players:', error);
        document.getElementById('add-players-error').textContent = 'Failed to add players. Please try again.';
    }
}

// Load and display tournament data
// Полная функция загрузки и отображения данных турнира
async function loadTournamentData() {
    const authToken = localStorage.getItem('authToken');
    try {
        const response = await fetch(`/tournaments/api/tournaments/${currentTournamentId}/`, {
            headers: {
                'Authorization': `Token ${authToken}`
            }
        });
        const data = await response.json();

        console.log('Полученные данные турнира:', data);
        console.log('ID текущего матча:', window.currentMatchId);

        // Define renderMatch function first - IMPORTANT!
        const renderMatch = (match, tableBody) => {
            const tr = document.createElement('tr');
            const player1 = data.players.find(p => p.id === match.player1);
            const player2 = data.players.find(p => p.id === match.player2);
            const winner = match.winner ? data.players.find(p => p.id === match.winner) : null;
            
            tr.innerHTML = `
                <td>${player1 ? player1.nickname : 'Unknown'}</td>
                <td>${player2 ? player2.nickname : 'Unknown'}</td>
                <td>${match.is_complete ? `${match.score_player1}-${match.score_player2}` : '-'}</td>
                <td>${winner ? winner.nickname : (match.is_complete ? 'Tie' : '-')}</td>
                <td>
                    ${match.is_complete 
                        ? '<span class="status-finished">Finished</span>' 
                        : `<button onclick="startTournamentMatch(${match.id})">Start Match</button>`}
                </td>
            `;
            tableBody.appendChild(tr);
        };

        // Regular matches - ADD NULL CHECK
        const regularMatchesTable = document.getElementById('tournamentMatches');
        if (regularMatchesTable) {
            const regularMatchesBody = regularMatchesTable.querySelector('tbody');
            if (regularMatchesBody) {
                regularMatchesBody.innerHTML = '';
                
                const regularMatches = data.matches.filter(m => !m.is_additional);
                regularMatches.forEach(match => {
                    renderMatch(match, regularMatchesBody);
                });
            }
        }
        
        // Additional matches (tiebreakers)
        const additionalMatches = data.matches.filter(m => m.is_additional);
        
        // Get the container for additional matches
        let additionalMatchesContainer = document.getElementById('additionalMatchesContainer');
        
        // If there are additional matches but no container, create one
        if (additionalMatches.length > 0) {
            const tournamentView = document.querySelector('.tournament-view');
            if (tournamentView) { // Check if parent exists
                if (!additionalMatchesContainer) {
                    additionalMatchesContainer = document.createElement('div');
                    additionalMatchesContainer.id = 'additionalMatchesContainer';
                    additionalMatchesContainer.className = 'additional-matches-container';
                    tournamentView.appendChild(additionalMatchesContainer);
                }
                
                // Clear and populate additional matches section
                additionalMatchesContainer.innerHTML = `
                    <h3>Tie-Breaking Matches</h3>
                    <table id="additionalMatches" class="tournament-table">
                        <thead>
                            <tr>
                                <th>Player 1</th>
                                <th>Player 2</th>
                                <th>Score</th>
                                <th>Winner</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                `;
                
                const additionalMatchesBody = additionalMatchesContainer.querySelector('tbody');
                additionalMatches.forEach(match => {
                    renderMatch(match, additionalMatchesBody);
                });
                
                // Make sure it's visible
                additionalMatchesContainer.style.display = 'block';
            }
        } else if (additionalMatchesContainer) {
            // If there are no additional matches but the container exists, hide it
            additionalMatchesContainer.style.display = 'none';
        }

        // Update tournament status - ADD NULL CHECK
        const statusElement = document.getElementById('tournament-status');
        if (statusElement) {
            statusElement.textContent = `Tournament (${data.tournament.status})`;
        }

        // Render players list - ADD NULL CHECK
        const playersList = document.getElementById('players-list');
        if (playersList) {
            playersList.innerHTML = '';
            data.players.forEach(player => {
                const li = document.createElement('li');
                li.classList.add('player-item');
                li.innerHTML = `<span>${player.nickname}</span><span>Score: ${player.score}</span>`;
                playersList.appendChild(li);
            });
        }

        // Update second tables for regular and additional matches (if they exist)
        const regularTableBody = document.querySelector('#regular-matches-table tbody');
        if (regularTableBody) {
            regularTableBody.innerHTML = '';
            const regularMatches = data.matches.filter(m => !m.is_additional);
            regularMatches.forEach(match => renderMatch(match, regularTableBody));
        }

        // Update additional matches section (second approach)
        const additionalMatchesSection = document.getElementById('additional-matches');
        if (additionalMatchesSection) {
            if (additionalMatches.length > 0) {
                additionalMatchesSection.style.display = 'block';
                const additionalTableBody = document.querySelector('#additional-matches-table tbody');
                if (additionalTableBody) {
                    additionalTableBody.innerHTML = '';
                    additionalMatches.forEach(match => renderMatch(match, additionalTableBody));
                }
            } else {
                additionalMatchesSection.style.display = 'none';
            }
        }

        // Check for winners - ADD NULL CHECKS
        const winnerSection = document.getElementById('winner-section');
        const winnerText = document.getElementById('winner-text');

        if (winnerSection && winnerText && data.tournament.status === 'Complete' && 
            data.tournament.winner_ids && data.tournament.winner_ids.length > 0) {
            
            const winners = data.tournament.winner_ids.map(id => 
                data.players.find(p => p.id === id)?.nickname || 'Unknown').join(' and ');
            
            winnerText.textContent = `Winner${data.tournament.winner_ids.length > 1 ? 's' : ''}: ${winners}`;
            winnerSection.style.display = 'flex';
        } else if (winnerSection) {
            // Hide winner section for new tournaments or tournaments without winners
            winnerSection.style.display = 'none';
        }

    } catch (error) {
        console.error('Error loading tournament:', error);
    }
}
