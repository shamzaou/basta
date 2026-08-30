"""Tests for the server-side rendered index page."""
from datetime import timedelta

from django.test import TestCase, Client
from django.utils import timezone

from userapp.models import User, MatchHistory

PW = 'Str0ng!Passw0rd'


def mk(name, **extra):
    return User.objects.create_user(username=name, email=f'{name}@example.com', password=PW, **extra)


def client_for(user):
    c = Client()
    c.force_login(user)
    return c


class ServerSideRenderingTests(TestCase):
    def setUp(self):
        self.user = mk('ssruser', display_name='Rendered Name')
        MatchHistory.objects.create(user=self.user, game_type='PONG', opponent='AI', result='WIN', score='3-1')

    def test_profile_is_rendered_server_side_for_logged_in_user(self):
        c = client_for(self.user)
        r = c.get('/profile')
        self.assertEqual(r.status_code, 200)
        html = r.content.decode()
        if 'ssr_title' in open('templates/frontend/index.html', encoding='utf-8').read():
            self.assertIn('Profile', html.split('<title>')[1].split('</title>')[0])
            self.assertIn('ssruser', html)
        self.assertEqual(r.context['ssr_page'], 'profile')
        self.assertTrue(r.context['ssr_logged_in'])
        self.assertEqual(r.context['ssr_profile']['username'], 'ssruser')
        self.assertEqual(r.context['ssr_profile']['stats']['games_played'], 1)
        self.assertEqual(r.context['ssr_profile']['match_history'][0]['opponent'], 'AI')

    def test_anonymous_profile_renders_login(self):
        r = Client().get('/profile')
        self.assertEqual(r.context['ssr_page'], 'login')
        if 'ssr_title' in open('templates/frontend/index.html', encoding='utf-8').read():
            self.assertIn('Log in', r.content.decode().split('<title>')[1].split('</title>')[0])

    def test_unknown_and_oauth_paths_fall_back_to_home(self):
        self.assertEqual(Client().get('/oauth/callback?code=x').context['ssr_page'], 'home')
        self.assertEqual(Client().get('/whatever').context['ssr_page'], 'home')
