document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const svgOverlay = document.getElementById('lines-overlay');
    const tokens = [document.getElementById('player0'), document.getElementById('player1')];
    const diceElement = document.getElementById('dice');
    const rollBtn = document.getElementById('roll-btn');
    const restartBtn = document.getElementById('restart-btn');
    const statusMessage = document.getElementById('status-message');

    // State Variables for 2 Players
    let positions = [0, 0]; 
    let currentPlayer = 0; // 0 for Player 1, 1 for Player 2
    let isMoving = false;
    let audioCtx = null;

    const snakes = [
        { start: 16, end: 6 },
        { start: 48, end: 26 },
        { start: 64, end: 60 },
        { start: 93, end: 73 },
        { start: 95, end: 75 },
        { start: 98, end: 78 }
    ];

    const ladders = [
        { start: 1, end: 38 },
        { start: 4, end: 14 },
        { start: 9, end: 31 },
        { start: 21, end: 42 },
        { start: 28, end: 84 },
        { start: 36, end: 44 }
    ];

    function initBoard() {
        board.innerHTML = '';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                let cellNum;
                if (r % 2 === 0) {
                    cellNum = 100 - (r * 10) - c;
                } else {
                    cellNum = 100 - (r * 10) - 9 + c;
                }
                
                const cell = document.createElement('div');
                cell.classList.add('cell');
                if ((r + c) % 2 !== 0) cell.classList.add('alt');
                cell.dataset.num = cellNum;
                cell.textContent = cellNum;
                board.appendChild(cell);
            }
        }
        setTimeout(drawConnections, 100); 
    }

    function drawConnections() {
        svgOverlay.innerHTML = '';
        const boardRect = board.getBoundingClientRect();

        const drawLine = (start, end, color, isSnake) => {
            const startCell = document.querySelector(`[data-num="${start}"]`);
            const endCell = document.querySelector(`[data-num="${end}"]`);
            if (!startCell || !endCell) return;

            const startRect = startCell.getBoundingClientRect();
            const endRect = endCell.getBoundingClientRect();

            const x1 = startRect.left - boardRect.left + startRect.width / 2;
            const y1 = startRect.top - boardRect.top + startRect.height / 2;
            const x2 = endRect.left - boardRect.left + endRect.width / 2;
            const y2 = endRect.top - boardRect.top + endRect.height / 2;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', '4');
            line.setAttribute('stroke-linecap', 'round');
            
            if (isSnake) {
                line.setAttribute('stroke-dasharray', '8, 8');
            }
            svgOverlay.appendChild(line);
        };

        snakes.forEach(s => drawLine(s.start, s.end, '#ef4444', true));
        ladders.forEach(l => drawLine(l.start, l.end, '#10b981', false));
        
        // Re-draw player positions if board resizes
        if (positions[0] > 0) updatePlayerVisual(0, positions[0]);
        if (positions[1] > 0) updatePlayerVisual(1, positions[1]);
    }

    // Linear Search for Snakes
    function linearSearchSnake(pos) {
        for (let i = 0; i < snakes.length; i++) {
            if (snakes[i].start === pos) return snakes[i].end;
        }
        return -1;
    }

    // Binary Search for Ladders
    function binarySearchLadder(pos) {
        let left = 0;
        let right = ladders.length - 1;
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (ladders[mid].start === pos) return ladders[mid].end;
            if (ladders[mid].start < pos) left = mid + 1;
            else right = mid - 1;
        }
        return -1;
    }

    function playSound(type) {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        
        if (type === 'move') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'ladder') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.5);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'snake') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.5);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'win') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554, now + 0.2);
            osc.frequency.setValueAtTime(659, now + 0.4);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 1);
            osc.start(now);
            osc.stop(now + 1);
        }
    }

    function updatePlayerVisual(playerIndex, pos) {
        const token = tokens[playerIndex];
        if (pos === 0) {
            token.style.transform = `translate(-100px, -100px)`;
            return;
        }
        const cell = document.querySelector(`[data-num="${pos}"]`);
        const boardRect = board.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();

        let x = cellRect.left - boardRect.left + (cellRect.width / 2);
        let y = cellRect.top - boardRect.top + (cellRect.height / 2);

        // Apply a slight visual offset so tokens don't overlap entirely if on the same cell
        const offset = playerIndex === 0 ? -4 : 4; 

        const tokenRect = token.getBoundingClientRect();
        token.style.transform = `translate(${(x + offset) - (tokenRect.width / 2)}px, ${(y + offset) - (tokenRect.height / 2)}px)`;
    }

    function updateStatusUI() {
        const pName = currentPlayer === 0 ? "Player 1 (Blue)" : "Player 2 (Red)";
        const color = currentPlayer === 0 ? "var(--accent-blue)" : "var(--accent-red)";
        statusMessage.style.color = color;
        statusMessage.textContent = `${pName}'s Turn - Roll!`;
        rollBtn.style.backgroundColor = color;
    }

    async function handleTurn() {
        if (isMoving || positions[0] === 100 || positions[1] === 100) return;
        isMoving = true;
        rollBtn.disabled = true;

        statusMessage.style.color = 'var(--text-primary)';
        statusMessage.textContent = `Player ${currentPlayer + 1} is rolling...`;
        diceElement.classList.add('rolling');
        
        await new Promise(r => setTimeout(r, 600));
        
        const roll = Math.floor(Math.random() * 6) + 1;
        diceElement.classList.remove('rolling');
        diceElement.textContent = roll;

        let currentPos = positions[currentPlayer];

        // Check exact win condition
        if (currentPos + roll > 100) {
            statusMessage.textContent = `Needs exactly ${100 - currentPos} to win! Turn skipped.`;
            await new Promise(r => setTimeout(r, 1500));
            switchTurn();
            return;
        }

        statusMessage.textContent = `Player ${currentPlayer + 1} moved ${roll} spaces.`;

        // Move step by step
        for (let i = 1; i <= roll; i++) {
            currentPos++;
            updatePlayerVisual(currentPlayer, currentPos);
            playSound('move');
            await new Promise(r => setTimeout(r, 300));
        }

        positions[currentPlayer] = currentPos;

        // Check Snakes and Ladders
        const snakeDest = linearSearchSnake(currentPos);
        const ladderDest = binarySearchLadder(currentPos);

        if (snakeDest !== -1) {
            statusMessage.style.color = 'var(--accent-red)';
            statusMessage.textContent = 'Oh no! Bitten by a snake!';
            playSound('snake');
            await new Promise(r => setTimeout(r, 500));
            positions[currentPlayer] = snakeDest;
            updatePlayerVisual(currentPlayer, positions[currentPlayer]);
        } else if (ladderDest !== -1) {
            statusMessage.style.color = 'var(--accent-green)';
            statusMessage.textContent = 'Awesome! Climbed a ladder!';
            playSound('ladder');
            await new Promise(r => setTimeout(r, 500));
            positions[currentPlayer] = ladderDest;
            updatePlayerVisual(currentPlayer, positions[currentPlayer]);
        }

        // Check for Win
        if (positions[currentPlayer] === 100) {
            statusMessage.style.color = currentPlayer === 0 ? 'var(--accent-blue)' : 'var(--accent-red)';
            statusMessage.textContent = `🎉 PLAYER ${currentPlayer + 1} WINS! 🎉`;
            playSound('win');
        } else {
            await new Promise(r => setTimeout(r, 1000));
            switchTurn();
        }
    }

    function switchTurn() {
        currentPlayer = currentPlayer === 0 ? 1 : 0;
        updateStatusUI();
        isMoving = false;
        rollBtn.disabled = false;
    }

    function resetGame() {
        positions = [0, 0];
        currentPlayer = 0;
        diceElement.textContent = '🎲';
        
        updatePlayerVisual(0, 0);
        updatePlayerVisual(1, 0);
        
        updateStatusUI();
        rollBtn.disabled = false;
        isMoving = false;
    }

    initBoard();
    window.addEventListener('resize', drawConnections);
    rollBtn.addEventListener('click', handleTurn);
    restartBtn.addEventListener('click', resetGame);
});
