import os
import sys

# Add the project directory to the Python path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

# Find the settings module
if os.path.exists(os.path.join(BASE_DIR, 'settings.py')):
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
elif os.path.exists(os.path.join(BASE_DIR, 'basta', 'settings.py')):
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'basta.settings')
else:
    for item in os.listdir(BASE_DIR):
        if os.path.isdir(os.path.join(BASE_DIR, item)) and \
           os.path.exists(os.path.join(BASE_DIR, item, 'settings.py')):
            os.environ.setdefault('DJANGO_SETTINGS_MODULE', f'{item}.settings')
            break

print(f"WSGI using settings module: {os.environ.get('DJANGO_SETTINGS_MODULE')}")

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
