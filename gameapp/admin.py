from django.contrib import admin
from .models import Game, Player, Score, TicTacToeQueue, TicTacToeMatch  # Import your models

# Register your models
@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ('id', 'created_at', 'status')
    list_filter = ('status',)
    search_fields = ('id',)

@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ('user', 'score')
    search_fields = ('user__username',)

@admin.register(Score)
class ScoreAdmin(admin.ModelAdmin):
    list_display = ('player', 'points', 'recorded_at')
    list_filter = ('recorded_at',)

@admin.register(TicTacToeQueue)
class TicTacToeQueueAdmin(admin.ModelAdmin):
    list_display = ('user', 'rating', 'joined_at')

@admin.register(TicTacToeMatch)
class TicTacToeMatchAdmin(admin.ModelAdmin):
    list_display = ('id', 'player_x', 'player_o', 'status', 'winner', 'updated_at')
    list_filter = ('status',)
