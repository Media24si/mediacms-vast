# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MediaCMS is a modern, open source video and media CMS built with Django + React. It's designed for hosting and sharing media content with features like transcoding, streaming, user management, and RBAC.

## Development Commands

### Docker Development (Recommended)
- **Start development environment**: `docker compose -f docker-compose-dev.yaml up`
  - Frontend runs on port 8088 with hot reloading
  - Django web server runs on port 80
  - Includes PostgreSQL and Redis services
- **Build frontend and restart**: `make build-frontend`
- **Access admin shell**: `make admin-shell`
- **Run tests**: `make test` (uses pytest in Docker container)

### Local Development  
- **Django development server**: `python manage.py runserver`
- **Frontend development**: `cd frontend && npm run start`
- **Frontend build**: `cd frontend && npm run dist`

### Testing
- **Run all tests**: `pytest` (or `make test` for Docker)
- **Run specific test**: `pytest path/to/test_file.py::test_function`
- **Test configuration**: pytest.ini, uses `cms.settings` as Django settings module

### Code Quality
- **Pre-commit hooks**: `pre-commit install` then `pre-commit run --all`
- **Linting tools**: flake8, pylint (see requirements-dev.txt)
- **Code formatting**: Black with 200 char line length (pyproject.toml)

## Architecture

### Backend (Django)
- **Main app**: `cms/` - contains settings, URLs, Celery configuration
- **Core models**: Users, media files, categories, playlists
- **Key apps**: `files/`, `users/`, `uploader/`, `actions/`
- **API**: Django REST Framework with Swagger documentation at `/swagger/`
- **Task processing**: Celery with Redis broker for video transcoding
- **Authentication**: Django Allauth with SAML support

### Frontend (React)
- **Location**: `frontend/` directory
- **Build system**: Custom webpack configuration in `config/`
- **Package manager**: npm with package-lock.json
- **Local packages**: Custom player and build scripts in `packages/`
- **State management**: Flux architecture
- **Key dependencies**: React 17, axios, video.js, PDF.js

### Infrastructure
- **Database**: PostgreSQL (configurable via environment)
- **Cache/Queue**: Redis for caching and Celery task queue
- **Media processing**: FFMPEG for video transcoding with multiple profiles
- **File storage**: Local filesystem with configurable paths

## Development Workflow

### Setting Up
1. Use Docker development environment for consistency
2. Frontend development server provides hot reloading
3. Backend changes require container restart (use `make build-frontend`)

### Adding Features
- Backend: Follow Django app structure, add to appropriate app in root directory
- Frontend: Components in `frontend/src/`, follow existing Flux patterns
- API: Use DRF serializers and viewsets, document in Swagger
- Database changes: Create Django migrations with `python manage.py makemigrations`

### Testing Strategy  
- Python tests use pytest-django with factory-boy for fixtures
- Test structure mirrors app structure in `tests/` directory
- Selenium tests available for end-to-end testing
- Frontend testing setup not specified in current configuration

## Key Configuration Files

- **Django settings**: `cms/settings.py` with local overrides in `cms/local_settings.py`
- **Development settings**: `cms/dev_settings.py`  
- **Frontend config**: `frontend/config/mediacms.config.js`
- **Docker dev**: `docker-compose-dev.yaml` for local development
- **Requirements**: `requirements.txt` (prod) and `requirements-dev.txt`

## Media Processing

MediaCMS handles multiple media types (video, audio, images, PDFs) with:
- Automatic transcoding to multiple resolutions (240p-1080p)
- HLS adaptive streaming support
- Multiple codec profiles (h264, h265, vp9)
- Thumbnail generation
- Subtitle/CC support

## Environment Variables

Key environment variables for development:
- `DEVELOPMENT_MODE=True` - enables development features
- `DJANGO_SETTINGS_MODULE=cms.settings` - Django settings module
- Various service flags for Docker (ENABLE_UWSGI, ENABLE_CELERY_*, etc.)