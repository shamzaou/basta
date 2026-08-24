#!/bin/bash

# Wait for database
while ! nc -z db 5432; do
    echo "Waiting for PostgreSQL..."
    sleep 1
done

echo "PostgreSQL started"

# Debug: Print directory structure
echo "Directory structure:"
find /app -type f -name "settings.py" | sort

# Set up Python path properly
export PYTHONPATH=/app

# Print current Python path for debugging
echo "PYTHONPATH: $PYTHONPATH"
echo "Directory contents of /app:"
ls -la /app

# Determine the correct Django settings module
if [ -f "/app/settings.py" ]; then
    export DJANGO_SETTINGS_MODULE=settings
    echo "Using settings.py at project root"
elif [ -f "/app/basta/settings.py" ]; then
    export DJANGO_SETTINGS_MODULE=basta.settings
    echo "Using basta.settings module"
else
    for dir in $(find /app -maxdepth 1 -type d -not -path "/app"); do
        if [ -f "$dir/settings.py" ]; then
            module_name=$(basename $dir)
            export DJANGO_SETTINGS_MODULE=$module_name.settings
            echo "Found settings in $DJANGO_SETTINGS_MODULE"
            break
        fi
    done
fi

echo "Using DJANGO_SETTINGS_MODULE=$DJANGO_SETTINGS_MODULE"

# Run migrations without using settings
echo "Running migrations..."
python manage.py makemigrations --settings=$DJANGO_SETTINGS_MODULE
python manage.py migrate --settings=$DJANGO_SETTINGS_MODULE
# Table backing the shared cache that holds pending 2FA codes (no-op if it exists)
python manage.py createcachetable --settings=$DJANGO_SETTINGS_MODULE

# Refresh staticfiles/ (WhiteNoise serves hashed files from the manifest there; without
# this step edits in static/ are never served)
python manage.py collectstatic --noinput --settings=$DJANGO_SETTINGS_MODULE

echo "Starting Gunicorn..."
# Start server with SSL certificates using Gunicorn with detailed logging
gunicorn --bind 0.0.0.0:443 \
         --workers 3 \
         --certfile=localhost.pem \
         --keyfile=localhost-key.pem \
         --log-level debug \
         --error-logfile /app/gunicorn-error.log \
         --access-logfile /app/gunicorn-access.log \
         --capture-output \
         --pythonpath /app \
         --env DJANGO_SETTINGS_MODULE=$DJANGO_SETTINGS_MODULE \
         wsgi:application

# Keep container running
exec "$@"
