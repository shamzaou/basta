#!/bin/bash

# Wait for postgres
while ! nc -z db 5432; do
  echo "Waiting for postgres..."
  sleep 1
done

# Apply database migrations
python manage.py makemigrations
python manage.py migrate

# Start server
python manage.py runserver_plus --cert-file localhost.pem --key-file localhost-key.pem 0.0.0.0:8000
#python manage.py runserver 0.0.0.0:8000