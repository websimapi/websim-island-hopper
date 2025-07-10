const scene = document.getElementById('scene');
const ship = document.getElementById('ship');
const messageLog = document.getElementById('message-log');
const inventoryItems = document.getElementById('inventory-items');
const exploreButton = document.getElementById('explore-button');

let currentIslandId = 'main';
let inventory = {};
let selectedItem = null;
let audioContext;
const soundBuffers = {};
let isExploring = false;

// --- AUDIO ---
function initAudio() {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    loadSound('click.mp3');
    loadSound('travel.mp3');
    loadSound('collect.mp3');
    loadSound('aichat.mp3');
    loadSound('aiexplore.mp3');
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

// --- AI & WORLD GEN ---
let robotConversationHistory = [];

async function getAIResponse(systemMessage, userPrompt, history) {
    history.push({ role: "user", content: userPrompt });
    const completion = await websim.chat.completions.create({
        messages: [
            { role: "system", content: systemMessage },
            ...history.slice(-6) // Keep history from getting too long
        ],
    });
    const response = completion.content;
    history.push({ role: "assistant", content: response });
    return response;
}

async function generateNewIsland() {
    if (isExploring) return;
    isExploring = true;
    playSound('aiexplore.mp3');
    exploreButton.disabled = true;
    messageLog.textContent = "Gazing into the cosmos, seeking new shores...";

    try {
        const existingIslandNames = Object.values(islands).map(i => i.name).join(', ');

        const completion = await websim.chat.completions.create({
            messages: [{
                role: "system",
                content: `You are an imaginative world-creator for a magical sky-faring game. Generate a concept for a new, unique floating island. Avoid generic names or concepts. Do not use names from this list: ${existingIslandNames}. Respond ONLY with a JSON object following this schema: { "name": "Creative Island Name", "description": "A short, evocative description of the island's appearance and lore.", "image_prompt": "A detailed DALL-E prompt to generate an image of this island. Floating in the sky, cartoon style, vibrant, magical." }`
            }, {
                role: "user",
                content: "Find a new island for me to explore."
            }],
            json: true,
        });

        const result = JSON.parse(completion.content);
        const islandImage = await websim.imageGen({ prompt: result.image_prompt, transparent: true, aspect: "square" });

        const newIslandId = `gen_${Date.now()}`;
        const newIsland = {
            name: result.name,
            img: islandImage.url,
            bg: ['key-island-bg.png', 'shield-island-bg.png', 'robot-island-bg.png', 'background.png'][Math.floor(Math.random() * 4)],
            pos: {
                top: `${15 + Math.random() * 20}%`,
                left: `${10 + Math.random() * 80}%`
            },
            size: { width: '250px', height: '250px' },
            message: result.description,
        };

        islands[newIslandId] = newIsland;
        renderScene();
        messageLog.textContent = `A new destination has appeared: ${result.name}!`;

    } catch (error) {
        console.error("Failed to generate new island:", error);
        messageLog.textContent = "The cosmos remains silent for now. Try again later.";
    } finally {
        isExploring = false;
        exploreButton.disabled = false;
    }
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
        item: { id: 'key', name: 'Ancient Key', img: 'key.png', pos: { bottom: '70px', left: '100px' } }
    },
    shield: {
        name: "Fortress Island",
        img: 'shield-island.png',
        bg: 'shield-island-bg.png',
        pos: { top: '15%', right: '8%' },
        size: { width: '300px', height: '300px' },
        message: "A powerful shield rests on this fortified island.",
        item: { id: 'shield', name: 'Guardian Shield', img: 'shield.png', pos: { bottom: '110px', right: '110px' } }
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
            state: { hasKey: false, hasShield: false },
            onClick: async (usedItem) => {
                playSound('aichat.mp3');
                const robot = islands.robot.character;
                let userPrompt = "The traveler is interacting with me.";

                if (usedItem) {
                     if (inventory[usedItem].name.toLowerCase().includes('key') && !robot.state.hasKey) {
                        robot.state.hasKey = true;
                        userPrompt = "The traveler just gave me the key component I was missing.";
                        inventory[usedItem].used = true;
                        updateInventory();
                    } else if (inventory[usedItem].name.toLowerCase().includes('shield') && !robot.state.hasShield) {
                        robot.state.hasShield = true;
                        userPrompt = "The traveler just gave me the shield component I was missing.";
                        inventory[usedItem].used = true;
                        updateInventory();
                    } else {
                        userPrompt = `The traveler tried to use a ${inventory[usedItem].name} on me, but it's not what I need or I already have it.`;
                    }
                }

                if(robot.state.hasKey && robot.state.hasShield){
                    userPrompt += " I am now fully activated!";
                } else if(robot.state.hasKey){
                    userPrompt += " I still need the shield component.";
                } else if(robot.state.hasShield){
                    userPrompt += " I still need the key component.";
                } else {
                    userPrompt += " I am missing both key and shield components.";
                }

                const systemPrompt = "You are a slightly malfunctioning, ancient robot guardian on a floating island. You speak in short, computed phrases, often mentioning system status or required components. You awaken when given a key and a shield. Be helpful but brief.";

                messageLog.textContent = "Robot is processing...";
                const response = await getAIResponse(systemPrompt, userPrompt, robotConversationHistory);
                messageLog.textContent = `Robot: "${response}"`;
                deselectItem();
            }
        }
    }
};

// --- SCENE & INTERACTION ---
function renderScene() {
    // Clear previous elements except ship
    scene.innerHTML = '';
    scene.appendChild(ship);
    
    // Add explore button back if it was removed
    if (!exploreButton.parentElement) {
        document.getElementById('controls').appendChild(exploreButton);
    }
    
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
        // Prevent setting both left and right, prioritize left if both exist
        const posStyle = { ...islandData.pos };
        if (posStyle.left && posStyle.right) delete posStyle.right;
        Object.assign(islandEl.style, posStyle, islandData.size);
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
    scene.appendChild(currentIslandEl);
    
    // Render item if it exists and hasn't been collected
    if (islandData.item && !inventory[islandData.item.id]) {
        const itemEl = document.createElement('div');
        itemEl.className = 'item';
        itemEl.style.backgroundImage = `url(${islandData.item.img})`;
        Object.assign(itemEl.style, islandData.item.pos);
        itemEl.onclick = () => collectItem(islandData.item, itemEl);
        currentIslandEl.appendChild(itemEl);
    }

    // Render character if it exists
    if (islandData.character) {
        const charData = islandData.character;
        const charEl = document.createElement('div');
        charEl.className = 'item'; // Re-use item styling for hover effects
        charEl.style.backgroundImage = `url(${charData.img})`;
        Object.assign(charEl.style, charData.pos, charData.size);
        charEl.onclick = (e) => {
            e.stopPropagation(); // prevent clicks on character from propagating to island
            playSound('click.mp3');
            charData.onClick(selectedItem);
        };
        currentIslandEl.appendChild(charEl);
    }
}

function travelTo(islandId) {
    if (ship.style.transition.includes("0s")) return; // Don't allow travel while traveling
    deselectItem();
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
    ship.style.transition = 'all 0s linear'; // Teleport ship to start position
    const currentIslandEl = document.querySelector('.island.current');
    if (!currentIslandEl) return;
    const islandRect = currentIslandEl.getBoundingClientRect();
    const shipRect = ship.getBoundingClientRect();
    
    // Position ship to the left of the current island platform
    ship.style.left = `${islandRect.left - shipRect.width * 0.8}px`;
    ship.style.top = `${islandRect.bottom - shipRect.height * 1.2}px`;
    
    setTimeout(() => {
        ship.style.transition = 'all 2s ease-in-out'; // Restore transition
    }, 50);
}

function collectItem(itemData, itemEl) {
    playSound('collect.mp3');
    inventory[itemData.id] = { ...itemData, used: false };
    itemEl.style.opacity = '0';
    itemEl.style.transform = 'scale(0)';

    messageLog.textContent = `You found the ${itemData.name}! Check your inventory.`;

    updateInventory();

    setTimeout(() => {
        itemEl.remove();
    }, 500);
}

function updateInventory() {
    inventoryItems.innerHTML = '';
    for (const itemId in inventory) {
        const itemData = inventory[itemId];
        const inventorySlot = document.createElement('div');
        inventorySlot.className = 'inventory-item';
        inventorySlot.style.backgroundImage = `url(${itemData.img})`;
        inventorySlot.dataset.itemId = itemId;

        if(itemData.used) {
            inventorySlot.style.opacity = '0.5';
            inventorySlot.style.filter = 'saturate(0)';
        }

        inventorySlot.onclick = () => {
            if (itemData.used) return;
            playSound('click.mp3');
            if (selectedItem === itemId) {
                deselectItem();
            } else {
                selectItem(itemId);
            }
        };
        inventoryItems.appendChild(inventorySlot);
    }
    // re-apply selection style if needed
    if (selectedItem) {
        const selectedSlot = inventoryItems.querySelector(`.inventory-item[data-item-id="${selectedItem}"]`);
        if (selectedSlot) {
            selectedSlot.classList.add('selected');
        } else {
            selectedItem = null; // item no longer exists, deselect
        }
    }
}

function selectItem(itemId) {
    deselectItem(); // deselect any previous item
    selectedItem = itemId;
    const selectedSlot = inventoryItems.querySelector(`.inventory-item[data-item-id="${itemId}"]`);
    if (selectedSlot) {
        selectedSlot.classList.add('selected');
    }
    messageLog.textContent = `Selected ${inventory[itemId].name}. Click on something to use it.`;
}

function deselectItem() {
    if (!selectedItem) return;
    const previouslySelectedSlot = inventoryItems.querySelector(`.inventory-item[data-item-id="${selectedItem}"]`);
    if (previouslySelectedSlot) {
        previouslySelectedSlot.classList.remove('selected');
    }
    selectedItem = null;
    // Don't clear message log if AI is responding
    if(!messageLog.textContent.includes('...')) {
        messageLog.textContent = islands[currentIslandId].message;
    }
}

function setupInitialState() {
    document.body.addEventListener('click', initAudio, { once: true });
    ship.onclick = () => {
        if (currentIslandId === 'main') {
            messageLog.textContent = "Click another island to travel there.";
            playSound('click.mp3');
        }
    };
    exploreButton.onclick = generateNewIsland;
    renderScene();
}

setupInitialState();