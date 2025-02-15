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
python manage.py runserver 0.0.0.0:8000