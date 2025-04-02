from django.core.exceptions import ValidationError
import re


class PasswordStrengthValidator:
    """
    Validate that the password:
    1. Contains at least 1 uppercase letter
    2. Contains at least 1 special character
    3. Contains at least 1 number
    """
    
    def validate(self, password, user=None):
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                "Password must contain at least 1 uppercase letter.",
                code='password_no_uppercase',
            )
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>\[\]\\\/\-_+=;]', password):
            raise ValidationError(
                "Password must contain at least 1 special character (!@#$%^&*(),.?\":{}|<>[]\\/-_+=;)",
                code='password_no_special_char',
            )
            
        if not re.search(r'[0-9]', password):
            raise ValidationError(
                "Password must contain at least 1 number.",
                code='password_no_number',
            )
    
    def get_help_text(self):
        return (
            "Your password must contain at least: "
            "1 uppercase letter, 1 number, and 1 special character."
        )
