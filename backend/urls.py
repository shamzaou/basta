# backend/urls.py
from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from gameapp.views import index
from tournaments import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('userapp.urls')),
    path('tournaments/', include('tournaments.urls')),
    # path('tournaments/api/tournaments/create/', views.create_tournament),
    # Keep your catch-all route at the end
    
    # (WRONG!) Redirect all requsests from backend and frontend to the index.html
    # re_path(r'^.*$', index, name='index'),

    # (CORRECT!) Redirect only request related to frontend that not contain a '/api' in url
    re_path(r'^(?!.*api)', index, name='index'),

    # Catch-all для фронтенда, исключая все пути с /api и /tournaments
    # re_path(r'^(?!/api/|/tournaments/)(?:.*)$', index, name='index'),
    
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)