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
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    document.body.classList.toggle('is-logged-in', isLoggedIn);
    document.body.classList.toggle('is-logged-out', !isLoggedIn);
}

// Handle logout
function handleLogout() {
    // Send request to Django logout URL
    fetch('/logout/', {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        }
    }).then(() => {
        window.location.href = '/';  // Redirect to home page
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
function handleLogin(event) {
    if (event) event.preventDefault();
    localStorage.setItem('isLoggedIn', 'true');
    checkLoginState();
    showPage('home');
}

// Single DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    // Initial page load
    const path = window.location.pathname;
    const pageId = path.substring(1) || 'home';  // Remove leading slash
    showPage(pageId);
 
    // Set initial login state based on Django's authentication
    const isAuthenticated = document.body.dataset.authenticated === 'true';
    document.body.classList.toggle('is-logged-in', isAuthenticated);
    document.body.classList.toggle('is-logged-out', !isAuthenticated);
 
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