# tournaments/urls.py

from django.urls import path
from . import views

app_name = 'tournaments'

urlpatterns = [
    # Вся логика под /api/tournaments/:
    path('api/tournaments/create/', views.create_tournament, name='create_tournament'),
    path('api/tournaments/<int:tournament_id>/add_players/', views.add_players, name='add_players'),
    path('api/tournaments/<int:tournament_id>/', views.view_tournament, name='view_tournament'),

    path('api/tournaments/match/<int:match_id>/start/', views.start_match, name='start_match'),
    path('api/tournaments/<int:match_id>/finish/', views.finish_match, name='finish_match'),
    path('api/tournaments/<int:game_id>/details/', views.get_match_details, name='get_match_details'),
]
