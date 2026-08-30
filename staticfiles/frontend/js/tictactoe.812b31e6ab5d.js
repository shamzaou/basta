// static/frontend/js/tictactoe.js

class TicTacToeGame {
    constructor(container) {
        this.container = container;
        this.gameActive = true;
        this.currentPlayer = "X";
        this.gameState = ["", "", "", "", "", "", "", "", ""];
        this.lastStateUpdate = 0;

        // 'local' = two players on one keyboard (original behaviour),
        // 'online' = matchmaking queue against another logged-in user
        this.mode = null;
        this.online = { matchId: null, symbol: null, queued: false, finished: false, state: null };
        this.queuePoll = null;
        this.statePoll = null;

        this.state = {
            matchId: null,
            matchStartTime: null,
            gameStatus: 'playing',
            winner: null,
            score: { playerX: 0, playerO: 0 }
        };

        this.winningConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        // Bound once so cleanup() can remove exactly these listeners
        this.onCellClick = (e) => this.handleCellClick(e.target);
        this.onRestart = () => this.handleRestart();
        this.onOnlineCellClick = (e) => this.handleOnlineCellClick(e.target);

        this.setupStyles();
        this.showModeSelector();
    }

    setupStyles() {
        // Inject the game styles once per page, not once per game instance
        if (document.getElementById('tictactoe-styles')) return;
        const style = document.createElement('style');
        style.id = 'tictactoe-styles';
        style.textContent = `
            #game-board {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                max-width: 300px;
                margin: 0 auto;
            }

            .cell {
                aspect-ratio: 1;
                background-color: rgba(255, 255, 255, 0.1);
                border: 2px solid #00ff00;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2em;
                font-family: 'Press Start 2P', cursive;
                color: #ffffff;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .cell:hover {
                background-color: rgba(255, 255, 255, 0.2);
            }

            .cell.disabled {
                cursor: not-allowed;
                opacity: 0.6;
            }

            #status {
                text-align: center;
                margin-top: 1em;
                font-family: 'Press Start 2P', cursive;
                font-size: 1em;
                color: #00ff00;
            }

            #ttt-players {
                text-align: center;
                margin: 0.5em 0 1em;
                font-family: 'Press Start 2P', cursive;
                font-size: 0.7em;
                color: #ffffff;
            }

            #reset-btn, .ttt-mode-button, #ttt-cancel-btn {
                display: block;
                width: 260px;
                background-color: #00ff00;
                color: #000000;
                padding: 0.75em 1.5em;
                border: none;
                border-radius: 5px;
                transition: all 0.3s ease;
                font-family: 'Press Start 2P', cursive;
                font-size: 0.75em;
                text-align: center;
                margin: 1.25em auto 0;
                cursor: pointer;
            }

            #reset-btn:hover, .ttt-mode-button:hover, #ttt-cancel-btn:hover {
                background-color: #ff00ff;
                transform: scale(1.05);
            }

            .ttt-mode-selection {
                text-align: center;
                padding: 1em 0;
            }
        `;
        document.head.appendChild(style);
    }

    // ------------------------------------------------------------------ mode selection

    showModeSelector() {
        this.stopPolling();
        this.mode = null;
        this.container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'ttt-mode-selection';

        this.statusDisplay = document.createElement('div');
        this.statusDisplay.id = 'status';
        this.statusDisplay.textContent = 'Choose a game mode';
        wrapper.appendChild(this.statusDisplay);

        const localBtn = document.createElement('button');
        localBtn.type = 'button';
        localBtn.className = 'ttt-mode-button';
        localBtn.textContent = 'Local (2 players, one keyboard)';
        localBtn.addEventListener('click', () => this.startLocal());
        wrapper.appendChild(localBtn);

        const onlineBtn = document.createElement('button');
        onlineBtn.type = 'button';
        onlineBtn.className = 'ttt-mode-button';
        onlineBtn.textContent = 'Online — find an opponent';
        onlineBtn.addEventListener('click', () => this.startOnline());
        wrapper.appendChild(onlineBtn);

        this.container.appendChild(wrapper);
    }

    startLocal() {
        this.mode = 'local';
        this.gameActive = true;
        this.currentPlayer = "X";
        this.gameState = ["", "", "", "", "", "", "", "", ""];
        this.state.winner = null;
        this.state.gameStatus = 'playing';
        this.setupGameBoard();
        this.initializeMatch();
    }

    // ------------------------------------------------------------------ local game (original)

    setupGameBoard() {
        // Clear container
        this.container.innerHTML = '';

        // Create status display
        this.statusDisplay = document.createElement('div');
        this.statusDisplay.id = 'status';
        this.container.appendChild(this.statusDisplay);

        // Create game board
        this.gameBoard = document.createElement('div');
        this.gameBoard.id = 'game-board';

        // Create cells
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.setAttribute('data-cell-index', i);
            cell.addEventListener('click', this.onCellClick);
            this.gameBoard.appendChild(cell);
        }
        this.container.appendChild(this.gameBoard);

        // Create reset button
        this.resetButton = document.createElement('button');
        this.resetButton.id = 'reset-btn';
        this.resetButton.textContent = 'RESET GAME';
        this.resetButton.addEventListener('click', this.onRestart);
        this.container.appendChild(this.resetButton);

        this.updateStatusDisplay();
    }

    updateStatusDisplay() {
        if (this.gameActive) {
            this.statusDisplay.textContent = `It's ${this.currentPlayer}'s turn`;
        } else if (this.state.winner) {
            this.statusDisplay.textContent = `Player ${this.state.winner} has won!`;
        } else {
            this.statusDisplay.textContent = `Game ended in a draw!`;
        }
    }

    apiFetch(url, options = {}) {
        // authFetch (script.js) refreshes an expired JWT and retries; plain fetch as fallback
        const doFetch = window.authFetch || fetch;
        const headers = Object.assign({ 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') }, options.headers || {});
        if (!window.authFetch) headers['Authorization'] = `Bearer ${localStorage.getItem('authToken')}`;
        return doFetch(url, Object.assign({}, options, { headers, credentials: 'include' }));
    }

    async initializeMatch() {
        try {
            const response = await this.apiFetch('/api/auth/match/create/', {
                method: 'POST',
                body: JSON.stringify({
                    game_type: 'TICTACTOE',
                    mode: 'local'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            this.state.matchId = data.match_id;
            this.state.matchStartTime = new Date();
            this.state.gameStatus = 'playing';

            return data.match_id;
        } catch (error) {
            console.error('Failed to initialize Tic-Tac-Toe match:', error);
            return null;
        }
    }

    async finishMatch() {
        try {
            // Always use "Player 2" for opponent in local TicTacToe (hot-seat, no AI)
            const opponent = "Player 2";

            let userScore = 0;
            let opponentScore = 0;

            // Determine result and assign scores
            let result = 'DRAW';
            if (this.state.winner === 'X') {
                result = 'WIN';
                userScore = 1;  // Player X wins, gets 1 point
            } else if (this.state.winner === 'O') {
                result = 'LOSS';
                opponentScore = 1;  // Player O wins, gets 1 point
            }

            const scoreString = `${userScore}-${opponentScore}`;

            // Send result to backend
            const response = await this.apiFetch('/api/auth/save-match/', {
                method: 'POST',
                body: JSON.stringify({
                    game_type: 'TICTACTOE',
                    opponent: opponent,
                    result: result,
                    score: scoreString
                })
            });

            if (!response.ok) {
                const responseText = await response.text();
                console.error("Failed to save match history:", responseText);
                throw new Error(responseText);
            }
        } catch (error) {
            console.error('Failed to save Tic-Tac-Toe match:', error);
        }
    }

    handleCellClick(clickedCell) {
        const clickedCellIndex = parseInt(clickedCell.getAttribute('data-cell-index'));

        if (this.gameState[clickedCellIndex] !== "" || !this.gameActive) {
            return;
        }

        this.gameState[clickedCellIndex] = this.currentPlayer;
        clickedCell.textContent = this.currentPlayer;

        this.checkResult();
    }

    checkResult() {
        let roundWon = false;

        for (let i = 0; i < this.winningConditions.length; i++) {
            const [a, b, c] = this.winningConditions[i];
            if (this.gameState[a] === '' ||
                this.gameState[b] === '' ||
                this.gameState[c] === '') {
                continue;
            }
            if (this.gameState[a] === this.gameState[b] &&
                this.gameState[b] === this.gameState[c]) {
                roundWon = true;
                break;
            }
        }

        if (roundWon) {
            this.state.winner = this.currentPlayer;
            this.state.score[`player${this.currentPlayer}`]++;
            this.gameActive = false;
            this.finishMatch();
            this.updateStatusDisplay();
            return; // Exit the function here after a win is detected
        }

        // Only check for a draw if there's no win
        if (!this.gameState.includes("")) {
            this.gameActive = false;
            this.state.gameStatus = 'draw';
            this.finishMatch();
            this.updateStatusDisplay();
            return;
        }

        this.currentPlayer = this.currentPlayer === "X" ? "O" : "X";
        this.updateStatusDisplay();
    }

    handleRestart() {
        this.gameActive = true;
        this.currentPlayer = "X";
        this.state.winner = null;
        this.state.gameStatus = 'playing';
        this.gameState = ["", "", "", "", "", "", "", "", ""];

        this.container.querySelectorAll('.cell').forEach(cell => cell.textContent = "");
        this.updateStatusDisplay();
        this.initializeMatch();
    }

    // ------------------------------------------------------------------ online matchmaking

    async startOnline() {
        this.mode = 'online';
        this.online = { matchId: null, symbol: null, queued: true, finished: false, state: null };
        this.container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'ttt-mode-selection';

        this.statusDisplay = document.createElement('div');
        this.statusDisplay.id = 'status';
        this.statusDisplay.textContent = 'Searching for an opponent…';
        wrapper.appendChild(this.statusDisplay);

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'ttt-cancel-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => this.cancelQueue());
        wrapper.appendChild(cancelBtn);

        this.container.appendChild(wrapper);

        await this.pollQueue();
        if (this.online.queued) {
            this.queuePoll = setInterval(() => this.pollQueue(), 2000);
        }
    }

    async pollQueue() {
        if (!this.online.queued) return;
        try {
            const response = await this.apiFetch('/api/game/ttt/queue/', { method: 'POST' });
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    this.statusDisplay.textContent = 'Please log in to play online';
                } else {
                    this.statusDisplay.textContent = 'Matchmaking is unavailable right now';
                }
                return;
            }
            const data = await response.json();
            if (data.status === 'matched') {
                this.online.queued = false;
                if (this.queuePoll) { clearInterval(this.queuePoll); this.queuePoll = null; }
                this.online.matchId = data.match_id;
                this.online.symbol = data.symbol;
                this.setupOnlineBoard();
                await this.fetchState();
                this.statePoll = setInterval(() => this.fetchState(), 1000);
            } else {
                const n = typeof data.queued === 'number' ? data.queued : 0;
                this.statusDisplay.textContent = `Searching for an opponent… (${n} waiting)`;
            }
        } catch (error) {
            console.error('Matchmaking error:', error);
        }
    }

    async cancelQueue() {
        this.online.queued = false;
        if (this.queuePoll) { clearInterval(this.queuePoll); this.queuePoll = null; }
        try {
            await this.apiFetch('/api/game/ttt/queue/', { method: 'DELETE' });
        } catch (error) {
            // leaving the queue is best-effort
        }
        this.showModeSelector();
    }

    setupOnlineBoard() {
        this.container.innerHTML = '';

        this.statusDisplay = document.createElement('div');
        this.statusDisplay.id = 'status';
        this.statusDisplay.textContent = 'Opponent found!';
        this.container.appendChild(this.statusDisplay);

        this.playersDisplay = document.createElement('div');
        this.playersDisplay.id = 'ttt-players';
        this.container.appendChild(this.playersDisplay);

        this.gameBoard = document.createElement('div');
        this.gameBoard.id = 'game-board';
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.setAttribute('data-cell-index', i);
            cell.addEventListener('click', this.onOnlineCellClick);
            this.gameBoard.appendChild(cell);
        }
        this.container.appendChild(this.gameBoard);

        this.resetButton = document.createElement('button');
        this.resetButton.id = 'reset-btn';
        this.resetButton.textContent = 'PLAY AGAIN';
        this.resetButton.style.display = 'none';
        this.resetButton.addEventListener('click', () => this.showModeSelector());
        this.container.appendChild(this.resetButton);
    }

    async fetchState() {
        if (!this.online.matchId) return;
        try {
            const response = await this.apiFetch(`/api/game/ttt/match/${this.online.matchId}/`, { method: 'GET' });
            if (!response.ok) {
                if (response.status === 404) {
                    this.stopPolling();
                    this.statusDisplay.textContent = 'This match no longer exists';
                    this.resetButton.style.display = 'block';
                }
                return;
            }
            this.renderOnline(await response.json());
        } catch (error) {
            console.error('Failed to load match state:', error);
        }
    }

    renderOnline(state) {
        this.online.state = state;
        const me = state.you || this.online.symbol;
        const board = (state.board || '.........').split('');
        const myTurn = state.status === 'active' && state.turn === me;

        // Player names (textContent only - never HTML)
        const nameOf = (p) => p ? (p.display_name || p.username || '?') : '?';
        const px = state.players ? state.players.X : null;
        const po = state.players ? state.players.O : null;
        this.playersDisplay.textContent = `${nameOf(px)} (X)  vs  ${nameOf(po)} (O)`;

        this.container.querySelectorAll('.cell').forEach((cell, i) => {
            cell.textContent = board[i] === '.' ? '' : board[i];
            if (myTurn && board[i] === '.') {
                cell.classList.remove('disabled');
            } else {
                cell.classList.add('disabled');
            }
        });

        if (state.status === 'finished') {
            this.stopPolling();
            this.online.finished = true;
            if (!state.winner) {
                this.statusDisplay.textContent = 'Draw';
            } else if (state.winner === me) {
                this.statusDisplay.textContent = 'You won!';
            } else {
                this.statusDisplay.textContent = 'You lost';
            }
            this.resetButton.style.display = 'block';
        } else {
            this.statusDisplay.textContent = `You are ${me} — ${myTurn ? 'your turn' : "opponent's turn"}`;
        }
    }

    async handleOnlineCellClick(clickedCell) {
        const index = parseInt(clickedCell.getAttribute('data-cell-index'));
        const state = this.online.state;
        if (!state || state.status !== 'active') return;
        const me = state.you || this.online.symbol;
        if (state.turn !== me) return;
        if ((state.board || '.........')[index] !== '.') return;

        try {
            const response = await this.apiFetch(`/api/game/ttt/match/${this.online.matchId}/move/`, {
                method: 'POST',
                body: JSON.stringify({ cell: index })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                alert(data.error || 'Move rejected');
                await this.fetchState();
                return;
            }
            this.renderOnline(data);
        } catch (error) {
            console.error('Failed to send move:', error);
        }
    }

    stopPolling() {
        if (this.queuePoll) { clearInterval(this.queuePoll); this.queuePoll = null; }
        if (this.statePoll) { clearInterval(this.statePoll); this.statePoll = null; }
    }

    cleanup() {
        this.stopPolling();
        // Leaving the page: forfeit an active online match / leave the queue (best effort)
        if (this.mode === 'online') {
            if (this.online.matchId && !this.online.finished) {
                this.apiFetch(`/api/game/ttt/match/${this.online.matchId}/leave/`, { method: 'POST' }).catch(() => {});
            } else if (this.online.queued) {
                this.online.queued = false;
                this.apiFetch('/api/game/ttt/queue/', { method: 'DELETE' }).catch(() => {});
            }
        }
        this.container.querySelectorAll('.cell').forEach(cell => {
            cell.removeEventListener('click', this.onCellClick);
            cell.removeEventListener('click', this.onOnlineCellClick);
        });
        this.resetButton?.removeEventListener('click', this.onRestart);
    }
}

export default TicTacToeGame;
