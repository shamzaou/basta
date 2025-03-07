
import logging
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail
from userapp.models import User

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Delete users who have been inactive for the configured period (default: 6 months)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Do not actually delete users, just show what would happen',
        )
        parser.add_argument(
            '--notify-only',
            action='store_true',
            help='Only send notification emails, do not delete users',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        notify_only = options['notify_only']
        
        # Get settings with defaults
        inactive_months = getattr(settings, 'INACTIVE_USER_DELETE_MONTHS', 6)
        warning_months = getattr(settings, 'INACTIVE_USER_WARNING_MONTHS', 5)
        
        # Calculate thresholds
        inactive_threshold = timezone.now() - timedelta(days=30*inactive_months)
        warning_threshold = timezone.now() - timedelta(days=30*warning_months)
        
        # Get users to warn (inactive for warning_months but not yet delete_months)
        users_to_warn = User.objects.filter(
            last_activity__lt=warning_threshold,
            last_activity__gt=inactive_threshold,
            is_staff=False,
            is_superuser=False
        )
        
        # Get users to delete (inactive for delete_months)
        users_to_delete = User.objects.filter(
            last_activity__lt=inactive_threshold,
            is_staff=False,
            is_superuser=False
        )
        
        # Warn users
        for user in users_to_warn:
            # Skip users who were already warned in the last month
            if user.last_warned_date and user.last_warned_date > (timezone.now() - timedelta(days=30)):
                continue
                
            self.stdout.write(f"Warning user: {user.email}, last active: {user.last_activity}")
            if not dry_run:
                try:
                    self._send_warning_email(user, inactive_months)
                    # Mark as warned
                    user.last_warned_date = timezone.now()
                    user.save(update_fields=['last_warned_date'])
                except Exception as e:
                    logger.error(f"Failed to warn user {user.email}: {str(e)}")
        
        # Delete users
        if not notify_only:
            for user in users_to_delete:
                self.stdout.write(f"Deleting inactive user: {user.email}, last active: {user.last_activity}")
                if not dry_run:
                    try:
                        # Send deletion notification
                        self._send_deletion_email(user)
                        # Delete the user
                        user.delete()
                    except Exception as e:
                        logger.error(f"Failed to delete user {user.email}: {str(e)}")
                        
        # Summary
        self.stdout.write(
            self.style.SUCCESS(
                f"Found {users_to_warn.count()} users to warn and {users_to_delete.count()} users to delete. "
                f"{'(Dry run, no actions taken)' if dry_run else ''}"
            )
        )
    
    def _send_warning_email(self, user, inactive_months):
        """Send warning email to a user before deletion"""
        subject = "Your account will be deleted due to inactivity"
        message = (
            f"Hello {user.username},\n\n"
            f"Your account on FAST_PONG has been inactive for almost {inactive_months} months. "
            f"According to our GDPR compliance policy, inactive accounts will be deleted after "
            f"{inactive_months} months of inactivity.\n\n"
            f"If you wish to keep your account, please log in within the next month.\n\n"
            f"Thank you,\n"
            f"The FAST_PONG Team"
        )
        from_email = settings.DEFAULT_FROM_EMAIL
        recipient_list = [user.email]
        
        send_mail(subject, message, from_email, recipient_list, fail_silently=False)
    
    def _send_deletion_email(self, user):
        """Send final notification that account has been deleted"""
        subject = "Your account has been deleted due to inactivity"
        message = (
            f"Hello {user.username},\n\n"
            f"Your account on FAST_PONG has been deleted due to prolonged inactivity, "
            f"in compliance with our GDPR data retention policy.\n\n"
            f"If you wish to use our services again in the future, please create a new account.\n\n"
            f"Thank you,\n"
            f"The FAST_PONG Team"
        )
        from_email = settings.DEFAULT_FROM_EMAIL
        recipient_list = [user.email]
        
        send_mail(subject, message, from_email, recipient_list, fail_silently=False)
