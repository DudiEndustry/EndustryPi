/**
 * Weight Scale Module
 * Handles communication with the weight scale hardware and UI updates
 */
const WeightScale = (function() {
    // Private variables
    let toggleId = '';
    let statusTextId = '';
    let weightDisplayId = '';
    let containerDisplayId = '';
    let lastWeight = 0;
    let monitorInterval = null;
    let connectionAttempts = 0;
    
    // Initialize the module
    function init(weightToggleId, weightStatusId, currentWeightId, containerDisplayId) {
        toggleId = weightToggleId;
        statusTextId = weightStatusId;
        weightDisplayId = currentWeightId;
        containerDisplayId = containerDisplayId;
        
        // Initialize to disconnected state
        updateConnectionStatus(false);
        
        // Start monitoring the weight scale
        startMonitoring();
        
        return this;
    }
    
    // Start monitoring the weight scale
    function startMonitoring() {
        if (monitorInterval) {
            clearInterval(monitorInterval);
        }
        
        // Poll the weight scale every second
        monitorInterval = setInterval(readWeight, 1000);
    }
    
    // Update connection status UI
    function updateConnectionStatus(isConnected) {
        const weightToggle = document.getElementById(toggleId);
        const weightStatusText = document.getElementById(statusTextId);
        
        if (weightToggle && weightStatusText) {
            weightToggle.checked = isConnected;
            weightStatusText.textContent = isConnected ? 'Connected' : 'Disconnected';
            
            // Add/remove 'text-danger' class based on connection status
            if (isConnected) {
                weightStatusText.classList.remove('text-danger');
            } else {
                weightStatusText.classList.add('text-danger');
            }
        }
    }
    
    // Read weight from the scale
    async function readWeight() {
        try {
            const response = await fetch('/api/weight/read');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Update connection status - we're connected if we got here
            updateConnectionStatus(true);
            connectionAttempts = 0;
            
            const data = await response.json();
            
            if (data.weight) {
                updateWeightDisplay(data.weight);
            }
        } catch (error) {
            console.error('Error reading weight:', error);
            
            // Update connection status on repeated failures
            connectionAttempts++;
            if (connectionAttempts >= 3) {
                updateConnectionStatus(false);
                showErrorInDisplay();
            }
        }
    }
    
    // Update the weight display
    function updateWeightDisplay(weight) {
        const weightElement = document.getElementById(weightDisplayId);
        if (!weightElement) return;
        
        // Store the weight value
        lastWeight = weight;
        
        // Round weight to the nearest integer for display
        const roundedWeight = Math.round(weight);
        weightElement.textContent = roundedWeight;
        
        // Add a subtle flash effect to show the reading is live
        weightElement.classList.add('text-light');
        setTimeout(() => {
            weightElement.classList.remove('text-light');
            weightElement.classList.add('text-success');
        }, 100);
    }
    
    // Show error in the digital display
    function showErrorInDisplay() {
        const digitalDisplay = document.getElementById(containerDisplayId);
        if (digitalDisplay) {
            digitalDisplay.innerHTML = `
                <div class="alert alert-danger py-2 mb-0">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    Error connecting to weight scale
                </div>
            `;
        }
    }
    
    // Get the last recorded weight value
    function getLastWeight() {
        return lastWeight;
    }
    
    // Public API
    return {
        init: init,
        getLastWeight: getLastWeight
    };
})();