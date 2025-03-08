
import datetime
from django.utils import timezone
from django.conf import settings

class UserActivityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Only update last_activity for authenticated users
        if request.user.is_authenticated:
            # Don't update on every request to avoid excessive database writes
            # Only update if significant time has passed
            update_window = getattr(settings, 'LAST_ACTIVITY_UPDATE_WINDOW', 15)
            
            should_update = False
            
            if not hasattr(request.user, 'last_activity') or request.user.last_activity is None:
                should_update = True
            elif request.user.last_activity < (timezone.now() - datetime.timedelta(minutes=update_window)):
                should_update = True
            
            if should_update:
                request.user.update_last_activity()
        
        return response
