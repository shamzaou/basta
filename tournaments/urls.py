from django.urls import path
from . import views

app_name = 'tournaments'

urlpatterns = [
    path('create/', views.create_tournament, name='create_tournament'),
    path('<int:tournament_id>/add_players/', views.add_players, name='add_players'),
    path('<int:tournament_id>/', views.view_tournament, name='view_tournament'),  # Tournament view
    path('match/<int:match_id>/start/', views.start_match, name='start_match'),  # Start match
    path('match/<int:match_id>/finish/', views.finish_match, name='finish_match'),  # Finish match
    path('<int:game_id>/details/', views.get_match_details, name='get_match_details'),  # Match details
]

