# backend/urls.py
from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from gameapp.views import index
from tournaments import views as tournament_views  # Renamed to avoid confusion

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('userapp.urls')),
    
    # Regular tournament routes
    path('tournaments/', include('tournaments.urls')),
    
    # API endpoints for SPA
    path('api/tournaments/', include([
        path('create/', tournament_views.create_tournament, name='api_create_tournament'),
        path('<int:tournament_id>/add_players/', tournament_views.add_players, name='api_add_players'),
        path('<int:tournament_id>/', tournament_views.view_tournament, name='api_view_tournament'),
        path('match/<int:match_id>/start/', tournament_views.start_match, name='api_start_match'),
        path('match/<int:match_id>/finish/', tournament_views.finish_match, name='api_finish_match'),
    ])),
    
    # Keep catch-all route at the end
    re_path(r'^.*$', index, name='index'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)