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
