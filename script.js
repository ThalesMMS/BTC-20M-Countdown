// Constants
const TARGET_BTC = 20000000;
const TOTAL_BTC_SUPPLY = 21000000;
const SATS_PER_BTC = 100000000;
const HALVING_INTERVAL = 210000;
const INITIAL_SUBSIDY_SATS = 50 * SATS_PER_BTC;
const FIXED_BLOCK_TIME_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
const FALLBACK_BLOCK_TIME_MS = FIXED_BLOCK_TIME_MS;
const API_POLL_INTERVAL = 30000; // 30 seconds
const BLOCKS_API_URL = 'https://mempool.space/api/blocks';
const HEIGHT_API_URL = 'https://mempool.space/api/blocks/tip/height';

const TARGET_SATS = TARGET_BTC * SATS_PER_BTC;
const TARGET_BLOCK = blockHeightForSupply(TARGET_SATS);

// State
let currentBlock = null;
let avgBlockTimeMs = FALLBACK_BLOCK_TIME_MS;
let lastBlockTimeMs = null;
let estimatedTargetTimeMs = null;
let countdownInterval = null;
let estimateMode = 'average';

// DOM Elements
const elements = {
    days: document.getElementById('days'),
    hours: document.getElementById('hours'),
    mins: document.getElementById('mins'),
    secs: document.getElementById('secs'),
    daysFlip: document.getElementById('days-flip'),
    hoursFlip: document.getElementById('hours-flip'),
    minsFlip: document.getElementById('mins-flip'),
    secsFlip: document.getElementById('secs-flip'),
    currentBlock: document.getElementById('current-block'),
    targetBlock: document.getElementById('target-block'),
    blocksLeft: document.getElementById('blocks-left'),
    btcLeft: document.getElementById('btc-left'),
    estimatedDate: document.getElementById('estimated-date'),
    btcMined: document.getElementById('btc-mined'),
    progressPercent: document.getElementById('progress-percent'),
    progressFill: document.getElementById('progress-fill'),
    estimateMode: document.getElementById('estimate-mode'),
    estimateModeLabel: document.getElementById('estimate-mode-label'),
    modeFixedLabel: document.getElementById('mode-fixed-label'),
    modeAvgLabel: document.getElementById('mode-avg-label'),
    avgBlockTime: document.getElementById('avg-block-time'),
    lastUpdate: document.getElementById('last-update')
};

// Calculate total subsidy mined (in satoshis) at a given block height
function totalSubsidyAtHeight(height) {
    if (height === null || height < 0) return 0;

    let remainingBlocks = height + 1;
    let subsidy = INITIAL_SUBSIDY_SATS;
    let total = 0;

    while (remainingBlocks > 0 && subsidy > 0) {
        const blocksThisEra = Math.min(remainingBlocks, HALVING_INTERVAL);
        total += blocksThisEra * subsidy;
        remainingBlocks -= blocksThisEra;
        subsidy = Math.floor(subsidy / 2);
    }

    return total;
}

// Find the first block height where total subsidy >= target (in satoshis)
function blockHeightForSupply(targetSats) {
    let subsidy = INITIAL_SUBSIDY_SATS;
    let remaining = targetSats;
    let blocks = 0;

    while (subsidy > 0) {
        const eraSupply = subsidy * HALVING_INTERVAL;
        if (remaining > eraSupply) {
            remaining -= eraSupply;
            blocks += HALVING_INTERVAL;
            subsidy = Math.floor(subsidy / 2);
            continue;
        }

        const blocksNeeded = Math.ceil(remaining / subsidy);
        return blocks + blocksNeeded - 1;
    }

    return null;
}

function calculateAverageBlockTimeMs(blocks) {
    if (!Array.isArray(blocks) || blocks.length < 2) return null;

    let totalSeconds = 0;
    let samples = 0;
    for (let i = 0; i < blocks.length - 1; i += 1) {
        const delta = blocks[i].timestamp - blocks[i + 1].timestamp;
        if (delta > 0) {
            totalSeconds += delta;
            samples += 1;
        }
    }

    if (samples === 0) return null;
    return (totalSeconds / samples) * 1000;
}

function getActiveBlockTimeMs() {
    return estimateMode === 'fixed' ? FIXED_BLOCK_TIME_MS : avgBlockTimeMs;
}

function updateEstimatedTargetTime(blocksLeft, anchorTimeMs = lastBlockTimeMs) {
    if (anchorTimeMs === null || blocksLeft === null) return;
    estimatedTargetTimeMs = anchorTimeMs + (blocksLeft * getActiveBlockTimeMs());
}

// Fetch current block data from mempool.space
async function fetchBlockData() {
    try {
        const response = await fetch(BLOCKS_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blocks = await response.json();
        if (!Array.isArray(blocks) || blocks.length === 0) {
            throw new Error('Invalid blocks response');
        }

        const sortedBlocks = [...blocks].sort((a, b) => b.height - a.height);
        const tipBlock = sortedBlocks[0];
        const nextHeight = tipBlock.height;
        const isNewBlock = currentBlock === null || nextHeight !== currentBlock;
        currentBlock = nextHeight;
        const averageMs = calculateAverageBlockTimeMs(sortedBlocks);
        if (averageMs) {
            avgBlockTimeMs = averageMs;
        }

        const blockTimeMs = tipBlock.timestamp * 1000;
        if (isNewBlock || estimatedTargetTimeMs === null || lastBlockTimeMs !== blockTimeMs) {
            lastBlockTimeMs = blockTimeMs;
            updateEstimatedTargetTime(Math.max(0, TARGET_BLOCK - currentBlock), blockTimeMs);
        }
        updateLastUpdateTime();
        return true;
    } catch (error) {
        console.error('Error fetching block data:', error);
        return fetchBlockHeightFallback();
    }
}

async function fetchBlockHeightFallback() {
    try {
        const response = await fetch(HEIGHT_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const height = await response.json();
        const isNewBlock = currentBlock === null || height !== currentBlock;
        currentBlock = height;
        if (isNewBlock || estimatedTargetTimeMs === null) {
            lastBlockTimeMs = Date.now();
            updateEstimatedTargetTime(Math.max(0, TARGET_BLOCK - currentBlock), lastBlockTimeMs);
        }
        updateLastUpdateTime();
        return true;
    } catch (error) {
        console.error('Error fetching block height:', error);
        elements.currentBlock.classList.add('error');
        elements.currentBlock.textContent = 'API Error';
        return false;
    }
}

// Calculate remaining blocks, BTC, and total mined
function calculateRemaining() {
    if (currentBlock === null) return null;

    const blocksLeft = Math.max(0, TARGET_BLOCK - currentBlock);
    const totalMinedSats = totalSubsidyAtHeight(currentBlock);
    const btcLeftSats = Math.max(0, TARGET_SATS - totalMinedSats);

    return { blocksLeft, totalMinedSats, btcLeftSats };
}

// Format number with commas
function formatNumber(num) {
    return num.toLocaleString('en-US');
}

function formatBtc(amount, maximumFractionDigits = 8) {
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits
    });
}

function formatDurationShort(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '--';
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

// Pad number with leading zero
function padZero(num) {
    return String(Math.floor(num)).padStart(2, '0');
}

// Trigger flip animation
function triggerFlip(element, newValue) {
    const currentValue = element.querySelector('span').textContent;
    if (currentValue !== newValue) {
        element.classList.add('flip');
        setTimeout(() => {
            element.querySelector('span').textContent = newValue;
        }, 300);
        setTimeout(() => {
            element.classList.remove('flip');
        }, 600);
    }
}

// Update countdown display
function updateCountdownDisplay(msLeft) {
    if (msLeft === null) {
        triggerFlip(elements.daysFlip, '--');
        triggerFlip(elements.hoursFlip, '--');
        triggerFlip(elements.minsFlip, '--');
        triggerFlip(elements.secsFlip, '--');
        return;
    }

    const totalSeconds = Math.floor(msLeft / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const daysStr = padZero(days);
    const hoursStr = padZero(hours);
    const minsStr = padZero(mins);
    const secsStr = padZero(secs);

    // Update with flip animation
    triggerFlip(elements.daysFlip, daysStr);
    triggerFlip(elements.hoursFlip, hoursStr);
    triggerFlip(elements.minsFlip, minsStr);
    triggerFlip(elements.secsFlip, secsStr);
}

// Format estimated date
function formatEstimatedDate(msLeft) {
    const estimatedDate = new Date(Date.now() + msLeft);
    const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    };
    return estimatedDate.toLocaleString('en-US', options);
}

// Update stats display
function updateStatsDisplay(data, msLeft) {
    elements.currentBlock.classList.remove('error');
    elements.currentBlock.textContent = formatNumber(currentBlock);
    elements.targetBlock.textContent = formatNumber(TARGET_BLOCK);
    elements.blocksLeft.textContent = formatNumber(data.blocksLeft);
    elements.btcLeft.textContent = formatBtc(data.btcLeftSats / SATS_PER_BTC) + ' BTC';

    if (data.blocksLeft === 0) {
        elements.estimatedDate.textContent = 'Reached';
    } else if (msLeft !== null) {
        elements.estimatedDate.textContent = formatEstimatedDate(msLeft);
    } else {
        elements.estimatedDate.textContent = '--';
    }

    // Update progress
    const totalMinedBtc = data.totalMinedSats / SATS_PER_BTC;
    const progressPercent = Math.min((data.totalMinedSats / (TOTAL_BTC_SUPPLY * SATS_PER_BTC)) * 100, 100);

    elements.btcMined.textContent = formatBtc(totalMinedBtc);
    elements.progressPercent.textContent = progressPercent.toFixed(2);
    elements.progressFill.style.width = progressPercent + '%';

    const activeBlockTimeMs = getActiveBlockTimeMs();
    if (elements.avgBlockTime) {
        elements.avgBlockTime.textContent = formatDurationShort(activeBlockTimeMs);
    }
    if (elements.estimateModeLabel) {
        elements.estimateModeLabel.textContent = estimateMode === 'fixed'
            ? 'fixed 10-minute blocks'
            : 'the last 10 blocks average time';
    }
    if (elements.modeFixedLabel && elements.modeAvgLabel) {
        elements.modeFixedLabel.classList.toggle('active', estimateMode === 'fixed');
        elements.modeAvgLabel.classList.toggle('active', estimateMode === 'average');
    }
}

// Update last update time display
function updateLastUpdateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    elements.lastUpdate.textContent = `Last update: ${timeStr}`;
}

function setupEstimateModeToggle() {
    if (!elements.estimateMode) return;
    elements.estimateMode.checked = estimateMode === 'average';
    if (elements.modeFixedLabel && elements.modeAvgLabel) {
        elements.modeFixedLabel.classList.toggle('active', estimateMode === 'fixed');
        elements.modeAvgLabel.classList.toggle('active', estimateMode === 'average');
    }

    elements.estimateMode.addEventListener('change', () => {
        estimateMode = elements.estimateMode.checked ? 'average' : 'fixed';
        if (currentBlock !== null && lastBlockTimeMs !== null) {
            updateEstimatedTargetTime(Math.max(0, TARGET_BLOCK - currentBlock), lastBlockTimeMs);
        }
        updateDisplay();
    });
}

// Main update function
function updateDisplay() {
    const data = calculateRemaining();
    if (!data) {
        updateCountdownDisplay(null);
        return;
    }

    const msLeft = estimatedTargetTimeMs === null
        ? null
        : Math.max(0, estimatedTargetTimeMs - Date.now());

    updateCountdownDisplay(msLeft);
    updateStatsDisplay(data, msLeft);
}

// Start the countdown
async function startCountdown() {
    // Initial fetch
    await fetchBlockData();
    updateDisplay();

    // Update countdown every second
    countdownInterval = setInterval(updateDisplay, 1000);

    // Fetch new block height every 30 seconds
    setInterval(async () => {
        await fetchBlockData();
        updateDisplay();
    }, API_POLL_INTERVAL);
}

// Handle visibility change (refresh data when tab becomes visible)
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        await fetchBlockData();
        updateDisplay();
    }
});

// Initialize
setupEstimateModeToggle();
startCountdown();
