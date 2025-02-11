// Immediately clear any stored login state
localStorage.removeItem('isLoggedIn');
localStorage.removeItem('userData');

document.addEventListener('DOMContentLoaded', function() {
    // Force logged-out state initially
    document.body.classList.remove('is-logged-in');
    document.body.classList.add('is-logged-out');
    
    checkLoginState();
});

// Page navigation
function showPage(pageId) {
    // Update URL without page reload
    history.pushState({}, '', '/' + pageId);
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Update active nav link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(pageId)) {
            link.classList.add('active');
        }
    });
}

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    const path = window.location.pathname;
    const pageId = path.substring(1) || 'home';  // Remove leading slash
    showPage(pageId);
});

// Function to check login state
function checkLoginState() {
    fetch('/api/auth/check-auth/')
        .then(response => response.json())
        .then(data => {
            console.log('Auth check response:', data);  // Debug log
            
            // Always remove both classes first
            document.body.classList.remove('is-logged-in');
            document.body.classList.remove('is-logged-out');
            
            // Then add the appropriate one
            if (data.isAuthenticated) {
                document.body.classList.add('is-logged-in');
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userData', JSON.stringify(data.user));
            } else {
                document.body.classList.add('is-logged-out');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userData');
            }
        })
        .catch(error => {
            console.error('Auth check error:', error);
            // On error, ensure logged-out state
            document.body.classList.remove('is-logged-in');
            document.body.classList.add('is-logged-out');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userData');
        });
}

// Handle logout
function handleLogout() {
    fetch('/api/auth/logout/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        }
    }).then(() => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userData');
        checkLoginState();  // This will update the UI
        showPage('home');
    }).catch(error => {
        console.error('Logout error:', error);
    });
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
            // Login successful
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userData', JSON.stringify(data.user));
            checkLoginState();
            showPage('home');
        } else {
            // Login failed
            alert(data.message || 'Login failed. Please try again.');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please check your connection and try again.');
    }
}

// Single DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    // Initial page load
    const path = window.location.pathname;
    const pageId = path.substring(1) || 'home';  // Remove leading slash
    showPage(pageId);
 
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userData');
 
    // Initial login state check
    checkLoginState();
    
    // Mobile menu handling
    const hamburger = document.getElementById('hamburger-menu');
    const navLinksLoggedIn = document.querySelector('.logged-in');
    const navLinksLoggedOut = document.querySelector('.logged-out');
 
    hamburger.addEventListener('click', () => {
        if (document.body.classList.contains('is-logged-in')) {
            navLinksLoggedIn.classList.toggle('active');
        } else {
            navLinksLoggedOut.classList.toggle('active');
        }
    });
 
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
 
 // Handle browser back/forward buttons
 window.addEventListener('popstate', () => {
    const path = window.location.pathname;
    const pageId = path.substring(1) || 'home';  // Remove leading slash
    showPage(pageId);
 });

 // Add the event listener to the login form
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Add event listener for the login button specifically
    const signInButton = document.getElementById('sign-in');
    if (signInButton) {
        signInButton.addEventListener('click', handleLogin);
    }
});