"""
WSGI utility functions to help with production setup.
"""
import os
import sys

def setup_django_environment():
    """
    Configure Django environment for WSGI application.
    """
    # Add the project directory to the Python path
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.append(base_dir)
    
    # Set Django settings module if not already set
    if 'DJANGO_SETTINGS_MODULE' not in os.environ:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'production_settings')
    
    # Print debug information to help diagnose issues
    print(f"Python path: {sys.path}")
    print(f"Django settings module: {os.environ.get('DJANGO_SETTINGS_MODULE')}")
    print(f"Current directory: {os.getcwd()}")
    print(f"Base directory: {base_dir}")
