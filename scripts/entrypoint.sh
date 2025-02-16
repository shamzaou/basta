#!/bin/bash

# Make the init script executable
chmod +x /app/scripts/init_db.sh

# Run the init script
/app/scripts/init_db.sh

# Start the application
python manage.py runserver 0.0.0.0:8000