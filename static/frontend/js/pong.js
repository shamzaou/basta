// static/frontend/js/pong.js

// Game configurations and constants
const GAME_CONFIG = {
    maxBallSpeed: 0.15,
    minBallSpeed: 0.1,
    paddleSpeed: 0.15,
    aiUpdateInterval: 1000,
    pointsToWin: 3
};

// Game state enumeration
const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    FINISHED: 'finished'
};

// Game mode enumeration
const GameMode = {
    PLAYER_VS_PLAYER: 'pvp',
    PLAYER_VS_AI: 'ai'
};

// Physics class for handling game physics
class GamePhysics {
    constructor(config) {
        this.maxBallSpeed = config.maxBallSpeed;
        this.minBallSpeed = config.minBallSpeed;
        this.ballVelocity = new THREE.Vector3();
        this.ballSpin = new THREE.Vector3();
    }

    resetBall() {
        this.ballVelocity.set(
            (Math.random() > 0.5 ? this.minBallSpeed : -this.minBallSpeed),
            0,
            (Math.random() - 0.5) * 0.04
        );
        this.ballSpin.set(0, 0, 0);
        return new THREE.Vector3(0, 0.5, 0);
    }

    handlePaddleCollision(ballPos, paddlePos, isLeftPaddle) {
        const relativeIntersectZ = (paddlePos.z - ballPos.z) / 0.9;
        const bounceAngle = relativeIntersectZ * Math.PI / 4;
        
        const currentSpeed = Math.min(
            this.ballVelocity.length() * 1.05,
            this.maxBallSpeed
        );

        this.ballVelocity.x = currentSpeed * (isLeftPaddle ? Math.abs(Math.cos(bounceAngle)) : -Math.abs(Math.cos(bounceAngle)));
        this.ballVelocity.z = currentSpeed * -Math.sin(bounceAngle);
        
        this.ballSpin.z = relativeIntersectZ * 0.1;
    }

    updatePhysics(ball, paddle1, paddle2) {
        // Apply spin effect
        this.ballVelocity.z += this.ballSpin.z * 0.01;
        
        // Update ball position
        ball.position.add(this.ballVelocity);
        
        // Apply spin to ball rotation
        ball.rotation.x += this.ballVelocity.z * 0.2;
        ball.rotation.z -= this.ballVelocity.x * 0.2;

        // Wall collisions
        if (ball.position.z > 2.9 || ball.position.z < -2.9) {
            this.ballVelocity.z = -this.ballVelocity.z * 0.9;
            this.ballSpin.z *= 0.5;
        }

        // Paddle collisions with larger hitbox (increased from 0.7 to 0.9)
        if (ball.position.x < -4.7 && ball.position.z > paddle1.position.z - 0.9 && 
            ball.position.z < paddle1.position.z + 0.9) {
            this.handlePaddleCollision(ball.position, paddle1.position, true);
        }
        if (ball.position.x > 4.7 && ball.position.z > paddle2.position.z - 0.9 && 
            ball.position.z < paddle2.position.z + 0.9) {
            this.handlePaddleCollision(ball.position, paddle2.position, false);
        }

        // Scoring
        if (ball.position.x < -5) return 'player2';
        if (ball.position.x > 5) return 'player1';
        return null;
    }
}

// Renderer class for handling all THREE.js rendering
class GameRenderer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);

        // Add CSS styles
        this.injectStyles();

        // Set aspect ratio (4:3)
        this.aspectRatio = 4/3;
        
        // Calculate size based on container
        this.calculateSize();

        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.createGameObjects();
        this.createUI();

        // Handle window resizing
        window.addEventListener('resize', () => this.handleResize(), false);
    }

    createUI() {
        // Score display
        const scoreDisplay = document.createElement('div');
        scoreDisplay.id = 'score';
        scoreDisplay.className = 'ui-element';
        scoreDisplay.textContent = '00 - 00';
        this.container.appendChild(scoreDisplay);

        // Instructions
        const instructions = document.createElement('div');
        instructions.id = 'instructions';
        instructions.className = 'ui-element';
        instructions.textContent = 'P1: W/S | P2: ↑/↓ | SPACE: Pause';
        this.container.appendChild(instructions);

        // Player names
        const player1Name = document.createElement('div');
        player1Name.id = 'player1-name';
        player1Name.className = 'player-name left';
        this.container.appendChild(player1Name);

        const player2Name = document.createElement('div');
        player2Name.id = 'player2-name';
        player2Name.className = 'player-name right';
        this.container.appendChild(player2Name);

        // Add game controls container
        const gameControls = document.createElement('div');
        gameControls.id = 'game-controls';
        gameControls.className = 'ui-element game-controls';
        gameControls.style.display = 'none'; // Hidden by default

        // Add restart/next game button
        const restartButton = document.createElement('button');
        restartButton.className = 'game-button';
        restartButton.id = 'restart-button';
        gameControls.appendChild(restartButton);

        this.container.appendChild(gameControls);
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .game-container {
                position: relative;
                width: 100%;
                height: calc(100vh - 200px);
                min-height: 400px;
                max-height: 800px;
                margin: 20px auto;
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: #0a0a0a;
            }

            .ui-element {
                position: absolute;
                color: #00ccff;
                text-shadow: 0 0 10px #00ccff66;
                text-align: center;
                font-family: 'Press Start 2P', sans-serif;
                z-index: 10;
            }

            #score {
                top: 10%;
                left: 50%;
                transform: translateX(-50%);
                font-size: 2em;
            }

            #instructions {
                bottom: 5%;
                left: 50%;
                transform: translateX(-50%);
                font-size: 1em;
            }

            #modeSelection {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                display: flex;
                flex-direction: column;
                gap: 20px;
                z-index: 20;
            }

            .mode-button {
                font-size: 24px;
                color: #00ccff;
                background: transparent;
                border: 2px solid #00ccff;
                padding: 15px 30px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-family: 'Press Start 2P', sans-serif;
                text-transform: uppercase;
                letter-spacing: 2px;
                box-shadow: 0 0 10px #00ccff66;
            }

            .mode-button:hover {
                background: #00ccff22;
                box-shadow: 0 0 20px #00ccff;
            }

            .player-name {
                position: absolute;
                top: 15%;
                font-family: 'Press Start 2P', sans-serif;
                font-size: 24px;
                color: #00ff00;
                text-shadow: 2px 2px 4px rgba(0, 255, 0, 0.5);
                z-index: 10;
            }

            .player-name.left {
                left: 25%;
                transform: translateX(-50%);
            }

            .player-name.right {
                right: 25%;
                transform: translateX(50%);
            }

            #winner-screen {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: rgba(0, 0, 0, 0.9);
                padding: 30px;
                border: 4px solid #00ff00;
                border-radius: 10px;
                text-align: center;
                display: none;
                z-index: 100;
            }

            #winner-text {
                font-size: 36px;
                color: #00ff00;
                text-shadow: 2px 2px 4px rgba(0, 255, 0, 0.5);
                margin-bottom: 20px;
            }

            .return-button {
                padding: 15px 30px;
                font-family: 'Press Start 2P', sans-serif;
                font-size: 18px;
                color: #000;
                background-color: #00ff00;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .return-button:hover {
                background-color: #ff00ff;
                transform: scale(1.05);
            }

            .game-controls {
                position: absolute;
                bottom: 15%;
                left: 50%;
                transform: translateX(-50%);
                z-index: 20;
            }

            .game-button {
                font-family: 'Press Start 2P', sans-serif;
                font-size: 16px;
                padding: 10px 20px;
                color: #00ff00;
                background: transparent;
                border: 2px solid #00ff00;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .game-button:hover {
                background: rgba(0, 255, 0, 0.2);
                transform: scale(1.05);
            }
        `;
        document.head.appendChild(style);
    }

    calculateSize() {
        // Get container dimensions
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;
        
        // Calculate size while maintaining aspect ratio
        if (containerWidth / containerHeight > this.aspectRatio) {
            // Container is too wide - use height as constraint
            this.height = Math.min(containerHeight, 600); // Max height of 600px
            this.width = this.height * this.aspectRatio;
        } else {
            // Container is too tall - use width as constraint
            this.width = Math.min(containerWidth, 800); // Max width of 800px
            this.height = this.width / this.aspectRatio;
        }
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(75, this.aspectRatio, 0.1, 1000);
        this.camera.position.set(0, 6, 6);
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.calculateSize(); // Make sure size is calculated
        this.renderer.setSize(this.width, this.height);
        this.renderer.domElement.style.cssText = `
            display: block;
            margin: auto;
            max-width: 100%;
            height: auto;
        `;
        this.container.appendChild(this.renderer.domElement);
    }

    handleResize() {
        this.calculateSize();
        this.camera.aspect = this.aspectRatio;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x333333);
        this.scene.add(ambientLight);

        const spotLight = new THREE.SpotLight(0xffffff, 0.5);
        spotLight.position.set(0, 10, 0);
        this.scene.add(spotLight);
    }

    createGameObjects() {
        // Create table
        const tableGeometry = new THREE.BoxGeometry(10, 0.2, 6);
        const tableMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x000000,
            specular: 0x111111,
            shininess: 100
        });
        this.table = new THREE.Mesh(tableGeometry, tableMaterial);
        this.scene.add(this.table);

        // Create border
        const borderGeometry = new THREE.EdgesGeometry(tableGeometry);
        const borderMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        this.table.add(border);

        // Create ball
        this.createBall();

        // Create paddles
        this.createPaddles();

        // Create net
        this.createNet();
    }

    createBall() {
        const ballGeometry = new THREE.SphereGeometry(0.2, 32, 32);
        const ballTexture = this.createBallTexture();
        const ballMaterial = new THREE.MeshPhongMaterial({ 
            map: ballTexture,
            color: 0xffffff,
            emissive: 0xff00aa,
            emissiveIntensity: 0.3,
            shininess: 30
        });

        this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
        this.ball.position.set(0, 0.5, 0);
        this.scene.add(this.ball);
    }

    createBallTexture() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.height = 256;

        // Draw base
        ctx.fillStyle = '#ff00aa';
        ctx.fillRect(0, 0, 256, 256);

        // Draw stripes
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.arc(128, 128, 128, i * Math.PI / 4, (i + 0.5) * Math.PI / 4);
            ctx.lineTo(128, 128);
            ctx.fill();
        }

        // Draw dots
        ctx.fillStyle = '#ff1493';
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const x = 128 + Math.cos(angle) * 64;
            const y = 128 + Math.sin(angle) * 64;
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fill();
        }

        return new THREE.CanvasTexture(canvas);
    }

    createPaddles() {
        const paddleGeometry = new THREE.BoxGeometry(0.2, 0.8, 1.4);
        const paddleMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x00ccff,
            emissive: 0x00ccff,
            emissiveIntensity: 0.5
        });
        
        this.paddle1 = new THREE.Mesh(paddleGeometry, paddleMaterial);
        this.paddle1.position.set(-4.9, 0.5, 0);
        this.scene.add(this.paddle1);

        this.paddle2 = new THREE.Mesh(paddleGeometry, paddleMaterial);
        this.paddle2.position.set(4.9, 0.5, 0);
        this.scene.add(this.paddle2);
    }

    createNet() {
        const netGeometry = new THREE.BoxGeometry(0.05, 0.4, 6);
        const netMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x444444,
            emissive: 0x444444,
            emissiveIntensity: 0.2
        });
        this.net = new THREE.Mesh(netGeometry, netMaterial);
        this.net.position.set(0, 0.3, 0);
        this.scene.add(this.net);
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    getBallPosition() {
        return {
            x: this.ball.position.x,
            y: this.ball.position.y,
            z: this.ball.position.z
        };
    }

    getPaddlePositions() {
        return {
            paddle1: {
                x: this.paddle1.position.x,
                y: this.paddle1.position.y,
                z: this.paddle1.position.z
            },
            paddle2: {
                x: this.paddle2.position.x,
                y: this.paddle2.position.y,
                z: this.paddle2.position.z
            }
        };
    }
}

// Input handler class
class InputHandler {
    constructor(paddle1, paddle2) {
        this.paddle1 = paddle1;
        this.paddle2 = paddle2;
        this.keys = new Set();
        
        // Bind the handlers to maintain context
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        
        // Add event listeners
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
    }

    handleKeyDown(e) {
        this.keys.add(e.key.toLowerCase());  // Convert to lowercase for consistency
        
        // Prevent default for game controls
        if (['w', 's', 'arrowup', 'arrowdown', ' '].includes(e.key.toLowerCase())) {
            e.preventDefault();
        }
    }

    handleKeyUp(e) {
        this.keys.delete(e.key.toLowerCase());
    }

    update() {
        const paddleSpeed = GAME_CONFIG.paddleSpeed || 0.15;
        
        // Paddle 1 controls (W/S) with tighter bounds
        if (this.keys.has('w') && this.paddle1.position.z > -2.1) {
            this.paddle1.position.z -= paddleSpeed;
        }
        if (this.keys.has('s') && this.paddle1.position.z < 2.1) {
            this.paddle1.position.z += paddleSpeed;
        }

        // Paddle 2 controls (Arrow keys) with tighter bounds
        if (this.keys.has('arrowup') && this.paddle2.position.z > -2.1) {
            this.paddle2.position.z -= paddleSpeed;
        }
        if (this.keys.has('arrowdown') && this.paddle2.position.z < 2.1) {
            this.paddle2.position.z += paddleSpeed;
        }
    }

    cleanup() {
        // Remove event listeners when game is destroyed
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }
}

// AI class
class PongAI {
    constructor(paddle) {
        this.paddle = paddle;
        this.lastUpdateTime = 0;
        this.UPDATE_INTERVAL = 1000;
        this.REACTION_DELAY = 1500;
        this.lastSeenBallPosition = null;
        this.lastSeenBallVelocity = null;
        this.ACCURACY = 0.85;
        this.MAX_SPEED = 0.10;
        this.MISTAKE_CHANCE = 0.10;
        this.difficultyUpdateTime = 0;
        this.difficultyUpdateInterval = 5000;
    }

    update(ball, ballVelocity) {
        const currentTime = Date.now();
        
        if (currentTime - this.difficultyUpdateTime > this.difficultyUpdateInterval) {
            this.updateDifficulty();
            this.difficultyUpdateTime = currentTime;
        }
        
        if (currentTime - this.lastUpdateTime >= this.UPDATE_INTERVAL) {
            this.lastUpdateTime = currentTime;
            this.lastSeenBallPosition = { x: ball.position.x, z: ball.position.z };
            this.lastSeenBallVelocity = { x: ballVelocity.x, z: ballVelocity.z };
            this.decideNextMove(this.lastSeenBallPosition, this.lastSeenBallVelocity);
        }

        this.executeMove();
    }

    decideNextMove(ball, ballVelocity) {
        if (ballVelocity.x > 0) {
            const timeToIntercept = (this.paddle.position.x - ball.x) / ballVelocity.x;
            const perfectZ = ball.z + (ballVelocity.z * timeToIntercept);
            const predictionError = (Math.random() - 0.5) * (1 - this.ACCURACY) * 1.0;
            this.targetZ = perfectZ + predictionError;

            if (Math.random() < this.MISTAKE_CHANCE) {
                this.targetZ += (Math.random() - 0.5) * 2.0;
            }
        } else {
            this.targetZ = (Math.random() - 0.5) * 0.5;
        }

        if (this.paddle.position.z < this.targetZ - 0.1) {
            this.nextMove = 'down';
        } else if (this.paddle.position.z > this.targetZ + 0.1) {
            this.nextMove = 'up';
        } else {
            this.nextMove = null;
        }
    }

    executeMove() {
        const distanceToTarget = Math.abs(this.paddle.position.z - (this.targetZ || 0));
        const speed = Math.min(this.MAX_SPEED, distanceToTarget / 10);

        if (this.nextMove === 'up' && this.paddle.position.z > -2.1) {
            this.paddle.position.z -= speed;
        } else if (this.nextMove === 'down' && this.paddle.position.z < 2.1) {
            this.paddle.position.z += speed;
        }
    }

    updateDifficulty() {
        // This would be updated based on the actual game score
        const scoreDiff = 0;

        if (scoreDiff > 3) {
            // Make AI worse if winning by too much
            this.ACCURACY = 0.15;
            this.MISTAKE_CHANCE = 0.15;
            this.REACTION_DELAY = 2000;
            this.MAX_SPEED = 0.10;
        } else if (scoreDiff < -3) {
            // Make AI better if losing by too much
            this.ACCURACY = 0.15;
            this.MISTAKE_CHANCE = 0.05;
            this.REACTION_DELAY = 1000;
            this.MAX_SPEED = 0.14;
        } else {
            // Default values for close games
            this.ACCURACY = 0.15;
            this.MISTAKE_CHANCE = 0.10;
            this.REACTION_DELAY = 1500;
            this.MAX_SPEED = 0.12;
        }
    }
}

// Main Game Class
class PongGame {
    constructor(canvasContainer, gameMode = 'pvp') {
        this.gameMode = gameMode;
        this.state = {
            score: { player1: 0, player2: 0 },
            gameStatus: 'playing',
            winner: null,
            matchId: window.currentMatchId,
            tournamentId: window.tournamentId
        };

        // Initialize game components
        this.renderer = new GameRenderer(canvasContainer);
        this.physics = new GamePhysics(GAME_CONFIG);
        this.inputHandler = new InputHandler(this.renderer.paddle1, this.renderer.paddle2);
        this.ai = gameMode === 'ai' ? new PongAI(this.renderer.paddle2) : null;
        
        // Set initial ball velocity
        this.renderer.ball.position.copy(this.physics.resetBall());

        // Update player names
        if (window.currentMatchPlayers) {
            const player1Name = document.getElementById('player1-name');
            const player2Name = document.getElementById('player2-name');
            if (player1Name && player2Name) {
                player1Name.textContent = window.currentMatchPlayers.player1;
                player2Name.textContent = window.currentMatchPlayers.player2;
            }
        }

        // Create pause overlay
        this.createPauseOverlay();
        
        // Setup event handlers
        this.setupEventHandlers();

        // Start game loop
        this.lastTime = 0;
        this.animate(0);
    }

    createPauseOverlay() {
        if (!document.getElementById('pauseOverlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'pauseOverlay';
            overlay.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: var(--background-color);
                color: var(--secondary-color);
                padding: 1rem 2rem;
                border: 2px solid var(--primary-color);
                border-radius: 4px;
                font-family: 'Press Start 2P', cursive;
                font-size: 1.5rem;
                font-weight: bold;
                // text-shadow: 0.125em 0.125em var(--secondary-color);
                text-transform: uppercase;
                letter-spacing: 2px;
                display: none;
                z-index: 1000;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            `;
            overlay.textContent = 'Paused';
            this.renderer.container.appendChild(overlay);
        }
    }

    async initializeMatch() {
        try {
            // Create new match in database
            const response = await fetch('/api/game/match/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    game_type: 'PONG',
                    mode: this.gameMode
                })
            });

            const data = await response.json();
            this.state.matchId = data.match_id;
            this.state.matchStartTime = new Date();
            this.state.gameStatus = 'playing';

            return data.match_id;
        } catch (error) {
            console.error('Failed to initialize match:', error);
            return null;
        }
    }

    async updateMatchState() {
        if (!this.state.matchId) return;

        try {
            await fetch(`/api/game/match/${this.state.matchId}/state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    state: {
                        score: this.state.score,
                        ball_position: this.renderer.getBallPosition(),
                        paddle_positions: this.renderer.getPaddlePositions(),
                        game_status: this.state.gameStatus
                    }
                })
            });
        } catch (error) {
            console.error('Failed to update match state:', error);
        }
    }

    async finishMatch() {
        if (!this.state.matchId) {
            // Regular game (not in tournament) - Store match history
            try {
                const currentUser = document.getElementById('player1-name').textContent;
                const opponent = document.getElementById('player2-name').textContent || 'AI';
                const userScore = this.state.score.player1;
                const opponentScore = this.state.score.player2;
                const scoreString = `${userScore}-${opponentScore}`;
                
                // Determine result
                let result = 'DRAW';
                if (userScore > opponentScore) {
                    result = 'WIN';
                } else if (opponentScore > userScore) {
                    result = 'LOSS';
                }
                
                // Send result to backend
                await fetch('/userapp/save-match/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${localStorage.getItem('auth_token')}` || '',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({
                        game_type: 'PONG',
                        opponent: opponent,
                        result: result,
                        score: scoreString
                    })
                });
            } catch (error) {
                console.error('Failed to save match history:', error);
            }
            
            // Show restart button for normal game
            const gameControls = document.getElementById('game-controls');
            const restartButton = document.getElementById('restart-button');
            if (gameControls && restartButton) {
                restartButton.textContent = 'Restart Game';
                restartButton.onclick = () => this.restartGame();
                gameControls.style.display = 'block';
            }
            return;
        }

        try {
            const response = await fetch(`/tournaments/match/${this.state.matchId}/finish/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    score_player1: this.state.score.player1,
                    score_player2: this.state.score.player2,
                    winner: this.state.winner
                })
            });

            if (response.ok) {
                // Show next game button for tournament
                const gameControls = document.getElementById('game-controls');
                const restartButton = document.getElementById('restart-button');
                if (gameControls && restartButton) {
                    restartButton.textContent = 'Next Game';
                    restartButton.onclick = () => {
                        window.location.href = `/tournaments/${this.state.tournamentId}/`;
                    };
                    gameControls.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Failed to finish match:', error);
        }
    }

    restartGame() {
        // Reset game state
        this.state.score = { player1: 0, player2: 0 };
        this.state.gameStatus = 'playing';
        this.state.winner = null;
        
        // Reset ball position and velocity
        this.renderer.ball.position.copy(this.physics.resetBall());
        
        // Hide game controls
        const gameControls = document.getElementById('game-controls');
        if (gameControls) {
            gameControls.style.display = 'none';
        }
        
        // Update score display
        document.getElementById('score').textContent = '00 - 00';
    }

    updateScore(scorer) {
        this.state.score[scorer]++;
        
        // Update score display
        document.getElementById('score').textContent = 
            `${this.state.score.player1.toString().padStart(2, '0')} - ${this.state.score.player2.toString().padStart(2, '0')}`;

        // Check for game end
        if (this.state.score[scorer] >= GAME_CONFIG.pointsToWin) {
            this.state.gameStatus = 'finished';
            this.state.winner = scorer;
            this.finishMatch();
        }

        // Save state to backend
        this.updateMatchState();
    }

    setupEventHandlers() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.state.gameStatus !== 'finished') {
                e.preventDefault();
                this.togglePause();
            }
        });
    }

    togglePause() {
        const overlay = document.getElementById('pauseOverlay');
        if (!overlay) return;

        if (this.state.gameStatus === 'playing') {
            this.state.gameStatus = 'paused';
            overlay.style.display = 'block';
        } else if (this.state.gameStatus === 'paused') {
            this.state.gameStatus = 'playing';
            overlay.style.display = 'none';
        }
    }

    update(deltaTime) {
        if (this.state.gameStatus !== 'playing') return;

        // Update AI if in AI mode
        if (this.gameMode === 'ai' && this.ai) {
            this.ai.update(this.renderer.ball, this.physics.ballVelocity);
        }

        // Update input and physics
        this.inputHandler.update();
        const scorer = this.physics.updatePhysics(
            this.renderer.ball,
            this.renderer.paddle1,
            this.renderer.paddle2
        );

        // Handle scoring
        if (scorer) {
            this.updateScore(scorer);
            this.renderer.ball.position.copy(this.physics.resetBall());
        }

        // Periodically update match state
        if (Date.now() - this.lastStateUpdate > 1000) { // Update every second
            this.updateMatchState();
            this.lastStateUpdate = Date.now();
        }
    }

    cleanup() {
        // Cleanup when game is destroyed
        if (this.inputHandler) {
            this.inputHandler.cleanup();
        }
        // Stop animation frame if needed
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    animate(currentTime) {
        this.animationFrameId = requestAnimationFrame((time) => this.animate(time));

        if (this.state.gameStatus === 'playing') {
            const deltaTime = (currentTime - this.lastTime) / 1000;
            this.update(deltaTime);
        }

        this.renderer.render();
        this.lastTime = currentTime;
    }

    static initializeGame(container, mode) {
        console.log('Initializing game...', { container, mode });
        
        // Clear container first
        container.innerHTML = '';
        
        // Set container dimensions explicitly
        container.style.cssText = `
            position: relative;
            width: 100%;
            height: 600px;
            background-color: #0a0a0a;
            overflow: hidden;
        `;

        if (!mode && !window.currentMatchId) {
            // Create mode selection
            const modeSelection = document.createElement('div');
            modeSelection.id = 'modeSelection';
            modeSelection.className = 'game-mode-selection'; // Add the class instead of inline styles

            const pvpButton = document.createElement('button');
            pvpButton.className = 'mode-button';
            pvpButton.textContent = 'Player vs Player';
            pvpButton.onclick = () => {
                modeSelection.remove();
                this.startGame(container, 'pvp');
            };

            const aiButton = document.createElement('button');
            aiButton.className = 'mode-button';
            aiButton.textContent = 'Player vs AI';
            aiButton.onclick = () => {
                modeSelection.remove();
                this.startGame(container, 'ai');
            };

            modeSelection.appendChild(pvpButton);
            modeSelection.appendChild(aiButton);
            container.appendChild(modeSelection);
        } else {
            this.startGame(container, mode || 'pvp');
        }
    }

    static startGame(container, mode) {
        try {
            window.currentGame = new PongGame(container, mode);
            console.log('Game initialized successfully with mode:', mode);
        } catch (error) {
            console.error('Error initializing game:', error);
        }
    }
}

// Export the game class
export default PongGame;