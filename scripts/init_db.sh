#!/bin/bash

# Wait for postgres
while ! nc -z db 5432; do
  echo "Waiting for postgres..."
  sleep 1
done

echo "PostgreSQL started"

python manage.py makemigrations
python manage.py migrate

exec "$@" 