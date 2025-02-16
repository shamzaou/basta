// Page navigation
function showPage(pageId) {    
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    // List of pages that should only be visible when logged in
    const loggedInOnlyPages = ['profile', 'settings'];
    // List of pages that should only be visible when logged out
    const loggedOutOnlyPages = ['login', 'register'];
    
    if (isLoggedIn && loggedOutOnlyPages.includes(pageId)) {
        console.log('Attempting to access auth page while logged in, redirecting to home');
        pageId = 'home';
    } else if (!isLoggedIn && loggedInOnlyPages.includes(pageId)) {
        console.log('Attempting to access protected page while logged out, redirecting to login');
        pageId = 'login';
    }

    // Check if this is an OAuth redirect
    if (pageId === 'home' && window.location.pathname === '/home') {
        checkOAuthLogin(); // This will handle setting the login state
    }

    // Update URL without page reload
    history.pushState({}, '', '/' + pageId);
    
    // Remove any stray classes or styles
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.removeProperty('display');
        console.log(`Deactivating page: ${page.id}`);
    });
    
    // Add these debug lines before activating the page
    const targetPage = document.getElementById(pageId);
    console.log('Debug - Target Page:', {
        id: pageId,
        element: targetPage,
        classList: targetPage?.classList.toString(),
        display: targetPage?.style.display,
        computedStyle: targetPage ? window.getComputedStyle(targetPage).display : 'none'
    });

    if (targetPage) {
        console.log(`Activating page: ${pageId}`);
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
        
        // Also log the computed style to verify visibility
        const computedStyle = window.getComputedStyle(targetPage);
        console.log(`Page ${pageId} computed display after activation:`, computedStyle.display);
    }

    // Show selected page
    // const targetPage = document.getElementById(pageId);
    if (targetPage) {
        console.log(`Activating page: ${pageId}`);
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
        
        // Also log the computed style to verify visibility
        const computedStyle = window.getComputedStyle(targetPage);
        console.log(`Page ${pageId} computed display:`, computedStyle.display);
    }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    const path = window.location.pathname;
    const pageId = path.substring(1) || 'home';  // Remove leading slash
    showPage(pageId);
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
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        console.log('Login response:', data);
        
        if (response.ok) {
            if (data.requires_2fa) {
                // Password is correct, but 2FA is required
                localStorage.setItem('temp_email', email);
                alert(data.message); // "Please check your email for OTP"
                
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
                localStorage.setItem('token', data.token);
                checkLoginState();
                showPage('home');
            }
        } else {
            // Login failed
            alert(data.message || 'Invalid email or password');
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
            body: JSON.stringify({ email, otp })
        });

        const data = await response.json();
        console.log('OTP verification response:', data);  // Debug log

        if (response.ok) {
            // Clear temporary storage
            localStorage.removeItem('temp_email');
            // Hide OTP modal
            document.getElementById('otp-modal').style.display = 'none';
            
            // Complete login
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userData', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
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
        localStorage.removeItem("token"); 
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userData");

        checkLoginState();
        showPage("home");

        alert("You have been logged out.");
    } catch (error) {
        console.error("Logout error:", error);
        alert("Logout failed. Please try again.");
    }
}

// Handle registration
async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('id_username').value;
    const email = document.getElementById('id_email').value;
    const password1 = document.getElementById('id_password1').value;
    const password2 = document.getElementById('id_password2').value;
    const enable2fa = document.getElementById('enable_2fa').checked;

    try {
        const response = await fetch('/api/auth/register/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                username,
                email,
                password1,
                password2,
                enable_2fa: enable2fa
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            alert('Registration successful! Please log in.');
            showPage('login');
        } else {
            alert(data.message || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please try again.');
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
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userData');
    
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

// Event listener for OAuth button in login page
document.getElementById('login-42').addEventListener('click', initiate42OAuth);

async function checkOAuthLogin() {
    try {
        console.log('Checking OAuth login status...');
        const response = await fetch('/api/auth/get-token/', {
            method: "GET",
            credentials: "include",  // Important for sending cookies
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log("OAuth login check response:", data);

        if (response.ok && data.token) {
            console.log("OAuth login successful, storing JWT...");
            localStorage.setItem("token", data.token);
            localStorage.setItem("isLoggedIn", "true");
            
            // Parse the JWT to get user data
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
            localStorage.removeItem("token");
            localStorage.removeItem("userData");
            checkLoginState();
            showPage('login');
            return false;
        }
    } catch (error) {
        console.error("Error checking OAuth login:", error);
        localStorage.setItem("isLoggedIn", "false");
        localStorage.removeItem("token");
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