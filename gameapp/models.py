from django.db import models
from django.conf import settings
from userapp.models import User

class Game(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'Waiting'),
        ('active', 'Active'),
        ('finished', 'Finished')
    ]

    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='waiting')

    class Meta:
        ordering = ['-created_at']

class Player(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    score = models.IntegerField(default=0)

    def __str__(self):
        return self.user.username

class Score(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='scores')
    points = models.IntegerField()
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-recorded_at']


# ---------------------------------------------------------------------------
# Online TicTacToe matchmaking (Gameplay module: "Another game with user history
# and matchmaking"). Added Aug 2026.
# ---------------------------------------------------------------------------

class TicTacToeQueue(models.Model):
    """One row per user waiting for an opponent. rating = TicTacToe win rate (0-100)."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='ttt_queue_entry')
    rating = models.FloatField(default=50.0)
    joined_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} ({self.rating:.0f})"


class TicTacToeMatch(models.Model):
    STATUS_CHOICES = [('active', 'Active'), ('finished', 'Finished')]
    EMPTY_BOARD = '.........'

    player_x = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ttt_matches_as_x')
    player_o = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ttt_matches_as_o')
    board = models.CharField(max_length=9, default=EMPTY_BOARD)
    turn = models.CharField(max_length=1, default='X')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    winner = models.CharField(max_length=1, blank=True, default='')   # 'X', 'O' or '' (draw / unfinished)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    WIN_LINES = ((0, 1, 2), (3, 4, 5), (6, 7, 8), (0, 3, 6), (1, 4, 7), (2, 5, 8), (0, 4, 8), (2, 4, 6))

    class Meta:
        ordering = ['-created_at']

    def symbol_of(self, user):
        if user.id == self.player_x_id:
            return 'X'
        if user.id == self.player_o_id:
            return 'O'
        return None

    def player_for(self, symbol):
        return self.player_x if symbol == 'X' else self.player_o

    def check_winner(self):
        for a, b, c in self.WIN_LINES:
            if self.board[a] != '.' and self.board[a] == self.board[b] == self.board[c]:
                return self.board[a]
        return ''

    def __str__(self):
        return f"{self.player_x.username} (X) vs {self.player_o.username} (O) [{self.status}]"
