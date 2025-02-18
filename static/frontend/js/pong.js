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

        // Paddle collisions
        if (ball.position.x < -4.7 && ball.position.z > paddle1.position.z - 0.7 && 
            ball.position.z < paddle1.position.z + 0.7) {
            this.handlePaddleCollision(ball.position, paddle1.position, true);
        }
        if (ball.position.x > 4.7 && ball.position.z > paddle2.position.z - 0.7 && 
            ball.position.z < paddle2.position.z + 0.7) {
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

        // Set aspect ratio (4:3)
        this.aspectRatio = 4/3;
        
        // Calculate size based on container
        this.calculateSize();

        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.createGameObjects();

        // Handle window resizing
        window.addEventListener('resize', () => this.handleResize(), false);
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
        this.camera.position.set(0, 7, 10);
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.domElement.style.margin = 'auto';
        this.renderer.domElement.style.display = 'block';
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
        
        // Paddle 1 controls (W/S)
        if (this.keys.has('w') && this.paddle1.position.z > -2.5) {
            this.paddle1.position.z -= paddleSpeed;
        }
        if (this.keys.has('s') && this.paddle1.position.z < 2.5) {
            this.paddle1.position.z += paddleSpeed;
        }

        // Paddle 2 controls (Arrow keys)
        if (this.keys.has('arrowup') && this.paddle2.position.z > -2.5) {
            this.paddle2.position.z -= paddleSpeed;
        }
        if (this.keys.has('arrowdown') && this.paddle2.position.z < 2.5) {
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

        if (this.nextMove === 'up' && this.paddle.position.z > -2.5) {
            this.paddle.position.z -= speed;
        } else if (this.nextMove === 'down' && this.paddle.position.z < 2.5) {
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

        // Start game loop
        this.lastTime = 0;
        this.animate(0);
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
        if (!this.state.matchId) return;

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
                // Show winner screen
                const winnerScreen = document.getElementById('winner-screen');
                const winnerText = document.getElementById('winner-text');
                const returnButton = document.getElementById('return-to-tournament');
                
                if (winnerScreen && winnerText && returnButton) {
                    const winner = this.state.score.player1 > this.state.score.player2 
                        ? window.currentMatchPlayers.player1 
                        : window.currentMatchPlayers.player2;
                    
                    winnerText.textContent = `${winner} Wins!`;
                    winnerScreen.style.display = 'block';
                    
                    returnButton.onclick = () => {
                        window.location.href = `/tournaments/${this.state.tournamentId}/`;
                    };
                }
            }
        } catch (error) {
            console.error('Failed to finish match:', error);
        }
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
        // Space to pause
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.state.gameStatus !== 'menu') {
                e.preventDefault();
                this.togglePause();
            }
        });
    }

    togglePause() {
        if (this.state.gameStatus === 'playing') {
            this.state.gameStatus = 'paused';
            document.getElementById('pauseText').style.display = 'block';
        } else if (this.state.gameStatus === 'paused') {
            this.state.gameStatus = 'playing';
            document.getElementById('pauseText').style.display = 'none';
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
}

// Export the game class
export default PongGame;