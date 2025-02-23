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

# Start server with SSL certificates
python manage.py runserver_plus --cert-file localhost.pem --key-file localhost-key.pem 0.0.0.0:443

# Keep container running
exec "$@"
