# userapp/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    display_name = models.CharField(max_length=150, blank=True, null=True)
    email = models.EmailField(unique=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    is_42_user = models.BooleanField(default=False)
    intra_id = models.CharField(max_length=50, null=True, blank=True)
    two_factor_enabled = models.BooleanField(default=False)
    
    # Override username to ensure it's unique
    username = models.CharField(max_length=150, unique=True)
    
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='custom_user_set',
        blank=True,
        help_text='The groups this user belongs to.'
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='custom_user_set',
        blank=True,
        help_text='Specific permissions for this user.'
    )
    
    # Add a many-to-many relationship for friends
    friends = models.ManyToManyField('self', symmetrical=False, related_name='friend_of')
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'userapp_user'

    def get_display_name(self):
        """Return display_name if set, otherwise return username"""
        return self.display_name if self.display_name else self.username

    def add_friend(self, friend):
        """Add a user as friend"""
        if friend != self and friend not in self.friends.all():
            self.friends.add(friend)
            return True
        return False
    
    def remove_friend(self, friend):
        """Remove a user from friends"""
        if friend in self.friends.all():
            self.friends.remove(friend)
            return True
        return False

class MatchHistory(models.Model):
    GAME_CHOICES = (
        ('PONG', 'Pong'),
        ('TICTACTOE', 'TicTacToe'),
    )
    
    RESULT_CHOICES = (
        ('WIN', 'Win'),
        ('LOSS', 'Loss'),
        ('DRAW', 'Draw'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches')
    game_type = models.CharField(max_length=10, choices=GAME_CHOICES)
    opponent = models.CharField(max_length=150)
    result = models.CharField(max_length=4, choices=RESULT_CHOICES)
    score = models.CharField(max_length=10)  # Format: "user_score-opponent_score"
    date_played = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-date_played']
        verbose_name_plural = 'Match Histories'
    
    def __str__(self):
        return f"{self.user.username} vs {self.opponent} - {self.result}"
