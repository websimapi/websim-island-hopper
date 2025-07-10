const scene = document.getElementById('scene');
const ship = document.getElementById('ship');
const messageLog = document.getElementById('message-log');
const inventoryItems = document.getElementById('inventory-items');

let currentIslandId = 'main';
let inventory = {};
let audioContext;
const soundBuffers = {};

function initAudio() {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    loadSound('click.mp3');
    loadSound('travel.mp3');
    loadSound('collect.mp3');
}

async function loadSound(url) {
    if (!audioContext) return;
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        soundBuffers[url] = audioBuffer;
    } catch (error) {
        console.error(`Error loading sound: ${url}`, error);
    }
}

function playSound(url) {
    if (!audioContext || !soundBuffers[url]) {
        return;
    }
    const source = audioContext.createBufferSource();
    source.buffer = soundBuffers[url];
    source.connect(audioContext.destination);
    source.start(0);
}

const islands = {
    main: {
        name: "Origin Island",
        img: 'main-island.png',
        bg: 'background.png',
        pos: { bottom: '5%', left: 'calc(50% - 150px)' },
        size: { width: '300px', height: '200px' },
        message: "This is the island where your journey begins. A strange energy emanates from the other islands."
    },
    key: {
        name: "Key Island",
        img: 'key-island.png',
        bg: 'key-island-bg.png',
        pos: { top: '20%', left: '10%' },
        size: { width: '250px', height: '250px' },
        message: "A desolate island holding an ancient artifact.",
        item: { id: 'key', img: 'key.png', pos: { bottom: '70px', left: '100px' } }
    },
    shield: {
        name: "Fortress Island",
        img: 'shield-island.png',
        bg: 'shield-island-bg.png',
        pos: { top: '15%', right: '8%' },
        size: { width: '300px', height: '300px' },
        message: "A powerful shield rests on this fortified island.",
        item: { id: 'shield', img: 'shield.png', pos: { bottom: '110px', right: '110px' } }
    },
    robot: {
        name: "Robot Island",
        img: 'robot-island.png',
        bg: 'robot-island-bg.png',
        pos: { bottom: '10%', right: '25%' },
        size: { width: '280px', height: '250px' },
        message: "A dormant robot awaits. It seems to be missing some components.",
        character: {
            id: 'robot',
            img: 'robot.png',
            pos: { bottom: '60px', left: '90px' },
            size: { width: '100px', height: '100px' },
            onClick: () => {
                if (inventory.key && inventory.shield) {
                    messageLog.textContent = "Robot: 'SYSTEMS ONLINE. KEY AND SHIELD DETECTED. THANK YOU, TRAVELER.'";
                } else if (inventory.key) {
                    messageLog.textContent = "Robot: '...key detected... shield required...'";
                } else if (inventory.shield) {
                    messageLog.textContent = "Robot: '...shield detected... key required...'";
                } else {
                    messageLog.textContent = "Robot: '...components missing... requires key... requires shield...'";
                }
            }
        }
    }
};

function renderScene() {
    // Clear previous elements except ship
    scene.innerHTML = '';
    scene.appendChild(ship);

    const currentIslandData = islands[currentIslandId];
    scene.style.backgroundImage = `url(${currentIslandData.bg})`;
    messageLog.textContent = currentIslandData.message;

    // Render other islands
    for (const id in islands) {
        if (id === currentIslandId) continue;
        const islandData = islands[id];
        const islandEl = document.createElement('div');
        islandEl.id = id;
        islandEl.className = 'island';
        islandEl.style.backgroundImage = `url(${islandData.img})`;
        Object.assign(islandEl.style, islandData.pos, islandData.size);
        islandEl.onclick = () => travelTo(id);
        scene.appendChild(islandEl);
    }
    
    // Render current island's special features
    renderCurrentIslandDetails();
    updateShipPosition();
}

function renderCurrentIslandDetails() {
    const islandData = islands[currentIslandId];
    
    const currentIslandEl = document.createElement('div');
    currentIslandEl.id = currentIslandId;
    currentIslandEl.className = 'island current';
    currentIslandEl.style.backgroundImage = `url(${islandData.img})`;
    currentIslandEl.style.width = '400px';
    currentIslandEl.style.height = '300px';
    currentIslandEl.style.bottom = '0';
    currentIslandEl.style.left = `calc(50% - 200px)`;
    scene.appendChild(currentIslandEl);
    
    // Render item if it exists and hasn't been collected
    if (islandData.item && !inventory[islandData.item.id]) {
        const itemEl = document.createElement('div');
        itemEl.className = 'item';
        itemEl.style.backgroundImage = `url(${islandData.item.img})`;
        Object.assign(itemEl.style, islandData.item.pos);
        itemEl.onclick = () => collectItem(islandData.item.id, islandData.item.img, itemEl);
        currentIslandEl.appendChild(itemEl);
    }

    // Render character if it exists
    if (islandData.character) {
        const charData = islandData.character;
        const charEl = document.createElement('div');
        charEl.className = 'item'; // Re-use item styling for hover effects
        charEl.style.backgroundImage = `url(${charData.img})`;
        Object.assign(charEl.style, charData.pos, charData.size);
        charEl.onclick = () => {
            playSound('click.mp3');
            charData.onClick();
        };
        currentIslandEl.appendChild(charEl);
    }
}


function travelTo(islandId) {
    if (ship.style.transition.includes("0s")) return; // Don't allow travel while traveling
    playSound('travel.mp3');
    const targetIsland = document.getElementById(islandId);
    const targetRect = targetIsland.getBoundingClientRect();
    const sceneRect = scene.getBoundingClientRect();

    ship.style.left = `${targetRect.left - sceneRect.left + targetRect.width / 2 - ship.width / 2}px`;
    ship.style.top = `${targetRect.top - sceneRect.top + targetRect.height / 2 - ship.height / 2}px`;
    
    // Disable clicking while traveling
    ship.style.pointerEvents = 'none';
    scene.querySelectorAll('.island').forEach(el => el.style.pointerEvents = 'none');


    setTimeout(() => {
        currentIslandId = islandId;
        renderScene();
        ship.style.pointerEvents = 'auto';
    }, 2000);
}

function updateShipPosition() {
    const currentIslandData = islands[currentIslandId];
    
    ship.style.transition = 'all 0s linear'; // Teleport ship to start position
    if (currentIslandId === 'main') {
        ship.style.left = `calc(50% - 220px)`;
        ship.style.top = `calc(100% - 180px)`;
    } else if (currentIslandId === 'key') {
         ship.style.left = `calc(10% + 50px)`;
         ship.style.top = `calc(20% + 150px)`;
    } else if (currentIslandId === 'shield') {
         ship.style.left = `calc(92% - 150px)`;
         ship.style.top = `calc(15% + 180px)`;
    } else if (currentIslandId === 'robot') {
         ship.style.left = `calc(75% - 20px)`;
         ship.style.top = `calc(90% - 150px)`;
    }

    setTimeout(() => {
        ship.style.transition = 'all 2s ease-in-out'; // Restore transition
    }, 50);
}


function collectItem(itemId, itemImgUrl, itemEl) {
    playSound('collect.mp3');
    inventory[itemId] = true;
    itemEl.style.opacity = '0';
    itemEl.style.transform = 'scale(0)';

    messageLog.textContent = `You found the ${itemId}!`;

    const inventorySlot = document.createElement('div');
    inventorySlot.className = 'inventory-item';
    inventorySlot.style.backgroundImage = `url(${itemImgUrl})`;
    inventoryItems.appendChild(inventorySlot);

    setTimeout(() => {
        itemEl.remove();
    }, 500);
}


function setupInitialState() {
    document.body.addEventListener('click', initAudio, { once: true });
    ship.onclick = () => {
        if (currentIslandId === 'main') {
            messageLog.textContent = "Click another island to travel there.";
            playSound('click.mp3');
        }
    };
    renderScene();
}

setupInitialState();

