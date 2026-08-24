// static/frontend/js/i18n.js
//
// Minimal client-side internationalisation for the SPA (Accessibility module:
// "multiple language support"). Added in the Aug-2026 audit.
//
// How it works:
//   * Every static UI string in templates/frontend/index.html carries a
//     data-i18n="key" attribute (or data-i18n-placeholder="key" for inputs).
//   * applyLanguage(lang) walks those elements and swaps textContent/placeholder
//     from the TRANSLATIONS table below, sets <html lang="..."> and remembers the
//     choice in localStorage ("lang").
//   * The <select class="lang-select"> elements in the nav (one per nav list) call
//     applyLanguage on change; they are kept in sync with each other.
//   * window.t(key) is exposed for the few strings created from JS.
//
// Falls back to English for any key missing from a language.

(function () {
    const TRANSLATIONS = {
        en: {
            'nav.home': 'Home', 'nav.about': 'About', 'nav.login': 'Log in', 'nav.register': 'Register',
            'nav.tictactoe': 'TicTacToe', 'nav.profile': 'Profile', 'nav.settings': 'Settings', 'nav.logout': 'Logout',
            'nav.language': 'Language',
            'home.tagline1': 'Welcome to Fast Pong, a unique 3D experience of the classic game of Pong(1972)!',
            'home.tagline2': 'Play with your friends, have exciting tournaments and see who will be the best player.',
            'home.tagline3': 'Ready to compete? Let the strongest man win!',
            'home.play': 'PLAY NOW', 'home.tournament': 'TOURNAMENT',
            'profile.title': 'Player Profile', 'profile.joined': 'Joined:', 'profile.games_played': 'Games Played',
            'profile.win_rate': 'Win Rate', 'profile.best_score': 'Best Score', 'profile.recent_matches': 'Recent Matches',
            'profile.friends': 'Friends', 'profile.my_friends': 'My Friends', 'profile.find_users': 'Find Users',
            'profile.search_friends': 'Search friends...', 'profile.find_users_placeholder': 'Find users...',
            'settings.title': 'User Settings', 'settings.profile_info': 'Profile Information', 'settings.username': 'Username',
            'settings.email': 'Email Address', 'settings.display_name': 'Display Name (Optional)', 'settings.edit': 'Edit',
            'settings.avatar': 'Avatar', 'settings.choose_avatar': 'Choose New Avatar',
            'settings.avatar_note': 'Note: Uploaded avatars are stored securely and will be automatically compressed. Maximum file size: 5MB.',
            'settings.data_privacy': 'Data & Privacy', 'settings.download': 'Download My Data',
            'settings.download_note': 'Your data includes: profile information, game history, statistics, and preferences. Format: JSON',
            'settings.save_changes': 'Save Changes', 'settings.save': 'Save Settings',
            'settings.danger': 'Danger Zone', 'settings.danger_text': 'Once you delete your account, there is no going back. Please be certain.',
            'settings.anonymize': 'Anonymize My Account',
            'settings.anonymize_note': 'Replaces your username, email and avatar with anonymous values and disables login. Your game statistics are kept without any personal data.',
            'settings.delete': 'Delete My Account',
            'settings.delete_note': 'This will permanently delete your account and all associated data. This action cannot be undone.',
            'game.title': 'Pong Game', 'tictactoe.title': 'TicTacToe',
            'about.title': 'About FAST_PONG', 'about.story': 'Our Story',
            'about.story1': 'FAST_PONG was created as a modern homage to the classic Pong game released in 1972. Our goal was to combine retro gaming nostalgia with modern web technologies to create an engaging multiplayer experience.',
            'about.story2': 'This project was developed as part of the 42 School curriculum, where a team of passionate developers came together to create a unique gaming platform.',
            'about.team': 'The Team', 'about.tech': 'Technologies Used', 'about.features': 'Project Features',
            'about.privacy': 'Privacy Policy', 'about.disclaimer': 'Legal Disclaimer',
            'login.title': 'Welcome to FAST_PONG', 'login.email': 'Email:', 'login.password': 'Password:',
            'login.signin': 'Sign In', 'login.42': 'Sign in with 42',
            'register.title': 'Create Account', 'register.username': 'Username:', 'register.email': 'Email:',
            'register.password': 'Password:', 'register.confirm': 'Confirm:', 'register.enable2fa': 'Enable Two-Factor Authentication',
            'register.help': "If enabled, you'll need to enter a code sent to your email when logging in", 'register.submit': 'Register',
            'tournament.title': 'Tournament', 'tournament.create': 'Create Tournament',
            'tournament.participants': 'Number of Participants (3-8):', 'tournament.next': 'Next',
            'tournament.add_players': 'Add Players', 'tournament.go': 'Go!', 'tournament.players': 'Players:',
            'tournament.regular': 'Regular Matches:', 'tournament.tiebreak': 'Tiebreaker Matches:',
            'th.player1': 'Player 1', 'th.player2': 'Player 2', 'th.score': 'Score', 'th.winner': 'Winner', 'th.action': 'Action',
            'tournament.home': 'Return to Home',
            'otp.title': 'Two-Factor Authentication Required', 'otp.text': 'A verification code has been sent to your email.',
            'otp.placeholder': 'Enter 6-digit code', 'otp.verify': 'Verify Code',
            'js.confirm_anonymize': 'Anonymize your account? You will be logged out and will not be able to log in again. Your statistics are kept without personal data.',
            'js.anonymized': 'Your account has been anonymized.',
        },
        fr: {
            'nav.home': 'Accueil', 'nav.about': 'À propos', 'nav.login': 'Connexion', 'nav.register': "S'inscrire",
            'nav.tictactoe': 'Morpion', 'nav.profile': 'Profil', 'nav.settings': 'Paramètres', 'nav.logout': 'Déconnexion',
            'nav.language': 'Langue',
            'home.tagline1': 'Bienvenue sur Fast Pong, une expérience 3D unique du jeu classique Pong (1972) !',
            'home.tagline2': 'Jouez avec vos amis, organisez des tournois palpitants et découvrez qui sera le meilleur joueur.',
            'home.tagline3': 'Prêt à concourir ? Que le plus fort gagne !',
            'home.play': 'JOUER', 'home.tournament': 'TOURNOI',
            'profile.title': 'Profil du joueur', 'profile.joined': 'Inscrit :', 'profile.games_played': 'Parties jouées',
            'profile.win_rate': 'Taux de victoire', 'profile.best_score': 'Meilleur score', 'profile.recent_matches': 'Matchs récents',
            'profile.friends': 'Amis', 'profile.my_friends': 'Mes amis', 'profile.find_users': 'Trouver des joueurs',
            'profile.search_friends': 'Rechercher des amis...', 'profile.find_users_placeholder': 'Trouver des joueurs...',
            'settings.title': 'Paramètres', 'settings.profile_info': 'Informations du profil', 'settings.username': "Nom d'utilisateur",
            'settings.email': 'Adresse e-mail', 'settings.display_name': "Nom d'affichage (optionnel)", 'settings.edit': 'Modifier',
            'settings.avatar': 'Avatar', 'settings.choose_avatar': 'Choisir un nouvel avatar',
            'settings.avatar_note': 'Remarque : les avatars sont stockés de manière sécurisée et compressés automatiquement. Taille maximale : 5 Mo.',
            'settings.data_privacy': 'Données et confidentialité', 'settings.download': 'Télécharger mes données',
            'settings.download_note': 'Vos données comprennent : profil, historique des parties, statistiques et préférences. Format : JSON',
            'settings.save_changes': 'Enregistrer', 'settings.save': 'Enregistrer les paramètres',
            'settings.danger': 'Zone de danger', 'settings.danger_text': 'La suppression de votre compte est définitive. Soyez-en certain.',
            'settings.anonymize': 'Anonymiser mon compte',
            'settings.anonymize_note': "Remplace votre nom d'utilisateur, e-mail et avatar par des valeurs anonymes et désactive la connexion. Vos statistiques sont conservées sans aucune donnée personnelle.",
            'settings.delete': 'Supprimer mon compte',
            'settings.delete_note': 'Cette action supprime définitivement votre compte et toutes les données associées. Elle est irréversible.',
            'game.title': 'Jeu Pong', 'tictactoe.title': 'Morpion',
            'about.title': 'À propos de FAST_PONG', 'about.story': 'Notre histoire',
            'about.story1': "FAST_PONG est un hommage moderne au jeu Pong sorti en 1972. Notre objectif : marier la nostalgie du rétro-gaming aux technologies web modernes pour créer une expérience multijoueur captivante.",
            'about.story2': "Ce projet a été développé dans le cadre du cursus de l'école 42, par une équipe de développeurs passionnés réunis pour créer une plateforme de jeu unique.",
            'about.team': "L'équipe", 'about.tech': 'Technologies utilisées', 'about.features': 'Fonctionnalités',
            'about.privacy': 'Politique de confidentialité', 'about.disclaimer': 'Mentions légales',
            'login.title': 'Bienvenue sur FAST_PONG', 'login.email': 'E-mail :', 'login.password': 'Mot de passe :',
            'login.signin': 'Se connecter', 'login.42': 'Se connecter avec 42',
            'register.title': 'Créer un compte', 'register.username': "Nom d'utilisateur :", 'register.email': 'E-mail :',
            'register.password': 'Mot de passe :', 'register.confirm': 'Confirmer :', 'register.enable2fa': "Activer l'authentification à deux facteurs",
            'register.help': 'Si activée, un code envoyé par e-mail vous sera demandé à chaque connexion', 'register.submit': "S'inscrire",
            'tournament.title': 'Tournoi', 'tournament.create': 'Créer un tournoi',
            'tournament.participants': 'Nombre de participants (3-8) :', 'tournament.next': 'Suivant',
            'tournament.add_players': 'Ajouter les joueurs', 'tournament.go': 'Go !', 'tournament.players': 'Joueurs :',
            'tournament.regular': 'Matchs réguliers :', 'tournament.tiebreak': 'Matchs de départage :',
            'th.player1': 'Joueur 1', 'th.player2': 'Joueur 2', 'th.score': 'Score', 'th.winner': 'Vainqueur', 'th.action': 'Action',
            'tournament.home': "Retour à l'accueil",
            'otp.title': 'Authentification à deux facteurs requise', 'otp.text': 'Un code de vérification a été envoyé à votre adresse e-mail.',
            'otp.placeholder': 'Code à 6 chiffres', 'otp.verify': 'Vérifier le code',
            'js.confirm_anonymize': 'Anonymiser votre compte ? Vous serez déconnecté et ne pourrez plus vous reconnecter. Vos statistiques sont conservées sans données personnelles.',
            'js.anonymized': 'Votre compte a été anonymisé.',
        },
        ru: {
            'nav.home': 'Главная', 'nav.about': 'О проекте', 'nav.login': 'Войти', 'nav.register': 'Регистрация',
            'nav.tictactoe': 'Крестики-нолики', 'nav.profile': 'Профиль', 'nav.settings': 'Настройки', 'nav.logout': 'Выйти',
            'nav.language': 'Язык',
            'home.tagline1': 'Добро пожаловать в Fast Pong — уникальную 3D-версию классической игры Pong (1972)!',
            'home.tagline2': 'Играйте с друзьями, проводите захватывающие турниры и узнайте, кто лучший игрок.',
            'home.tagline3': 'Готовы соревноваться? Пусть победит сильнейший!',
            'home.play': 'ИГРАТЬ', 'home.tournament': 'ТУРНИР',
            'profile.title': 'Профиль игрока', 'profile.joined': 'Дата регистрации:', 'profile.games_played': 'Сыграно игр',
            'profile.win_rate': 'Процент побед', 'profile.best_score': 'Лучший счёт', 'profile.recent_matches': 'Последние матчи',
            'profile.friends': 'Друзья', 'profile.my_friends': 'Мои друзья', 'profile.find_users': 'Найти игроков',
            'profile.search_friends': 'Поиск друзей...', 'profile.find_users_placeholder': 'Поиск игроков...',
            'settings.title': 'Настройки пользователя', 'settings.profile_info': 'Информация профиля', 'settings.username': 'Имя пользователя',
            'settings.email': 'Электронная почта', 'settings.display_name': 'Отображаемое имя (необязательно)', 'settings.edit': 'Изменить',
            'settings.avatar': 'Аватар', 'settings.choose_avatar': 'Выбрать новый аватар',
            'settings.avatar_note': 'Примечание: аватары хранятся безопасно и автоматически сжимаются. Максимальный размер файла: 5 МБ.',
            'settings.data_privacy': 'Данные и конфиденциальность', 'settings.download': 'Скачать мои данные',
            'settings.download_note': 'Ваши данные включают: профиль, историю игр, статистику и настройки. Формат: JSON',
            'settings.save_changes': 'Сохранить изменения', 'settings.save': 'Сохранить настройки',
            'settings.danger': 'Опасная зона', 'settings.danger_text': 'После удаления аккаунта пути назад нет. Будьте уверены.',
            'settings.anonymize': 'Анонимизировать аккаунт',
            'settings.anonymize_note': 'Заменяет имя пользователя, e-mail и аватар анонимными значениями и отключает вход. Статистика игр сохраняется без личных данных.',
            'settings.delete': 'Удалить мой аккаунт',
            'settings.delete_note': 'Аккаунт и все связанные данные будут удалены навсегда. Это действие нельзя отменить.',
            'game.title': 'Игра Pong', 'tictactoe.title': 'Крестики-нолики',
            'about.title': 'О FAST_PONG', 'about.story': 'Наша история',
            'about.story1': 'FAST_PONG — современное посвящение классической игре Pong 1972 года. Мы соединили ностальгию по ретро-играм с современными веб-технологиями, чтобы создать увлекательный многопользовательский опыт.',
            'about.story2': 'Проект разработан в рамках учебной программы школы 42 командой увлечённых разработчиков.',
            'about.team': 'Команда', 'about.tech': 'Технологии', 'about.features': 'Возможности проекта',
            'about.privacy': 'Политика конфиденциальности', 'about.disclaimer': 'Правовая оговорка',
            'login.title': 'Добро пожаловать в FAST_PONG', 'login.email': 'E-mail:', 'login.password': 'Пароль:',
            'login.signin': 'Войти', 'login.42': 'Войти через 42',
            'register.title': 'Создать аккаунт', 'register.username': 'Имя пользователя:', 'register.email': 'E-mail:',
            'register.password': 'Пароль:', 'register.confirm': 'Подтверждение:', 'register.enable2fa': 'Включить двухфакторную аутентификацию',
            'register.help': 'Если включено, при входе потребуется код, отправленный на вашу почту', 'register.submit': 'Зарегистрироваться',
            'tournament.title': 'Турнир', 'tournament.create': 'Создать турнир',
            'tournament.participants': 'Количество участников (3-8):', 'tournament.next': 'Далее',
            'tournament.add_players': 'Добавить игроков', 'tournament.go': 'Поехали!', 'tournament.players': 'Игроки:',
            'tournament.regular': 'Основные матчи:', 'tournament.tiebreak': 'Дополнительные матчи:',
            'th.player1': 'Игрок 1', 'th.player2': 'Игрок 2', 'th.score': 'Счёт', 'th.winner': 'Победитель', 'th.action': 'Действие',
            'tournament.home': 'На главную',
            'otp.title': 'Требуется двухфакторная аутентификация', 'otp.text': 'Код подтверждения отправлен на вашу почту.',
            'otp.placeholder': 'Введите 6-значный код', 'otp.verify': 'Проверить код',
            'js.confirm_anonymize': 'Анонимизировать аккаунт? Вы выйдете из системы и не сможете войти снова. Статистика сохранится без личных данных.',
            'js.anonymized': 'Ваш аккаунт анонимизирован.',
        },
    };

    const LANG_NAMES = { en: 'EN', fr: 'FR', ru: 'RU' };
    const DEFAULT_LANG = 'en';

    function currentLanguage() {
        try {
            const saved = localStorage.getItem('lang');
            if (saved && TRANSLATIONS[saved]) return saved;
        } catch (e) { /* localStorage unavailable */ }
        const browser = (navigator.language || DEFAULT_LANG).slice(0, 2).toLowerCase();
        return TRANSLATIONS[browser] ? browser : DEFAULT_LANG;
    }

    function t(key, lang) {
        lang = lang || currentLanguage();
        const table = TRANSLATIONS[lang] || {};
        return table[key] !== undefined ? table[key] : (TRANSLATIONS[DEFAULT_LANG][key] !== undefined ? TRANSLATIONS[DEFAULT_LANG][key] : key);
    }

    function applyLanguage(lang) {
        if (!TRANSLATIONS[lang]) lang = DEFAULT_LANG;
        try { localStorage.setItem('lang', lang); } catch (e) { /* ignore */ }
        document.documentElement.lang = lang;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.getAttribute('data-i18n'), lang);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = t(el.getAttribute('data-i18n-placeholder'), lang);
        });
        document.querySelectorAll('.lang-select').forEach(sel => {
            if (sel.value !== lang) sel.value = lang;
            sel.setAttribute('aria-label', t('nav.language', lang));
        });
    }

    function buildSelectors() {
        document.querySelectorAll('.lang-select').forEach(sel => {
            if (sel.options.length === 0) {
                Object.keys(TRANSLATIONS).forEach(code => {
                    const opt = document.createElement('option');
                    opt.value = code;
                    opt.textContent = LANG_NAMES[code] || code.toUpperCase();
                    sel.appendChild(opt);
                });
            }
            sel.addEventListener('change', () => applyLanguage(sel.value));
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        buildSelectors();
        applyLanguage(currentLanguage());
    });

    window.t = t;
    window.applyLanguage = applyLanguage;
    window.availableLanguages = Object.keys(TRANSLATIONS);
})();
