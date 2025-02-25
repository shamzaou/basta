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
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'userapp_user'

    def get_display_name(self):
        """Return display_name if set, otherwise return username"""
        return self.display_name if self.display_name else self.username
