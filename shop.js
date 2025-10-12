// Function to update a single card's visual state based on player data
function updateCard(cardElement) {
    const statKey = cardElement.getAttribute('data-stat-key');
    const level = player.upgrades[statKey];
    const cost = player.upgrades.price;
    const metadata = player.metadata[statKey];

    // 1. Render Bar (Emoji Progress)
    let barHTML = '';
    // Determine the filled emoji color
    const filledSquare = metadata.color === 'red' ? '🟥' :
        metadata.color === 'blue' ? '🟦' :
            metadata.color === 'green' ? '🟩' :
                metadata.color === 'pink' ? '🟪' :
                    metadata.color === 'yellow' ? '🟨' : '🟧';
    const emptySquare = '⬜';

    for (let i = 1; i <= player.upgrades.maxLevel; i++) {
        barHTML += (i <= level) ? filledSquare : emptySquare;
    }
    cardElement.querySelector('.stat-bar').innerHTML = barHTML;

    // 2. Render Level Text
    cardElement.querySelector('.stat-level').textContent = `LVL ${level}/${player.upgrades.maxLevel}`;

    // 3. Render Button
    const button = cardElement.querySelector('.stat-button');
    const isMaxed = level >= player.upgrades.maxLevel;
    const canAfford = player.gold >= cost;

    // Default button states
    let buttonIcon = 'plus';
    let buttonText = `${cost}`;
    let buttonClass = 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg';

    // State overrides
    if (isMaxed) {
        buttonIcon = 'check-circle';
        buttonText = 'MAX LVL';
        buttonClass = 'bg-gray-700 text-gray-400 cursor-not-allowed';
        button.removeAttribute('onclick');
    } else if (!canAfford) {
        buttonText = `Need ${cost}`;
        buttonClass = 'bg-gray-700 text-gray-400 cursor-not-allowed';
        // Use a non-upgrade click handler to show the error message immediately
        button.setAttribute('onclick', `addMessage('❌ Not enough Gold for ${statKey.charAt(0).toUpperCase() + statKey.slice(1)}. You need ${cost} Gold.')`);
    } else {
        // Ensure upgrade function is active for purchaseable items
        button.setAttribute('onclick', `upgrade('${statKey}')`);
    }

    // Apply calculated styles and content
    button.className = `stat-button w-full font-semibold py-2 rounded-md transition duration-200 flex items-center justify-center text-sm ${buttonClass}`;
    button.innerHTML = `<i data-lucide="${buttonIcon}" class="w-4 h-4 mr-1"></i> ${buttonText}`;
}
function upgrade(u){
    if(player.upgrades[u]===player.upgrades.maxLevel) return addMessage("you have reached the max level for this upgrade!")
    if(player.gold<player.upgrades.price)return addMessage("not enough points to buy this upgrade!", "#cc0000ff")
    player.gold-=player.upgrades.price
    player.upgrades[u]++
    player.upgrades.price=Math.floor(player.upgrades.price*1.5)
    updateStats(u);
    renderShop();
    addMessage("upgraded")
    updateUI()
}

function updateStats(statKey){
    // Update player stats based on upgrades using switch-case
        switch (statKey) {
            case 'health':
                player.maxHealth = Math.floor(100 * (1.15 ** player.upgrades.health));
                break;
            case 'damage':
                player.damage =Math.floor( 10 * (1.12 ** player.upgrades.damage));
                break;
            case 'regeneration':
                player.regeneration = 1 * (1.25 ** player.upgrades.regeneration);
                break;
            case 'speed':
                player.speed = 0.15 * (1.2 ** player.upgrades.speed);
                break;
            case 'luck':
                player.luck = 1 * (1.14 ** player.upgrades.luck);
                break;
            case 'mana':
                player.maxMana = Math.floor(100 * (1.13 ** player.upgrades.mana));
                break;
            // Add more cases if needed
        }
    

}

// Renders all upgrade cards and the currency display
function renderShop() {
    // 1. Update currency display from player.gold
    document.getElementById('current-gems').textContent = player.gold.toLocaleString();

    // 2. Update all static cards
    document.querySelectorAll('.upgrade-card').forEach(updateCard);

    // 3. Re-initialize Lucide icons after DOM manipulation
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}
