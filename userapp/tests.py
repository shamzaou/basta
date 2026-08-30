"""
Regression tests for the two 2FA bugs reported by the team (Aug 2026 audit):

  1. "2FA email is very slow to arrive"  -> login_view called send_mail() synchronously,
     with no EMAIL_TIMEOUT, so the HTTP response waited for the whole SMTP round-trip to
     Gmail (and returned 500 if it failed).
  2. "A correct 2FA code is sometimes rejected" -> the OTP was stored in Django's default
     LocMemCache, which is private to each process. Gunicorn runs 3 workers, so the
     verify-otp request usually hit a worker that never saw the code.
     Secondary causes: a second click on "Sign In" regenerated the code (making the
     first email stale) and the comparison did not tolerate surrounding whitespace.
"""
import re
import time
import threading

from django.core import mail
from django.core.cache import cache
from django.core.cache.backends.locmem import LocMemCache
from django.core.mail.backends.locmem import EmailBackend as LocMemEmailBackend
from django.test import TestCase, Client, override_settings

from .models import User

LOCMEM_EMAIL = 'django.core.mail.backends.locmem.EmailBackend'


class SlowLocMemEmailBackend(LocMemEmailBackend):
    """Simulates a slow SMTP server: every send blocks for SLOW_SECONDS."""
    SLOW_SECONDS = 1.5

    def send_messages(self, messages):
        time.sleep(self.SLOW_SECONDS)
        return super().send_messages(messages)


class FailingEmailBackend(LocMemEmailBackend):
    def send_messages(self, messages):
        raise RuntimeError("SMTP down")


def wait_for_outbox(count, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if len(mail.outbox) >= count:
            return True
        time.sleep(0.05)
    return False


def otp_from_email(message):
    m = re.search(r'\b(\d{6})\b', message.body)
    assert m, "no 6-digit code in email body: %r" % message.body
    return m.group(1)


@override_settings(EMAIL_BACKEND=LOCMEM_EMAIL)
class TwoFactorLoginTests(TestCase):
    PASSWORD = 'Str0ng!Passw0rd'

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='alice', email='alice@example.com', password=self.PASSWORD,
            two_factor_enabled=True,
        )
        self.client = Client()

    def login(self, client=None):
        client = client or self.client
        return client.post('/api/auth/login/',
                           {'email': self.user.email, 'password': self.PASSWORD},
                           content_type='application/json')

    def verify(self, otp, client=None):
        client = client or self.client
        return client.post('/api/auth/verify-otp/',
                           {'email': self.user.email, 'otp': otp},
                           content_type='application/json')

    # ---- bug 2: code rejected -------------------------------------------------------

    def test_otp_store_is_shared_across_worker_processes(self):
        """The OTP must live in a store every Gunicorn worker can read (DB cache), not
        in per-process memory. LocMemCache is exactly the bug."""
        from django.core.cache import caches
        self.assertNotIsInstance(caches['default'], LocMemCache,
                                 "OTP cache is per-process; verify-otp fails on other workers")

    def test_correct_otp_from_email_is_accepted(self):
        r = self.login()
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.json()['requires_2fa'])
        self.assertTrue(wait_for_outbox(1))
        otp = otp_from_email(mail.outbox[0])

        r = self.verify(otp)
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertEqual(body['status'], 'success')
        self.assertIn('access_token', body)
        self.assertIn('refresh_token', body)   # frontend stores it; was missing before
        # code is single-use
        self.assertEqual(self.verify(otp).status_code, 400)

    def test_otp_with_surrounding_whitespace_is_accepted(self):
        self.login()
        self.assertTrue(wait_for_outbox(1))
        otp = otp_from_email(mail.outbox[0])
        self.assertEqual(self.verify('  ' + otp + ' ').status_code, 200)

    def test_otp_sent_as_number_is_accepted(self):
        self.login()
        self.assertTrue(wait_for_outbox(1))
        otp = otp_from_email(mail.outbox[0])
        self.assertEqual(self.verify(int(otp)).status_code, 200)

    def test_second_login_does_not_invalidate_first_emailed_code(self):
        """User clicks Sign In twice (emails were slow). The code from the FIRST email
        must still work - previously it was overwritten by a fresh random code."""
        self.login()
        self.login()
        self.assertTrue(wait_for_outbox(2))
        first, second = otp_from_email(mail.outbox[0]), otp_from_email(mail.outbox[1])
        self.assertEqual(first, second)
        self.assertEqual(self.verify(first).status_code, 200)

    def test_wrong_otp_is_rejected(self):
        self.login()
        self.assertTrue(wait_for_outbox(1))
        otp = otp_from_email(mail.outbox[0])
        wrong = '000000' if otp != '000000' else '111111'
        r = self.verify(wrong)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()['message'], 'Invalid OTP')

    def test_expired_otp_is_rejected(self):
        self.login()
        self.assertTrue(wait_for_outbox(1))
        otp = otp_from_email(mail.outbox[0])
        cache.delete('otp_%s' % self.user.id)   # simulate TTL expiry
        self.assertEqual(self.verify(otp).status_code, 400)

    # ---- bug 1: slow email --------------------------------------------------------

    @override_settings(EMAIL_BACKEND='userapp.tests.SlowLocMemEmailBackend')
    def test_login_returns_before_slow_email_is_delivered(self):
        t0 = time.monotonic()
        r = self.login()
        elapsed = time.monotonic() - t0
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.json()['requires_2fa'])
        self.assertLess(elapsed, SlowLocMemEmailBackend.SLOW_SECONDS,
                        "login blocked on SMTP for %.2fs" % elapsed)
        # ...but the email still goes out, in the background
        self.assertTrue(wait_for_outbox(1, timeout=SlowLocMemEmailBackend.SLOW_SECONDS + 3))
        self.assertIn(self.user.email, mail.outbox[0].to)

    @override_settings(EMAIL_BACKEND='userapp.tests.FailingEmailBackend')
    def test_email_failure_is_logged_not_500(self):
        with self.assertLogs('userapp.views', level='ERROR') as logs:
            r = self.login()
            # give the background thread time to fail and log
            deadline = time.time() + 3
            while time.time() < deadline and not logs.output:
                time.sleep(0.05)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(any('OTP' in line for line in logs.output), logs.output)

    def test_email_timeout_is_configured(self):
        from django.conf import settings
        self.assertIsNotNone(getattr(settings, 'EMAIL_TIMEOUT', None),
                             "without EMAIL_TIMEOUT a hung SMTP connection blocks a worker forever")


class NoTwoFactorLoginTests(TestCase):
    def test_login_without_2fa_returns_tokens(self):
        User.objects.create_user(username='bob', email='bob@example.com',
                                 password='Str0ng!Passw0rd', two_factor_enabled=False)
        r = Client().post('/api/auth/login/', {'email': 'bob@example.com', 'password': 'Str0ng!Passw0rd'},
                          content_type='application/json')
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertFalse(body['requires_2fa'])
        self.assertIn('access_token', body)
        self.assertIn('refresh_token', body)


class GdprTests(TestCase):
    """GDPR module: export (local data management), deletion, inactive-account cleanup."""
    PASSWORD = 'Str0ng!Passw0rd'

    def setUp(self):
        from .models import MatchHistory
        self.user = User.objects.create_user(username='carol', email='carol@example.com',
                                             password=self.PASSWORD, display_name='Carol C')
        self.friend = User.objects.create_user(username='dave', email='dave@example.com', password=self.PASSWORD)
        self.user.add_friend(self.friend)
        MatchHistory.objects.create(user=self.user, game_type='PONG', opponent='AI', result='WIN', score='3-1')
        MatchHistory.objects.create(user=self.user, game_type='TICTACTOE', opponent='Player 2', result='LOSS', score='0-1')
        self.client = Client()
        self.client.force_login(self.user)

    def test_export_contains_profile_and_history(self):
        r = self.client.get('/api/auth/export-data/')
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body['user_information']['email'], 'carol@example.com')
        self.assertEqual(body['statistics']['games_played'], 2)
        self.assertEqual(len(body['match_history']), 2)

    def test_delete_account_removes_user_and_history(self):
        from .models import MatchHistory
        r = self.client.delete('/api/auth/delete-account/')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(User.objects.filter(email='carol@example.com').exists())
        self.assertEqual(MatchHistory.objects.count(), 0)

    def test_inactive_user_cleanup_command(self):
        from datetime import timedelta
        from io import StringIO
        from django.core.management import call_command
        from django.utils import timezone
        old = User.objects.create_user(username='ghost', email='ghost@example.com', password=self.PASSWORD)
        User.objects.filter(pk=old.pk).update(last_activity=timezone.now() - timedelta(days=30 * 7))
        out = StringIO()
        with override_settings(EMAIL_BACKEND=LOCMEM_EMAIL):
            call_command('delete_inactive_users', '--dry-run', stdout=out)
            self.assertTrue(User.objects.filter(pk=old.pk).exists())   # dry run keeps it
            call_command('delete_inactive_users', stdout=out)
        self.assertFalse(User.objects.filter(pk=old.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())   # active user untouched


PNG_1X1 = ('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==')


class RegistrationAndLoginValidationTests(TestCase):
    """Aug-2026 bug sweep: #3 duplicate accounts, #4 email case, #16 email format, #21 bad JSON, #27 similarity."""
    PASSWORD = 'Str0ng!Passw0rd'

    def register(self, **over):
        body = {'username': 'newuser', 'email': 'new@example.com', 'password1': self.PASSWORD,
                'password2': self.PASSWORD, 'enable_2fa': False}
        body.update(over)
        return Client().post('/api/auth/register/', body, content_type='application/json')

    def test_duplicate_email_and_username_are_400_not_500(self):
        User.objects.create_user(username='taken', email='taken@example.com', password=self.PASSWORD)
        r = self.register(username='other', email='Taken@Example.com')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()['message'], 'Email already registered')
        r = self.register(username='TAKEN', email='fresh@example.com')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()['message'], 'Username already taken')
        self.assertNotIn('duplicate key', r.content.decode())

    def test_invalid_email_rejected(self):
        r = self.register(email='not-an-email')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()['message'], 'Invalid email address')

    def test_email_is_case_insensitive_for_login(self):
        r = self.register(username='casey', email='Upper.Name@Example.com')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(User.objects.get(username='casey').email, 'upper.name@example.com')
        r = Client().post('/api/auth/login/', {'email': 'UPPER.name@example.com', 'password': self.PASSWORD},
                          content_type='application/json')
        self.assertEqual(r.status_code, 200, r.content)

    def test_password_similar_to_username_is_rejected(self):
        r = self.register(username='alicewonderland', email='alice@example.com',
                          password1='Alicewonderland1!', password2='Alicewonderland1!')
        self.assertEqual(r.status_code, 400)
        self.assertTrue(any('similar' in e.lower() for e in r.json().get('errors', [])), r.content)

    def test_login_with_malformed_json_is_400(self):
        r = Client().post('/api/auth/login/', 'not json', content_type='application/json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()['message'], 'Invalid JSON format')


class ProfileAndMatchValidationTests(TestCase):
    """Aug-2026 bug sweep: #13 2FA toggle, #16 email, #17 ISO dates, #19 avatar checks, #20 match data, #28 inactive users."""
    PASSWORD = 'Str0ng!Passw0rd'

    def setUp(self):
        from .models import MatchHistory
        self.user = User.objects.create_user(username='erin', email='erin@example.com', password=self.PASSWORD)
        MatchHistory.objects.create(user=self.user, game_type='PONG', opponent='AI', result='WIN', score='3-1')
        self.client = Client()
        self.client.force_login(self.user)

    def put(self, body):
        return self.client.put('/api/auth/profile/', body, content_type='application/json')

    def test_two_factor_can_be_toggled_from_profile(self):
        self.assertFalse(self.client.get('/api/auth/profile/').json()['two_factor_enabled'])
        r = self.put({'two_factor_enabled': True})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.json()['two_factor_enabled'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.two_factor_enabled)
        self.put({'two_factor_enabled': False})
        self.user.refresh_from_db()
        self.assertFalse(self.user.two_factor_enabled)

    def test_profile_email_is_validated_and_lowercased(self):
        self.assertEqual(self.put({'email': 'broken'}).status_code, 400)
        r = self.put({'email': 'New.Mail@Example.com'})
        self.assertEqual(r.status_code, 200, r.content)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'new.mail@example.com')

    def test_match_dates_are_iso_8601(self):
        from datetime import datetime
        d = self.client.get('/api/auth/profile/').json()['match_history'][0]['date']
        datetime.fromisoformat(d)
        d = self.client.get('/api/auth/match-history/').json()['match_history'][0]['date']
        datetime.fromisoformat(d)

    def test_avatar_upload_validation(self):
        import base64
        big = 'data:image/png;base64,' + base64.b64encode(b'\x00' * (2 * 1024 * 1024 + 1)).decode()
        r = self.put({'profile_picture': big})
        self.assertEqual(r.status_code, 400)
        self.assertIn('too large', r.json()['message'])
        fake = 'data:image/png;base64,' + base64.b64encode(b'definitely not a png').decode()
        self.assertEqual(self.put({'profile_picture': fake}).json()['message'], 'Invalid image')
        self.assertEqual(self.put({'profile_picture': PNG_1X1.replace('image/png', 'image/svg+xml')}).status_code, 400)
        r = self.put({'profile_picture': PNG_1X1})
        self.assertEqual(r.status_code, 200, r.content)
        self.user.refresh_from_db()
        self.assertEqual(self.user.profile_picture.name.count('profile_pictures/'), 1)
        r = self.client.get(f'/api/auth/avatar/{self.user.id}/')
        self.assertEqual(r['Content-Type'], 'image/png')

    def test_save_match_rejects_bad_data(self):
        post = lambda b: self.client.post('/api/auth/save-match/', b, content_type='application/json')
        self.assertEqual(post({'game_type': 'PONG', 'opponent': 'AI', 'result': 'WINNER', 'score': '3-0'}).status_code, 400)
        self.assertEqual(post({'game_type': 'PONG', 'opponent': 'AI', 'result': 'WIN', 'score': 'abc'}).status_code, 400)
        self.assertEqual(post({'game_type': 'CHESS', 'opponent': 'AI', 'result': 'WIN', 'score': '1-0'}).status_code, 400)
        self.assertEqual(post({'game_type': 'TICTACTOE', 'opponent': 'Player 2', 'result': 'DRAW', 'score': '0-0'}).status_code, 201)

    def test_users_list_hides_inactive_accounts(self):
        User.objects.create_user(username='ghost', email='ghost@example.com', password=self.PASSWORD, is_active=False)
        User.objects.create_user(username='live', email='live@example.com', password=self.PASSWORD)
        names = [u['username'] for u in self.client.get('/api/auth/users/').json()['users']]
        self.assertIn('live', names)
        self.assertNotIn('ghost', names)


class InactiveCleanupResilienceTests(TestCase):
    """Aug-2026 bug sweep #12: a failing mail server must not prevent GDPR deletion."""

    @override_settings(EMAIL_BACKEND='userapp.tests.FailingEmailBackend')
    def test_user_deleted_even_when_email_fails(self):
        from datetime import timedelta
        from io import StringIO
        from django.core.management import call_command
        from django.utils import timezone
        old = User.objects.create_user(username='old', email='old@example.com', password='Str0ng!Passw0rd')
        User.objects.filter(pk=old.pk).update(last_activity=timezone.now() - timedelta(days=30 * 7))
        call_command('delete_inactive_users', stdout=StringIO())
        self.assertFalse(User.objects.filter(pk=old.pk).exists())
