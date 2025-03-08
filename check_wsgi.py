"""
WSGI configuration diagnostic tool.
Run this to check if the WSGI application can be loaded.
"""
import os
import sys
import importlib
from wsgi_utils import setup_django_environment

def check_wsgi():
    """Check if the WSGI application can be loaded."""
    setup_django_environment()
    
    # Try to import the WSGI application
    try:
        print("Attempting to import WSGI application...")
        wsgi_module = importlib.import_module('basta.wsgi')
        print("WSGI module imported successfully.")
        
        if hasattr(wsgi_module, 'application'):
            print("WSGI application object found.")
        else:
            print("ERROR: WSGI module does not contain an 'application' object.")
            return False
            
        return True
    except Exception as e:
        print(f"ERROR importing WSGI application: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = check_wsgi()
    sys.exit(0 if success else 1)
