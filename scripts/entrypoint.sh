#!/bin/bash

# Make the init script executable
chmod +x /app/scripts/init_db.sh

# Run the init script
/app/scripts/init_db.sh


# Apply database migrations
python manage.py makemigrations userapp
python manage.py makemigrations
python manage.py migrate

# Start server
python manage.py runserver_plus --cert-file localhost.pem --key-file localhost-key.pem 0.0.0.0:8000
#python manage.py runserver 0.0.0.0:8000
