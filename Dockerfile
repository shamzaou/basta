FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
        netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install Werkzeug django-extensions django-werkzeug-debugger-runserver

# Copy project
COPY . .

# Make scripts executable
RUN chmod +x /app/scripts/init_db.sh \
    && chmod +x /app/scripts/entrypoint.sh

# Expose port
EXPOSE 443

# Set entrypoint
ENTRYPOINT ["/app/scripts/entrypoint.sh"]