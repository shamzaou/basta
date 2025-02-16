from django.apps import AppConfig


class GameappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'gameapp'
    
    def ready(self):
        import gameapp.signals
