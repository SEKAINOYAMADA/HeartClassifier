console.log("game.js loaded and running");
"use strict";

document.addEventListener('DOMContentLoaded', () => {
    // Get references to new HTML elements
    const canvas = document.getElementById('gameCanvas');
    console.log("canvas:", canvas);
    const ctx = canvas.getContext('2d');

    const startScreen = document.getElementById('startScreen');
    console.log("startScreen:", startScreen);
    const startButton = document.getElementById('startButton');
    console.log("startButton:", startButton);
    const gameOverScreen = document.getElementById('gameOver');
    console.log("gameOverScreen:", gameOverScreen);
    const finalScoreDisplay = document.getElementById('finalScore');
    console.log("finalScoreDisplay:", finalScoreDisplay);
    const restartButton = document.getElementById('restartButton');
    console.log("restartButton:", restartButton);
    const highScoreList = document.getElementById('highScoreList'); // New element

    // --- Game Configuration ---
    const STAGE_WIDTH = 800;
    const STAGE_HEIGHT = 600;
    canvas.width = STAGE_WIDTH;
    canvas.height = STAGE_HEIGHT;

    const FONT_FAMILY = "'Press Start 2P', cursive"; // Changed to match index.html
    const HEART_LIFESPAN = 10; // seconds

    const COLORS = {
        RED: '#FF5555',
        BLUE: '#5555FF',
        WHITE: '#FFFFFF',
        BLACK: '#000000',
        RED_AREA: 'rgba(255, 85, 85, 0.2)',
        BLUE_AREA: 'rgba(85, 85, 255, 0.2)',
    };

    // --- Helper Functions ---
    function getRandom(min, max) {
        return Math.random() * (max - min) + min;
    }

    function getRandomColor() {
        return Math.random() < 0.5 ? COLORS.RED : COLORS.BLUE;
    }


    // --- Classes ---

    class Heart {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.size = 20;
            this.vx = getRandom(-1, 1);
            this.vy = getRandom(-1, 1);
            this.isHeld = false;
            this.safe = false;
            this.createdAt = Date.now();
            this.lifespan = HEART_LIFESPAN * 1000;
        }

        getRemainingTime() {
            const elapsed = Date.now() - this.createdAt;
            return (this.lifespan - elapsed) / 1000;
        }

        update(game) { // Pass game object for area context
            if (this.isHeld) return;

            this.x += this.vx;
            this.y += this.vy;

            // Inertia/friction
            this.vx *= 0.99;
            this.vy *= 0.99;

            if (this.safe) {
                const area = this.color === COLORS.RED ? game.redArea : game.blueArea;
                // Keep heart within its safe area boundaries
                if (this.x - this.size / 2 < area.x || this.x + this.size / 2 > area.x + area.width) {
                    this.vx *= -1;
                    this.x = Math.max(area.x + this.size / 2, Math.min(this.x, area.x + area.width - this.size / 2));
                }
                if (this.y - this.size / 2 < area.y || this.y + this.size / 2 > area.y + area.height) {
                    this.vy *= -1;
                    this.y = Math.max(area.y + this.size / 2, Math.min(this.y, area.y + area.height - this.size / 2));
                }
            } else {
                // Original wall bouncing for non-safe hearts
                if (this.x - this.size / 2 < 0 || this.x + this.size / 2 > STAGE_WIDTH) {
                    this.vx *= -1;
                    this.x = Math.max(this.size / 2, Math.min(this.x, STAGE_WIDTH - this.size / 2));
                }
                if (this.y - this.size / 2 < 0 || this.y + this.size / 2 > STAGE_HEIGHT) {
                    this.vy *= -1;
                    this.y = Math.max(this.y / 2, Math.min(this.y, STAGE_HEIGHT - this.size / 2));
                }
            }
        }

        draw(ctx) {
            const remainingTime = this.getRemainingTime();
            let displayColor = this.color;

            // Blinking effect when time is low and not safe
            if (!this.safe && remainingTime <= 5) {
                const blinkSpeed = 1 + (5 - remainingTime); // Faster as time runs out
                if (Math.floor(Date.now() / (1000 / blinkSpeed)) % 2 === 0) {
                    displayColor = COLORS.WHITE;
                }
            }

            ctx.font = `${this.size * 2}px ${FONT_FAMILY}`;
            ctx.fillStyle = displayColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('♡', this.x, this.y);
        }
    }

    class Game {
        constructor(ctx, canvasElement, startScreen, startButton, gameOverScreen, finalScoreDisplay, restartButton, highScoreList) {
            this.ctx = ctx;
            this.gameState = 'start'; // 'start', 'countdown', 'playing', 'gameover'
            this.hearts = [];
            this.heldHeart = null;
            this.score = 0;
            this.highScore = parseInt(localStorage.getItem('heartSurvivorHighScore') || '0');
            this.spawnCounter = 0;
            this.lastSpawnTime = 0;
            this.countdownValue = 3;
            this.gameOverStopTime = 0;
            this.lastCountdownTime = 0;
            this.explodingHeart = null;

            // Adjusted area positions for better layout (centered)
            const areaWidth = 100;
            const areaHeight = 200;
            const spawnWidth = 150;
            const spawnHeight = 50;
            
            // Safe areas (left and right edges)
            this.redArea = { 
                x: 0, 
                y: STAGE_HEIGHT / 2 - areaHeight / 2, 
                width: areaWidth, 
                height: areaHeight 
            };
            this.blueArea = { 
                x: STAGE_WIDTH - areaWidth, 
                y: STAGE_HEIGHT / 2 - areaHeight / 2, 
                width: areaWidth, 
                height: areaHeight 
            };
            // Spawn areas (top and bottom edges)
            this.upperSpawn = { 
                x: STAGE_WIDTH / 2 - spawnWidth / 2, 
                y: 0, 
                width: spawnWidth, 
                height: spawnHeight 
            };
            this.lowerSpawn = { 
                x: STAGE_WIDTH / 2 - spawnWidth / 2, 
                y: STAGE_HEIGHT - spawnHeight, 
                width: spawnWidth, 
                height: spawnHeight 
            };

            this.isShiftDown = false;
            this.mousePos = { x: 0, y: 0 };

            // References to HTML elements
            this.startScreen = startScreen;
            this.startButton = startButton;
            this.gameOverScreen = gameOverScreen;
            this.finalScoreDisplay = finalScoreDisplay;
            this.restartButton = restartButton;
            this.canvasElement = canvasElement; // Reference to the canvas DOM element
            this.highScoreList = highScoreList; // New element

            this.initEventListeners();
            this.showStartScreen(); // Show start screen initially
        }

        initEventListeners() {
            this.startButton.addEventListener('click', this.startGame.bind(this));
            this.restartButton.addEventListener('click', this.resetGame.bind(this));


            window.addEventListener('keydown', (e) => {
                if (e.key === 'Shift' && !this.isShiftDown) {
                    this.isShiftDown = true;
                    this.grabHeart();
                }
            });

            window.addEventListener('keyup', (e) => {
                if (e.key === 'Shift') {
                    this.isShiftDown = false;
                    this.releaseHeart();
                }
            });

            this.canvasElement.addEventListener('mousemove', (e) => {
                const rect = this.canvasElement.getBoundingClientRect();
                this.mousePos.x = e.clientX - rect.left;
                this.mousePos.y = e.clientY - rect.top;
            });
        }

        startGame() {
            this.hideStartScreen();
            this.startCountdown();
        }

        showStartScreen() {
            this.startScreen.style.display = 'flex'; // Assuming it's flex for centering
            this.canvasElement.style.display = 'none';
            this.gameOverScreen.style.display = 'none';
        }

        hideStartScreen() {
            this.startScreen.style.display = 'none';
            this.canvasElement.style.display = 'block'; // Canvas should be block for display
        }

        async showGameOverScreen() {
            this.gameOverScreen.style.display = 'flex'; // Assuming it's flex for centering
            this.canvasElement.style.display = 'none';
            
            // Display current score and personal high score
            this.finalScoreDisplay.innerHTML = `YOUR SCORE: ${this.score}<br>YOUR HIGH SCORE: ${this.highScore}`;

            // Prompt for player name if score is in top 5
            const topScores = await this.fetchTopScores();
            const isTop5 = topScores.some(s => this.score > s.score) || topScores.length < 5;

            if (isTop5) {
                let playerName = prompt("Congratulations! You made it to the Top 5!\nPlease enter your name:");
                if (playerName) {
                    await this.saveScore(playerName, this.score);
                }
            }

            // Fetch and display updated top scores
            await this.displayTopScores();
        }

        hideGameOverScreen() {
            this.gameOverScreen.style.display = 'none';
            this.canvasElement.style.display = 'block';
        }

        async saveScore(playerName, score) {
            try {
                const response = await fetch('http://localhost:3000/api/scores', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ playerName, score }),
                });
                const data = await response.json();
                console.log('Score saved:', data);
            } catch (error) {
                console.error('Error saving score:', error);
            }
        }

        async fetchTopScores() {
            try {
                const response = await fetch('http://localhost:3000/api/scores/top5');
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error fetching top scores:', error);
                return [];
            }
        }

        async displayTopScores() {
            const topScores = await this.fetchTopScores();
            this.highScoreList.innerHTML = ''; // Clear previous list
            topScores.forEach((s, index) => {
                const listItem = document.createElement('li');
                listItem.textContent = `${index + 1}. ${s.playerName}: ${s.score}`;
                this.highScoreList.appendChild(listItem);
            });
        }

        startCountdown() {
            this.gameState = 'countdown';
            this.countdownValue = 3;
            this.lastCountdownTime = Date.now();
        }

        grabHeart() {
            if (this.gameState !== 'playing' || this.heldHeart) return;
            // Find the closest heart to the mouse
            let closestHeart = null;
            let minDistance = Infinity;

            for (let i = this.hearts.length - 1; i >= 0; i--) {
                const heart = this.hearts[i];
                const dx = heart.x - this.mousePos.x;
                const dy = heart.y - this.mousePos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                // Only allow grabbing if not already safe
                if (!heart.safe && distance < heart.size * 2 && distance < minDistance) {
                    closestHeart = heart;
                    minDistance = distance;
                }
            }

            if (closestHeart) {
                this.heldHeart = closestHeart;
                this.heldHeart.isHeld = true;
            }
        }

        releaseHeart() {
            if (this.heldHeart) {
                const releasedHeart = this.heldHeart;
                releasedHeart.isHeld = false;
                // Apply some inertia from mouse movement
                releasedHeart.vx += (this.mousePos.x - releasedHeart.x) * 0.1;
                releasedHeart.vy += (this.mousePos.y - releasedHeart.y) * 0.1;
                this.heldHeart = null;

                // Check for incorrect placement immediately on release
                const inRedArea = releasedHeart.x > this.redArea.x && releasedHeart.x < this.redArea.x + this.redArea.width &&
                                  releasedHeart.y > this.redArea.y && releasedHeart.y < this.redArea.y + this.redArea.height;
                const inBlueArea = releasedHeart.x > this.blueArea.x && releasedHeart.x < this.blueArea.x + this.blueArea.width &&
                                   releasedHeart.y > this.blueArea.y && releasedHeart.y < this.blueArea.y + this.blueArea.height;

                if ((releasedHeart.color === COLORS.RED && inBlueArea) || (releasedHeart.color === COLORS.BLUE && inRedArea)) {
                    this.triggerGameOver(releasedHeart);
                } else if ((releasedHeart.color === COLORS.RED && inRedArea) || (releasedHeart.color === COLORS.BLUE && inBlueArea)) {
                    const elapsedTime = Date.now() - releasedHeart.createdAt;
                    if (elapsedTime < 5000) { // 5 seconds for bonus
                        this.score += 200; // Double points
                    } else {
                        this.score += 100; // Standard points
                    }
                }
            }
        }

        spawnHearts() {
            const now = Date.now();
            if (now - this.lastSpawnTime < 5000) return;

            this.lastSpawnTime = now;
            this.spawnCounter++;

            let upperSpawnCount = 0;
            let lowerSpawnCount = 0;

            if (this.spawnCounter <= 3) {
                upperSpawnCount = 1;
            } else if (this.spawnCounter <= 5) {
                upperSpawnCount = 2;
            } else if (this.spawnCounter <= 10) {
                upperSpawnCount = 2;
                lowerSpawnCount = 1;
            } else {
                const baseUpper = 3;
                const baseLower = 1;
                const increment = Math.floor((this.spawnCounter - 11) / 5);
                upperSpawnCount = baseUpper + increment;
                lowerSpawnCount = baseLower + increment;
            }

            for (let i = 0; i < upperSpawnCount; i++) {
                this.hearts.push(new Heart(
                    getRandom(this.upperSpawn.x, this.upperSpawn.x + this.upperSpawn.width),
                    getRandom(this.upperSpawn.y, this.upperSpawn.y + this.upperSpawn.height),
                    getRandomColor()
                ));
            }
            for (let i = 0; i < lowerSpawnCount; i++) {
                this.hearts.push(new Heart(
                    getRandom(this.lowerSpawn.x, this.lowerSpawn.x + this.lowerSpawn.width),
                    getRandom(this.lowerSpawn.y, this.lowerSpawn.y + this.lowerSpawn.height),
                    getRandomColor()
                ));
            }
        }

        update() {
            const now = Date.now();

            if (this.gameState === 'playing') {
                this.hearts.forEach(heart => heart.update(this)); // Pass game object for area context

                if (this.heldHeart) {
                    this.heldHeart.x = this.mousePos.x;
                    this.heldHeart.y = this.mousePos.y;
                }

                this.spawnHearts();
                this.updateHeartSafety();
                this.checkGameOver();
            } else if (this.gameState === 'countdown') {
                if (now - this.lastCountdownTime > 1000) {
                    this.countdownValue--;
                    this.lastCountdownTime = now;
                    if (this.countdownValue <= 0) {
                        this.gameState = 'playing';
                        this.lastSpawnTime = now;
                    }
                }
            }
        }

        triggerGameOver(explodingHeart) {
            this.gameState = 'gameover';
            this.explodingHeart = explodingHeart;
            this.gameOverStopTime = Date.now();
            // Freeze all other hearts
            this.hearts.forEach(h => {
                h.vx = 0;
                h.vy = 0;
            });

            // Update high score
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('heartSurvivorHighScore', this.highScore);
            }
            this.showGameOverScreen(); // Show game over screen
        }

        checkGameOver() {
            for (const heart of this.hearts) {
                if (!heart.safe && heart.getRemainingTime() <= 0) { // Check if heart is not safe
                    this.triggerGameOver(heart);
                    return;
                }
            }
        }

        checkAreaClear() {
            // This method is now empty to prevent freezing.
        }

        updateHeartSafety() {
            this.hearts.forEach(heart => {
                if (heart.isHeld) {
                    heart.safe = false;
                    return;
                }

                const inRedArea = heart.x > this.redArea.x && heart.x < this.redArea.x + this.redArea.width &&
                                  heart.y > this.redArea.y && heart.y < this.redArea.y + this.redArea.height;
                const inBlueArea = heart.x > this.blueArea.x && heart.x < this.blueArea.x + this.blueArea.width &&
                                   heart.y > this.blueArea.y && heart.y < this.blueArea.y + this.blueArea.height;

                if ((heart.color === COLORS.RED && inRedArea) || (heart.color === COLORS.BLUE && inBlueArea)) {
                    heart.safe = true;
                } else {
                    heart.safe = false;
                }
            });
        }


        draw() {
            // Clear canvas
            this.ctx.fillStyle = COLORS.BLACK;
            this.ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

            // Only draw game elements if playing or in countdown
            if (this.gameState === 'playing' || this.gameState === 'countdown') {
                // Draw areas and spawners
                this.drawZones();

                // Draw hearts
                this.hearts.forEach(heart => heart.draw(this.ctx));

                // Draw countdown
                if (this.gameState === 'countdown') {
                    this.ctx.fillStyle = COLORS.WHITE;
                    this.ctx.font = `100px ${FONT_FAMILY}`;
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    const text = this.countdownValue > 0 ? this.countdownValue : 'スタート！';
                    this.ctx.fillText(text, STAGE_WIDTH / 2, STAGE_HEIGHT / 2);
                }
            }
        }

        drawZones() {
            // Red Area
            this.ctx.fillStyle = COLORS.RED_AREA;
            this.ctx.fillRect(this.redArea.x, this.redArea.y, this.redArea.width, this.redArea.height);
            // Blue Area
            this.ctx.fillStyle = COLORS.BLUE_AREA;
            this.ctx.fillRect(this.blueArea.x, this.blueArea.y, this.blueArea.width, this.blueArea.height);

            // Spawner outlines
            this.ctx.strokeStyle = COLORS.WHITE;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(this.upperSpawn.x, this.upperSpawn.y, this.upperSpawn.width, this.upperSpawn.height);
            this.ctx.strokeRect(this.lowerSpawn.x, this.lowerSpawn.y, this.lowerSpawn.width, this.lowerSpawn.height);
        }

        drawStartScreen() {
            // This method is now handled by HTML/CSS for startScreen element
            // No drawing on canvas needed here.
        }

        resetGame() {
            this.gameState = 'start';
            this.hearts = [];
            this.heldHeart = null;
            this.score = 0;
            this.spawnCounter = 0;
            this.lastSpawnTime = 0;
            this.countdownValue = 3;
            this.gameOverStopTime = 0;
            this.lastCountdownTime = 0;
            this.explodingHeart = null;
            this.showStartScreen(); // Show start screen after reset
        }

        loop() {
            this.update();
            this.draw();
            requestAnimationFrame(() => this.loop());
        }
    }

    // --- Main Execution ---
    const game = new Game(ctx, canvas, startScreen, startButton, gameOverScreen, finalScoreDisplay, restartButton, highScoreList);
    game.loop();
});