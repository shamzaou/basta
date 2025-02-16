from django.db.models.signals import post_save
from django.dispatch import receiver
from userapp.models import User
from gameapp.models import Player

@receiver(post_save, sender=User)
def create_player_profile(sender, instance, created, **kwargs):
    if created:
        print(f"Creating player profile for user: {instance.username}")  # Debug log
        Player.objects.create(
            user=instance,
            # Add any default values you want to set
            score=0
        )
        print("Player profile created successfully")  # Debug log

@receiver(post_save, sender=User)
def save_player_profile(sender, instance, **kwargs):
    try:
        if hasattr(instance, 'player'):
            instance.player.save()
            print(f"Player profile saved for user: {instance.username}")  # Debug log
    except Player.DoesNotExist:
        print(f"Player profile doesn't exist for user: {instance.username}")  # Debug log