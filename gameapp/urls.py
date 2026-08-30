from django.urls import path
from . import views

app_name = 'gameapp'

# Mounted at /api/game/ (see backend/urls.py)
urlpatterns = [
    path('ttt/queue/', views.ttt_queue, name='ttt-queue'),
    path('ttt/match/<int:match_id>/', views.ttt_match, name='ttt-match'),
    path('ttt/match/<int:match_id>/move/', views.ttt_move, name='ttt-move'),
    path('ttt/match/<int:match_id>/leave/', views.ttt_leave, name='ttt-leave'),
]
