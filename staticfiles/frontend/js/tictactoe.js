// static/frontend/js/tictactoe.js

class TicTacToeGame {
    constructor(container) {
        this.container = container;
        this.gameActive = true;
        this.currentPlayer = "X";
        this.gameState = ["", "", "", "", "", "", "", "", ""];
        this.lastStateUpdate = 0;

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

        this.setupStyles();
        this.setupGameBoard();
        this.initializeMatch();
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

            #status {
                text-align: center;
                margin-top: 1em;
                font-family: 'Press Start 2P', cursive;
                font-size: 1em;
                color: #00ff00;
            }

            #reset-btn {
                display: block;
                width: 200px;
                background-color: #00ff00;
                color: #000000;
                padding: 0.75em 1.5em;
                border: none;
                border-radius: 5px;
                transition: all 0.3s ease;
                font-family: 'Press Start 2P', cursive;
                font-size: 0.875em;
                text-align: center;
                margin: 1.25em auto 0;
                cursor: pointer;
            }

            #reset-btn:hover {
                background-color: #ff00ff;
                transform: scale(1.05);
            }
        `;
        document.head.appendChild(style);
    }

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
            this.statusDisplay.innerHTML = `It's ${this.currentPlayer}'s turn`;
        } else if (this.state.winner) {
            this.statusDisplay.innerHTML = `Player ${this.state.winner} has won!`;
        } else {
            this.statusDisplay.innerHTML = `Game ended in a draw!`;
        }
    }

    async initializeMatch() {
        try {
            const token = localStorage.getItem('authToken');
            // authFetch (script.js) refreshes an expired JWT and retries; plain fetch as fallback
            const doFetch = window.authFetch || fetch;
            const headers = { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') };
            if (!window.authFetch) headers['Authorization'] = `Bearer ${token}`;

            const response = await doFetch('/api/auth/match/create/', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    game_type: 'TICTACTOE',
                    mode: 'vsAI'
                })
            });
    
            if (!response.ok) {
                throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);
            }
    
            const data = await response.json();
            console.log("Match initialized:", data);
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
            console.log("I am in finishMatch");
    
            // Get player names safely
            const player1Element = document.getElementById('player1-name');
            
            // Set default player names
            const currentUser = player1Element ? player1Element.textContent : "Player 1";
            // Always use "Player 2" for opponent in TicTacToe since there's no AI
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
    
            const tokenFM = localStorage.getItem('authToken');
            const doFetch = window.authFetch || fetch;
            const headers = { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') };
            if (!window.authFetch) headers['Authorization'] = `Bearer ${tokenFM}`;

            // Send result to backend
            const response = await doFetch('/api/auth/save-match/', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    game_type: 'TICTACTOE',
                    opponent: opponent,
                    result: result,
                    score: scoreString
                })
            });
    
            const responseText = await response.text();  // Capture response as text
            console.log("Response from backend:", responseText);
    
            if (!response.ok) {
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
        clickedCell.innerHTML = this.currentPlayer;

        this.checkResult();
    }

    checkResult() {
        let roundWon = false;
        let winningLine = null;

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
                winningLine = [a, b, c];
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
        this.gameState = ["", "", "", "", "", "", "", "", ""];
        
        document.querySelectorAll('.cell').forEach(cell => cell.innerHTML = "");
        this.updateStatusDisplay();
        this.initializeMatch();
    }

    cleanup() {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.removeEventListener('click', this.onCellClick);
        });
        this.resetButton?.removeEventListener('click', this.onRestart);
    }
}

export default TicTacToeGame;