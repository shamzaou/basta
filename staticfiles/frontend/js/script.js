// Page navigation
function showPage(pageId) {
    console.log('Attempting to show page:', pageId);
    console.log('Current login state:', localStorage.getItem('isLoggedIn'));
    console.log('Body classes:', document.body.classList.toString());
    
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

    // Update URL without page reload
    history.pushState({}, '', '/' + pageId);
    
    // Remove any stray classes or styles
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.removeProperty('display');
        console.log(`Deactivating page: ${page.id}`);
    });
    
    // Show selected page
    const targetPage = document.getElementById(pageId);
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

// Handle registration not ew
// async function handleRegister(event) {
//     event.preventDefault();
    
//     const formData = new FormData(document.getElementById('registerForm'));
//     const data = Object.fromEntries(formData.entries());

//     try {
//         const response = await fetch('/api/auth/register/', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'X-CSRFToken': getCookie('csrftoken')
//             },
//             body: JSON.stringify(data)
//         });

//         const responseData = await response.json();
        
//         if (response.ok) {
//             alert('Registration successful! Please log in.');
//             showPage('login');
//         } else {
//             alert(responseData.message || 'Registration failed');
//         }
//     } catch (error) {
//         console.error('Registration error:', error);
//         alert('Registration failed. Please try again.');
//     }
// }

// Main initialization
document.addEventListener('DOMContentLoaded', () => {
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
    const registerButton = document.getElementById('register');
    if (registerButton) {
        registerButton.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('register');
        });
    }
    
    // Register form handler
    const registerForm = document.getElementById('registerForm');
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