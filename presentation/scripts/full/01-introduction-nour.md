# 01 · Introduction — Nour (slides 3–5, about 1.5 minutes)

> Simple English. Short sentences. Speak slowly. It is OK to look at the slide.

---

## Slide 3 — Section divider

Hello everyone. My name is Nour. I am one of the four members of the team.
I will start with the introduction of our project.

---

## Slide 4 — Project Overview

Our project is called **Ft_transcendence**. It is the capstone project of 42 Abu Dhabi.

It is a website for games.

The main game is **Pong**. But it is not the old flat Pong — it is **Pong in 3D**. You can play with a friend on one keyboard, or you can play against the computer.

We also have a **second game**: **Tic-Tac-Toe**. Two players play on one computer. Every game is saved in the player's history.

Around the games, the website has everything a real platform needs:
- You can create an account, or you can log in with your **42 account**.
- You can turn on **two-factor authentication**. Then you get a code by e-mail when you log in.
- Every player has a **profile** with statistics and a list of all the matches.
- You can add **friends**, and you can see if a friend is online.
- You can create **tournaments**.
- And you can control your data: download it, make it anonymous, or delete your account. This is for **GDPR**.

Now the technology. The backend is **Django**. This is a Python framework. The database is **PostgreSQL**. The frontend uses **Bootstrap** and JavaScript. The 3D game uses **Three.js**.

Everything runs in **Docker**, and the site uses **HTTPS**.

One more thing. The site is a **Single Page Application**. This means: the server sends the first page, and after that, JavaScript changes the page. The browser does not reload.

---

## Slide 5 — Project Objectives

At the beginning, we set six goals.

**One** — a working game platform. Pong in 3D, and Tic-Tac-Toe.

**Two** — secure login. E-mail and password, login with 42, two-factor authentication, and JWT tokens.

**Three** — user profiles. A display name, an avatar, friends, statistics, and match history.

**Four** — tournament mode. Three to eight players. Everyone plays against everyone. At the end, one winner.

**Five** — security and GDPR. Protection against attacks like SQL injection and XSS. And users can export, anonymize, or delete their data.

**Six** — team work. We used Agile, Git branches, and code review.

That is the introduction. Now **Ali** will explain how we organised the work.

---

## If they ask you a question

- *"What is a Single Page Application?"* — "The server sends one HTML page. Then JavaScript changes the content. The page does not reload."
- *"Why Django?"* — "The subject asks for Django for the backend module. It is also a strong framework with security built in."
- *"Where does the 3D come from?"* — "Three.js. It uses WebGL in the browser. Salim will explain it later."
- If you do not know: "Good question. My teammate will answer this in a later section." Then look at Salim or Nasser.
