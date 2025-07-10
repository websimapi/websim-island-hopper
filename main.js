import * as THREE from 'three';

const gameContainer = document.getElementById('game-container');
const world = document.getElementById('world');
const sceneEl = document.getElementById('scene');
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

// --- World Panning ---
let isPanning = false;
let startPanPos = { x: 0, y: 0 };
let scenePos = { x: 0, y: 0 };
let currentSceneTransform = { x: 0, y: 0 };

function setupPanning() {
    world.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('island') || e.target.classList.contains('item') || e.target.id === 'ship') return;
        isPanning = true;
        startPanPos = { x: e.clientX, y: e.clientY };
        scenePos = { x: currentSceneTransform.x, y: currentSceneTransform.y };
        world.style.cursor = 'grabbing';
        sceneEl.style.transition = 'none';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        const dx = e.clientX - startPanPos.x;
        const dy = e.clientY - startPanPos.y;
        currentSceneTransform.x = scenePos.x + dx;
        currentSceneTransform.y = scenePos.y + dy;
        sceneEl.style.transform = `translate(${currentSceneTransform.x}px, ${currentSceneTransform.y}px)`;
    });

    window.addEventListener('mouseup', () => {
        if (!isPanning) return;
        isPanning = false;
        world.style.cursor = 'grab';
    });

    world.addEventListener('mouseleave', () => {
        if (!isPanning) return;
        isPanning = false;
        world.style.cursor = 'grab';
    });
}

function centerViewOn(element) {
    sceneEl.style.transition = 'transform 2s ease-in-out';
    
    const worldRect = world.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    // Calculate the translation needed to center the element
    const targetX = worldRect.width / 2 - (elementRect.left - currentSceneTransform.x) - elementRect.width / 2;
    const targetY = worldRect.height / 2 - (elementRect.top - currentSceneTransform.y) - elementRect.height / 2;

    currentSceneTransform.x = targetX;
    currentSceneTransform.y = targetY;

    sceneEl.style.transform = `translate(${targetX}px, ${targetY}px)`;

    setTimeout(() => {
        sceneEl.style.transition = 'none';
    }, 2000); // Match transition duration
}

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
                 // Place new islands in a wide arc around the center
                top: `${800 + Math.random() * 600}px`,
                left: `${500 + Math.random() * 2000}px`
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
        pos: { top: '1000px', left: '1500px' }, // Center of the world
        size: { width: '300px', height: '200px' },
        message: "This is where your journey begins. Drag the world to look around, and click an island to travel."
    },
    key: {
        name: "Key Island",
        img: 'key-island.png',
        bg: 'key-island-bg.png',
        pos: { top: '700px', left: '800px' },
        size: { width: '250px', height: '250px' },
        message: "A desolate island holding an ancient artifact.",
        item: { id: 'key', name: 'Ancient Key', img: 'key.png', pos: { x: 0.5, y: 0.55 } } // Use relative positions
    },
    shield: {
        name: "Fortress Island",
        img: 'shield-island.png',
        bg: 'shield-island-bg.png',
        pos: { top: '650px', right: '700px' },
        size: { width: '300px', height: '300px' },
        message: "A powerful shield rests on this fortified island.",
        item: { id: 'shield', name: 'Guardian Shield', img: 'shield.png', pos: { x: 0.5, y: 0.5 } } // Use relative positions
    },
    robot: {
        name: "Robot Island",
        img: 'robot-island.png',
        bg: 'robot-island-bg.png',
        pos: { top: '1400px', left: '1100px' },
        size: { width: '280px', height: '250px' },
        message: "A dormant robot awaits. It seems to be missing some components.",
        character: {
            id: 'robot',
            img: 'robot.png',
            pos: { x: 0.5, y: 0.45 }, // Use relative positions
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
    },
    gem: {
        name: "Gemstone Spire",
        img: 'gem-island.png',
        bg: 'robot-island-bg.png',
        pos: { top: '1350px', right: '600px'},
        size: { width: '250px', height: '250px'},
        message: "A floating island made of pure crystal. A valuable-looking gem rests at its peak.",
        item: { id: 'gem', name: 'Flawless Gemstone', img: 'gem.png', pos: { x: 0.5, y: 0.45 } }
    }
};

// --- SCENE & INTERACTION ---
function renderScene() {
    sceneEl.innerHTML = ''; // Clear everything
    
    // Add explore button back if it was removed
    if (!exploreButton.parentElement) {
        document.getElementById('controls').appendChild(exploreButton);
    }
    
    const currentIslandData = islands[currentIslandId];
    world.style.backgroundImage = `url(${currentIslandData.bg})`;
    messageLog.textContent = currentIslandData.message;

    // Render ALL islands
    for (const id in islands) {
        const islandData = islands[id];
        const islandEl = document.createElement('div');
        islandEl.id = id;
        islandEl.className = 'island';
        if (id === currentIslandId) {
            islandEl.classList.add('current');
        }
        islandEl.style.backgroundImage = `url(${islandData.img})`;
        
        const posStyle = { ...islandData.pos };
        if (posStyle.left && posStyle.right) delete posStyle.right;
        Object.assign(islandEl.style, posStyle, islandData.size);

        islandEl.onclick = () => {
            if (id !== currentIslandId) {
                 travelTo(id);
            }
        };
        sceneEl.appendChild(islandEl);
        
        // Render item if it exists on the island and hasn't been collected
        if (islandData.item && !inventory[islandData.item.id]) {
            renderItemOnIsland(islandData.item, islandEl);
        }

        // Render character if it exists on the island
        if (islandData.character) {
            renderCharacterOnIsland(islandData.character, islandEl);
        }
    }

    sceneEl.appendChild(ship);
    updateShipPosition();

    // After rendering, center the view on the current island
    const currentIslandEl = document.getElementById(currentIslandId);
    if (currentIslandEl) {
        // Use a timeout to ensure the element is in the DOM and sized
        setTimeout(() => centerViewOn(currentIslandEl), 50);
    }
}

function renderItemOnIsland(itemData, islandEl) {
    const itemEl = document.createElement('div');
    itemEl.className = 'item collectible';
    itemEl.style.backgroundImage = `url(${itemData.img})`;
    itemEl.onclick = (e) => {
        e.stopPropagation(); // prevent travel click
        collectItem(itemData, itemEl);
    };
    islandEl.appendChild(itemEl);

    // Position based on relative coordinates
    const islandRect = islandEl.getBoundingClientRect();
    itemEl.style.left = `${itemData.pos.x * islandRect.width - itemEl.offsetWidth / 2}px`;
    itemEl.style.top = `${itemData.pos.y * islandRect.height - itemEl.offsetHeight / 2}px`;
}

function renderCharacterOnIsland(charData, islandEl) {
    const charEl = document.createElement('div');
    charEl.className = 'item character';
    charEl.style.backgroundImage = `url(${charData.img})`;
    Object.assign(charEl.style, charData.size);
    charEl.onclick = (e) => {
        e.stopPropagation(); // prevent travel click
        playSound('click.mp3');
        charData.onClick(selectedItem);
    };
    islandEl.appendChild(charEl);

    const islandRect = islandEl.getBoundingClientRect();
    charEl.style.left = `${charData.pos.x * islandRect.width - charEl.offsetWidth / 2}px`;
    charEl.style.top = `${charData.pos.y * islandRect.height - charEl.offsetHeight / 2}px`;
}

function travelTo(islandId) {
    if (ship.style.transition.includes("all 2s")) return; // Don't allow travel while traveling
    deselectItem();
    playSound('travel.mp3');
    
    const targetIsland = document.getElementById(islandId);
    if (!targetIsland) return;
    
    const targetRect = targetIsland.getBoundingClientRect();
    
    // Animate ship to new location
    ship.style.transition = 'all 2s ease-in-out';
    ship.style.left = `${parseInt(targetIsland.style.left) - ship.width * 0.8}px`;
    ship.style.top = `${parseInt(targetIsland.style.top) + targetRect.height - ship.height * 1.2}px`;

    // Center view on new island
    centerViewOn(targetIsland);
    
    // Disable clicking while traveling
    ship.style.pointerEvents = 'none';
    sceneEl.querySelectorAll('.island').forEach(el => el.style.pointerEvents = 'none');

    setTimeout(() => {
        currentIslandId = islandId;
        // Update current island styles and message
        document.querySelector('.island.current')?.classList.remove('current');
        targetIsland.classList.add('current');
        world.style.backgroundImage = `url(${islands[islandId].bg})`;
        messageLog.textContent = islands[islandId].message;

        ship.style.pointerEvents = 'auto';
        sceneEl.querySelectorAll('.island').forEach(el => el.style.pointerEvents = 'auto');
    }, 2000);
}

function updateShipPosition() {
    ship.style.transition = 'all 0s linear'; // Teleport ship to start position
    const currentIslandEl = document.getElementById(currentIslandId);
    if (!currentIslandEl) return;
    const islandRect = currentIslandEl.getBoundingClientRect();
    
    // Position ship to the left of the current island platform, relative to scene
    ship.style.left = `${parseInt(currentIslandEl.style.left) - ship.width * 0.8}px`;
    ship.style.top = `${parseInt(currentIslandEl.style.top) + islandRect.height - ship.height * 1.2}px`;

    setTimeout(() => {
        ship.style.transition = 'all 2s ease-in-out'; // Restore transition for next travel
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
            messageLog.textContent = "Drag the background to look around, then click another island to travel there.";
            playSound('click.mp3');
        }
    };
    exploreButton.onclick = generateNewIsland;
    renderScene();
    setupPanning();
}

setupInitialState();