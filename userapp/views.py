# userapp/views.py
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth import login, logout, authenticate
from django.views.decorators.csrf import ensure_csrf_cookie
from django.contrib.auth.decorators import login_required
import json
from .models import User

@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return JsonResponse({
                'status': 'error',
                'message': 'Email and password are required.'
            }, status=400)
        
        # Since we're using email as USERNAME_FIELD
        user = authenticate(request, username=email, password=password)
        
        if user is not None:
            login(request, user)
            return JsonResponse({
                'status': 'success',
                'user': {
                    'username': user.username,
                    'email': user.email,
                    'profile_picture': user.profile_picture.url if user.profile_picture else None,
                }
            })
        else:
            return JsonResponse({
                'status': 'error',
                'message': 'Invalid email or password.'
            }, status=400)
            
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid request format.'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

@ensure_csrf_cookie
@require_POST
def register_view(request):
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password1')
        password2 = data.get('password2')
        username = data.get('username')
        
        # Validate passwords match
        if password != password2:
            return JsonResponse({
                'status': 'error',
                'message': 'Passwords do not match'
            }, status=400)

        # Create user and player profile
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )
            
            # Force player profile creation
            if not hasattr(user, 'player'):
                from gameapp.models import Player
                Player.objects.create(user=user)
            
            # Log the user in
            login(request, user)
            
            return JsonResponse({
                'status': 'success',
                'user': {
                    'username': user.username,
                    'email': user.email,
                    'player': {
                        'score': user.player.score
                    }
                }
            })
            
        except Exception as user_error:
            print(f"Error in user creation: {str(user_error)}")
            return JsonResponse({
                'status': 'error',
                'message': str(user_error)
            }, status=400)
            
    except json.JSONDecodeError as e:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON format'
        }, status=400)

@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({'status': 'success'})

@ensure_csrf_cookie
def check_auth(request):
    return JsonResponse({
        'isAuthenticated': request.user.is_authenticated,
        'user': {
            'username': request.user.username,
            'email': request.user.email,
        } if request.user.is_authenticated else None
    })
    
@login_required
@require_POST
def update_profile(request):
    try:
        data = json.loads(request.body)
        user = request.user
        
        # Update user fields
        if 'username' in data:
            user.username = data['username']
        if 'email' in data:
            user.email = data['email']
            
        # Save user changes
        user.save()
        
        # Update player profile if exists
        if hasattr(user, 'player'):
            if 'score' in data:
                user.player.score = data['score']
                user.player.save()
        
        return JsonResponse({
            'status': 'success',
            'user': {
                'username': user.username,
                'email': user.email,
                'score': user.player.score if hasattr(user, 'player') else 0
            }
        })
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)