#!/bin/bash

# Wait for database
while ! nc -z db 5432; do
    echo "Waiting for PostgreSQL..."
    sleep 1
done

echo "PostgreSQL started"

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Collect static files for production
python manage.py collectstatic --noinput

# Start server with SSL certificates
if [ "$DEBUG" = "1" ]; then
    echo "Starting in development mode..."
    python manage.py runserver_plus --cert-file localhost.pem --key-file localhost-key.pem 0.0.0.0:443
else
    echo "Starting in production mode..."
    # Use daphne or gunicorn for production
    python -m pip install daphne # Install if not already included in requirements
    daphne -e ssl:443:privateKey=localhost-key.pem:certKey=localhost.pem backend.asgi:application
fi

# Keep container running
exec "$@"