/**
 * RFID Reader module for handling card scanning
 */
const RFIDReader = (function() {
    // Private variables
    let lastCardId = null;
    let simulatedCardId = null;
    let isPolling = false;
    let pollInterval = null;
    const POLL_INTERVAL_MS = 2000; // 2 seconds
    
    // Initialize the module
    function init() {
        setupEventListeners();
        updateCardStatus();
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Listen for manual card ID input
        const manualCardInput = document.getElementById('manualCardInput');
        const submitManualCardBtn = document.getElementById('submitManualCard');
        
        if (manualCardInput && submitManualCardBtn) {
            submitManualCardBtn.addEventListener('click', function() {
                const cardId = manualCardInput.value.trim();
                if (cardId) {
                    simulateCardScan(cardId);
                    if (UIControls && typeof UIControls.showAlert === 'function') {
                        UIControls.showAlert(`Manual card ID entered: ${cardId}`, 'info');
                    }
                    manualCardInput.value = '';
                }
            });
            
            // Allow pressing Enter in the input field
            manualCardInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    submitManualCardBtn.click();
                }
            });
        }
        
        // Start/stop polling buttons
        const startPollingBtn = document.getElementById('startRfidPolling');
        const stopPollingBtn = document.getElementById('stopRfidPolling');
        
        if (startPollingBtn) {
            startPollingBtn.addEventListener('click', function() {
                startPolling();
                updatePollingStatus(true);
            });
        }
        
        if (stopPollingBtn) {
            stopPollingBtn.addEventListener('click', function() {
                stopPolling();
                updatePollingStatus(false);
            });
        }
        
        // Customer quick select for card simulation
        const customerSelect = document.getElementById('customerCardSelect');
        if (customerSelect) {
            customerSelect.addEventListener('change', function() {
                const cardId = this.value;
                if (cardId) {
                    simulateCardScan(cardId);
                    this.value = ''; // Reset select after use
                }
            });
        }
    }
    
    // Simulate a card scan with the given ID
    function simulateCardScan(cardId) {
        if (!cardId) return;
        
        simulatedCardId = cardId;
        processCardScan(cardId);
        
        // Show the card ID in the UI
        updateCardDisplay(cardId);
        
        // Check if there's an open ticket for this card and highlight it
        const openTicket = TicketManager.getOpenTicketForCard(cardId);
        if (openTicket) {
            TicketManager.highlightOpenTicket(openTicket.id);
            
            // Switch to the ticket tab if configured
            if (UIControls && typeof UIControls.switchToTab === 'function') {
                UIControls.switchToTab('ticketsTab');
            }
        }
    }
    
    // Start polling for RFID cards
    function startPolling() {
        if (isPolling) return;
        
        isPolling = true;
        pollInterval = setInterval(pollForCard, POLL_INTERVAL_MS);
        
        // Poll immediately
        pollForCard();
    }
    
    // Stop polling for RFID cards
    function stopPolling() {
        isPolling = false;
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }
    
    // Poll the server for the current card
    async function pollForCard() {
        try {
            const response = await fetch('/api/rfid/current');
            const data = await response.json();
            
            if (data.card_id && data.card_id !== lastCardId) {
                lastCardId = data.card_id;
                processCardScan(data.card_id);
            }
            
            updateCardDisplay(data.card_id || simulatedCardId);
        } catch (error) {
            console.error('Error polling for RFID card:', error);
            updateCardDisplay(null, error.message || 'Error polling for card');
        }
    }
    
    // Process a card scan
    function processCardScan(cardId) {
        if (!cardId) return;
        
        // Get current weight from the scale
        const weight = WeightScale ? WeightScale.getCurrentWeight() : 0;
        
        // Process the card with the weight
        if (TicketManager && typeof TicketManager.handleRfidScan === 'function') {
            TicketManager.handleRfidScan(cardId, weight);
        }
    }
    
    // Update the card display in the UI
    function updateCardDisplay(cardId, errorMessage = null) {
        const cardIdDisplay = document.getElementById('currentCardId');
        const cardStatusDisplay = document.getElementById('cardStatus');
        
        if (cardIdDisplay) {
            cardIdDisplay.textContent = cardId || 'None';
        }
        
        if (cardStatusDisplay) {
            if (errorMessage) {
                cardStatusDisplay.textContent = errorMessage;
                cardStatusDisplay.className = 'text-danger';
            } else if (cardId) {
                // Check if there's an open ticket for this card
                const openTicket = TicketManager.getOpenTicketForCard(cardId);
                
                if (openTicket) {
                    cardStatusDisplay.textContent = `Open ticket #${openTicket.id} found for this card`;
                    cardStatusDisplay.className = 'text-success';
                } else {
                    cardStatusDisplay.textContent = 'Card ready for new ticket';
                    cardStatusDisplay.className = 'text-primary';
                }
            } else {
                cardStatusDisplay.textContent = 'No card detected';
                cardStatusDisplay.className = 'text-muted';
            }
        }
    }
    
    // Update the card status based on the currently selected card
    function updateCardStatus() {
        updateCardDisplay(simulatedCardId || lastCardId);
    }
    
    // Update the polling status in the UI
    function updatePollingStatus(isActive) {
        const pollingStatus = document.getElementById('pollingStatus');
        const startBtn = document.getElementById('startRfidPolling');
        const stopBtn = document.getElementById('stopRfidPolling');
        
        if (pollingStatus) {
            if (isActive) {
                pollingStatus.innerHTML = '<span class="badge bg-success">Active</span>';
            } else {
                pollingStatus.innerHTML = '<span class="badge bg-secondary">Inactive</span>';
            }
        }
        
        if (startBtn && stopBtn) {
            startBtn.disabled = isActive;
            stopBtn.disabled = !isActive;
        }
    }
    
    // Get the last detected card ID
    function getLastCardId() {
        return lastCardId || simulatedCardId;
    }
    
    // Public API
    return {
        init: init,
        startPolling: startPolling,
        stopPolling: stopPolling,
        simulateCardScan: simulateCardScan,
        getLastCardId: getLastCardId,
        updateCardStatus: updateCardStatus
    };
})();

// Initialize RFID Reader when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    RFIDReader.init();
});