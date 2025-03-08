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

    // Проверка OAuth
    if (pageId === 'home' && window.location.pathname === '/home') {
        checkOAuthLogin();
    }

    // Проверяем, существует ли вообще такой div
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
    checkLoginState();
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
        const response = await fetch('/api/auth/login/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            credentials: 'include',
            body: JSON.stringify({
                email: email,
                password: document.getElementById('password').value
            })
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
                const modal = document.getElementById('otp-modal');
                modal.style.display = 'block';
                document.getElementById('otp-input').focus();
                
                // Clear password field for security
                document.getElementById('password').value = '';
            } else {
                // Normal login flow (no 2FA)
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userData', JSON.stringify(data.user));
                localStorage.setItem('authToken', data.token);
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
            body: JSON.stringify({ 
                email: email,
                otp: otp 
            })
        });

        const data = await response.json();
        console.log('OTP verification response:', data);

        if (data.status === 'success') {
            // Clear temporary storage
            localStorage.removeItem('temp_email');
            // Hide OTP modal
            document.getElementById('otp-modal').style.display = 'none';
            
            // Complete login
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userData', JSON.stringify(data.user));
            localStorage.setItem('authToken', data.token);
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
        const response = await fetch('/api/auth/logout/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Authorization': `Token ${authToken}`
            }
        });

        // Clear all auth data regardless of response
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userData');
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');

        checkLoginState();
        showPage('home');
        
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
                
                console.log('Sending update for:', fieldType);
                console.log('New value:', newValue);
                console.log('Auth token:', authToken);
                
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
});

async function initiate42OAuth() {
    try {
        const response = await fetch('/api/auth/redirect_uri/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        console.log("OAuth API Response:", data);

        if (response.ok && data.oauth_link) {
            console.log("Redirecting to:", data.oauth_link);
            window.location.href = data.oauth_link;
        } else {
            console.error('Error:', data);
            alert('Failed to initiate OAuth');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to initiate OAuth');
    }
}

async function checkOAuthLogin() {
    try {
        console.log('Checking OAuth login status...');
        const response = await fetch('/api/auth/get-token/', {
            method: "GET",
            credentials: "include",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();
        console.log("OAuth login check response:", data);

        if (response.ok && data.token) {
            localStorage.setItem("authToken", data.token);
            localStorage.setItem("isLoggedIn", "true");
            
            const payload = JSON.parse(atob(data.token.split('.')[1]));
            localStorage.setItem("userData", JSON.stringify({
                username: payload.username,
                email: payload.email
            }));

            checkLoginState();
            showPage('home');
            return true;
        } else {
            console.log("User not authenticated via OAuth:", data.error);
            localStorage.setItem("isLoggedIn", "false");
            localStorage.removeItem("authToken");
            localStorage.removeItem("userData");
            checkLoginState();
            showPage('login');
            return false;
        }
    } catch (error) {
        console.error("Error checking OAuth login:", error);
        localStorage.setItem("isLoggedIn", "false");
        localStorage.removeItem("authToken");
        localStorage.removeItem("userData");
        checkLoginState();
        showPage('login');
        return false;
    }
}

// Update window.onload
window.onload = async function() {
    console.log('Window loaded, checking auth state...');
    if (window.location.pathname === '/home') {
        await checkOAuthLogin();
    } else {
        checkLoginState();
    }
};

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
                'Authorization': `Token ${authToken}`,
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
        }
        
    } catch (error) {
        console.error('Error loading tournament:', error);
    }
}
