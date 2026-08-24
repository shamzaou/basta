import os
import sys
import django

# Add the project base directory to Python's sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

# Try to find the correct settings module
try:
    # Check if there's a settings.py file in the current directory
    if os.path.exists(os.path.join(BASE_DIR, 'settings.py')):
        from settings import *
    # Try common Django project structures
    elif os.path.exists(os.path.join(BASE_DIR, 'basta', 'settings.py')):
        sys.path.insert(0, os.path.join(BASE_DIR))
        from basta.settings import *
    # If there's a directory with settings.py, use that
    else:
        for item in os.listdir(BASE_DIR):
            if os.path.isdir(os.path.join(BASE_DIR, item)) and \
               os.path.exists(os.path.join(BASE_DIR, item, 'settings.py')):
                sys.path.insert(0, os.path.join(BASE_DIR))
                exec(f"from {item}.settings import *")
                break
except ImportError as e:
    print(f"Error importing settings: {e}")
    raise

DEBUG = False

# Read secret key from environment variable
# Fall back to the key loaded from backend/settings.py (.env DJANGO_SECRET_KEY) when the
# SECRET_KEY env var is not set - otherwise every manage.py command run via this module fails.
SECRET_KEY = os.environ.get('SECRET_KEY') or SECRET_KEY

# Set allowed hosts from environment variable, defaulting to localhost if not provided
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,[::1]').split(',')

# Database configuration using environment variables
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'basta_db'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'postgres'),
        'HOST': os.environ.get('DB_HOST', 'db'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# Security settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
