# ...existing code...

# 42 OAuth Settings
FORTYTWO_CLIENT_ID = 'your_client_id'  # Replace with your actual client ID
FORTYTWO_CLIENT_SECRET = 'your_client_secret'  # Replace with your actual client secret
FORTYTWO_REDIRECT_URI = 'https://localhost/oauth/callback'  # Your redirect URI

# JWT Settings
import datetime
JWT_AUTH = {
    'JWT_SECRET_KEY': SECRET_KEY,
    'JWT_ALGORITHM': 'HS256',
    'JWT_EXPIRATION_DELTA': datetime.timedelta(days=1),
}

# ...existing code...
