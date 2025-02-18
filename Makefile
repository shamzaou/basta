.PHONY: build up down logs shell migrate makemigrations static test clean restart help

# Colors for terminal output
GREEN := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
RESET := $(shell tput -Txterm sgr0)

help:
	@echo "$(GREEN)Available commands:$(RESET)"
	@echo "$(YELLOW)build$(RESET)          - Build Docker containers"
	@echo "$(YELLOW)up$(RESET)             - Start Docker containers in detached mode"
	@echo "$(YELLOW)down$(RESET)           - Stop Docker containers"
	@echo "$(YELLOW)restart$(RESET)        - Restart Docker containers"
	@echo "$(YELLOW)logs$(RESET)           - View Docker container logs"
	@echo "$(YELLOW)shell$(RESET)          - Open Django shell"
	@echo "$(YELLOW)migrate$(RESET)        - Run Django migrations"
	@echo "$(YELLOW)makemigrations$(RESET) - Create new migrations"
	@echo "$(YELLOW)static$(RESET)         - Collect static files"
	@echo "$(YELLOW)test$(RESET)           - Run Django tests"
	@echo "$(YELLOW)clean$(RESET)          - Remove containers, volumes, and data"
	@echo "$(YELLOW)lint$(RESET)           - Run code linting"
	@echo "$(YELLOW)format$(RESET)         - Format Python code"

build:
	@echo "$(GREEN)Building Docker containers...$(RESET)"
	docker-compose build

up:
	@echo "$(GREEN)Starting Docker containers...$(RESET)"
	docker-compose up -d
	@echo "$(GREEN)Services are running. Access the application at https://localhost:8000$(RESET)"

down:
	@echo "$(GREEN)Stopping Docker containers...$(RESET)"
	docker-compose down


restart: clean down build up

logs:
	docker-compose logs -f

shell:
	docker-compose exec web python manage.py shell

migrate:
	@echo "$(GREEN)Running migrations...$(RESET)"
	docker-compose exec web python manage.py migrate

makemigrations:
	@echo "$(GREEN)Creating migrations...$(RESET)"
	docker-compose exec web python manage.py makemigrations

static:
	@echo "$(GREEN)Collecting static files...$(RESET)"
	docker-compose exec web python manage.py collectstatic --noinput

test:
	@echo "$(GREEN)Running tests...$(RESET)"
	docker-compose exec web python manage.py test

clean:
	@echo "$(GREEN)Cleaning up...$(RESET)"
	docker-compose down -v
	rm -rf postgres_data
	find . -type d -name "__pycache__" -exec rm -r {} +
	find . -type f -name "*.pyc" -delete

lint:
	@echo "$(GREEN)Running linters...$(RESET)"
	docker-compose exec web flake8 .
	docker-compose exec web isort --check-only .

format:
	@echo "$(GREEN)Formatting code...$(RESET)"
	docker-compose exec web black .
	docker-compose exec web isort .

db:
	@echo "$(GREEN)Connecting to PostgreSQL database...$(RESET)"
	docker-compose exec db psql -U postgres -d basta_db

# Default target
.DEFAULT_GOAL := help