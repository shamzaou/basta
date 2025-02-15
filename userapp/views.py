# userapp/views.py
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth import login, logout, authenticate
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from decouple import config
import json
import jwt
from .models import User
from django.core.mail import send_mail

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
        # Debug request content
        print("Request content type:", request.content_type)
        print("Raw request body:", request.body)
        
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password1')
        password2 = data.get('password2')
        username = data.get('username')
        
        print(f"Registration attempt - Data received: {data}")
        
        # Validate all required fields with specific error messages
        missing_fields = []
        if not email: missing_fields.append('email')
        if not password: missing_fields.append('password')
        if not password2: missing_fields.append('password confirmation')
        if not username: missing_fields.append('username')
        
        if missing_fields:
            return JsonResponse({
                'status': 'error',
                'message': f'Missing required fields: {", ".join(missing_fields)}'
            }, status=400)
        
        try:
            # Create user without logging in first to test creation
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )
            print(f"User created successfully with ID: {user.id}")
            
            # Now try to log in
            login(request, user)
            print("User logged in successfully")
            
            return JsonResponse({
                'status': 'success',
                'user': {
                    'username': user.username,
                    'email': user.email
                }
            })
            
        except Exception as user_error:
            print(f"Error creating user: {str(user_error)}")
            return JsonResponse({
                'status': 'error',
                'message': f'User creation failed: {str(user_error)}'
            }, status=500)
            
    except json.JSONDecodeError as e:
        print(f"JSON Decode Error: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': f'Invalid JSON format: {str(e)}'
        }, status=400)
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': f'Registration failed: {str(e)}'
        }, status=500)

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

@csrf_exempt
def redirect_uri(request):
    if request.method == 'POST':
        try:
            intra_link = config('INTRA_LINK')
            if not intra_link:
                return JsonResponse({"error": "INTRA_LINK not set in environment"}, status=500)
            # Log the link to check if it's correctly set
            print("INTRA_LINK:", intra_link)
            return JsonResponse({"oauth_link": intra_link})
        except Exception as e:
            return JsonResponse({"error": f"Exception: {str(e)}"}, status=500)
    return JsonResponse({'error': "Method not allowed"}, status=405)


@csrf_exempt
def oauth_callback(request):
    if request.method == 'GET':  # Change to GET for handling redirect
        code = request.GET.get('code')

        if not code:
            return JsonResponse({'message': 'Authorization code not provided'}, status=400)

        REDIRECT_URI = config('REDIRECT_URI', default='')
        CLIENT_ID = config('CLIENT_ID', default='')
        CLIENT_SECRET = config('CLIENT_SECRET', default='')

        # Exchange the authorization code for an access token
        token_url = 'https://api.intra.42.fr/oauth/token'
        token_data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': settings.REDIRECT_URI,
            'client_id': settings.CLIENT_ID,
            'client_secret': settings.CLIENT_SECRET
        }
        token_response = requests.post(token_url, data=token_data)
        if token_response.status_code != 200:
            return JsonResponse({'message': 'Failed to retrieve access token'}, status=400)

        token_info = token_response.json()
        access_token = token_info.get('access_token')

        # Retrieve user information using the access token
        user_info_url = 'https://api.intra.42.fr/v2/me'
        headers = {'Authorization': f'Bearer {access_token}'}
        user_info_response = requests.get(user_info_url, headers=headers)
        if user_info_response.status_code != 200:
            return JsonResponse({'message': 'Failed to retrieve user info'}, status=400)

        user_info = user_info_response.json()
        username = user_info.get('login')
        email = user_info.get('email')

        if not username:
            return JsonResponse({'message': 'Failed to retrieve username'}, status=400)

        # Get or create user in Django
        user, created = User.objects.get_or_create(username=username)
        if created:
            user.email = email
            user.set_unusable_password()  # Password is managed externally
            user.save()

        # Generate JWT token
        token = jwt.encode({
            'username': user.username,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=settings.JWT_SETTINGS['JWT_EXP_DELTA_SECONDS'])
        }, settings.JWT_SETTINGS['JWT_SECRET_KEY'], algorithm=settings.JWT_SETTINGS['JWT_ALGORITHM'])

        return JsonResponse({'message': 'Login successful', 'token': token, 'username': username}, status=200)

    return JsonResponse({'message': 'Only GET requests are allowed'}, status=405)

# @api_view(['POST'])
# def verify_otp_view(request):
#     username = request.data.get('username')
#     otp = request.data.get('otp')

#     # Debugging: Log incoming data
#     logger.debug(f"Received username: {username}")
#     logger.debug(f"Received OTP: {otp}")

#     if not username or not otp:
#         return Response({"error": "Username and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)

#     try:
#         user = User.objects.get(username=username)
#         cache_key = f"otp_{user.id}"
#         cached_otp = cache.get(cache_key)

#         # Debugging: Log cached OTP
#         logger.debug(f"Cached OTP for user {user.username}: {cached_otp}")

#         if cached_otp == otp:
#             token = jwt.encode(
#                 {"username": user.username, "exp": datetime.datetime.utcnow() + datetime.timedelta(days=1)},
#                 settings.SECRET_KEY,
#                 algorithm="HS256"
#             )
#             return Response({"message": "OTP verified successfully.", "token": token}, status=status.HTTP_200_OK)
#         else:
#             return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)
#     except User.DoesNotExist:
#         return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
