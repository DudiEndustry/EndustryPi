/**
 * UI Controls module for managing the user interface elements
 */
const UIControls = (function() {
    // Private variables
    let alertTimeout = null;
    let activeTab = null;
    
    // Initialize the module
    function init() {
        // Set up tab switching functionality
        setupTabs();
        
        // Set up event listeners for action buttons
        setupEventListeners();
    }
    
    // Set up tab switching functionality
    function setupTabs() {
        const tabs = document.querySelectorAll('.nav-link[data-bs-toggle="tab"]');
        
        tabs.forEach(tab => {
            tab.addEventListener('shown.bs.tab', function(e) {
                activeTab = e.target.id;
                
                // Save the active tab in localStorage for persistence
                localStorage.setItem('activeTab', activeTab);
            });
        });
        
        // Restore active tab from localStorage if available
        const savedTab = localStorage.getItem('activeTab');
        if (savedTab) {
            const tabElement = document.getElementById(savedTab);
            if (tabElement) {
                const tab = new bootstrap.Tab(tabElement);
                tab.show();
            }
        }
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Quick action button events
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', function() {
                const action = this.getAttribute('data-action');
                const params = {};
                
                // Extract data attributes as parameters
                Object.keys(this.dataset).forEach(key => {
                    if (key !== 'action') {
                        params[key] = this.dataset[key];
                    }
                });
                
                handleAction(action, params, this);
            });
        });
        
        // Quick customer select change
        const quickCustomerSelect = document.getElementById('quickCustomerSelect');
        if (quickCustomerSelect) {
            quickCustomerSelect.addEventListener('change', function() {
                const cardId = this.value;
                if (cardId) {
                    const openTicket = TicketManager.getOpenTicketForCard(cardId);
                    if (openTicket) {
                        TicketManager.highlightOpenTicket(openTicket.id);
                    }
                }
            });
        }
    }
    
    // Handle UI actions
    function handleAction(action, params, element) {
        switch (action) {
            case 'print-ticket':
                if (params.ticketId) {
                    toggleLoadingState(element.id, true);
                    TicketManager.printReceipt(params.ticketId)
                        .finally(() => toggleLoadingState(element.id, false));
                }
                break;
                
            case 'delete-ticket':
                if (params.ticketId) {
                    // Show confirmation modal
                    const modal = document.getElementById('deleteConfirmModal');
                    if (modal) {
                        const bsModal = new bootstrap.Modal(modal);
                        
                        // Set ticket ID in confirm button
                        const confirmBtn = document.getElementById('confirmDeleteBtn');
                        if (confirmBtn) {
                            confirmBtn.dataset.ticketId = params.ticketId;
                            
                            // Set up one-time event handler for confirmation
                            confirmBtn.onclick = function() {
                                toggleLoadingState('confirmDeleteBtn', true);
                                TicketManager.deleteTicket(params.ticketId)
                                    .then(success => {
                                        if (success) {
                                            bsModal.hide();
                                            showAlert('Ticket deleted successfully', 'success');
                                            setTimeout(() => location.reload(), 1000);
                                        }
                                    })
                                    .finally(() => toggleLoadingState('confirmDeleteBtn', false));
                            };
                        }
                        
                        bsModal.show();
                    }
                }
                break;
                
            case 'switch-tab':
                if (params.tabId) {
                    switchToTab(params.tabId);
                }
                break;
                
            default:
                console.warn(`Unknown action: ${action}`);
        }
    }
    
    // Switch to a specific tab
    function switchToTab(tabId) {
        const tabElement = document.getElementById(tabId);
        if (tabElement) {
            const tab = new bootstrap.Tab(tabElement);
            tab.show();
        }
    }
    
    // Toggle a loading spinner on an element
    function toggleLoadingState(elementId, isLoading) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const originalContent = element.getAttribute('data-original-content') || element.innerHTML;
        
        if (isLoading) {
            // Save original content
            element.setAttribute('data-original-content', originalContent);
            
            // Add spinner
            element.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
            element.disabled = true;
        } else {
            // Restore original content
            element.innerHTML = originalContent;
            element.disabled = false;
        }
    }
    
    // Show an alert message
    function showAlert(message, type = 'info', duration = 3000) {
        if (!message) return;
        
        // Clear any existing alerts
        clearTimeout(alertTimeout);
        
        // Create or update the alert container
        let alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'alertContainer';
            alertContainer.style.position = 'fixed';
            alertContainer.style.top = '10px';
            alertContainer.style.right = '10px';
            alertContainer.style.zIndex = '9999';
            document.body.appendChild(alertContainer);
        }
        
        // Create the alert element
        const alertEl = document.createElement('div');
        alertEl.className = `alert alert-${type} alert-dismissible fade show`;
        alertEl.role = 'alert';
        alertEl.style.minWidth = '250px';
        alertEl.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        
        alertEl.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add to container
        alertContainer.appendChild(alertEl);
        
        // Set up the Bootstrap alert
        const bsAlert = new bootstrap.Alert(alertEl);
        
        // Auto dismiss after duration
        alertTimeout = setTimeout(() => {
            bsAlert.close();
        }, duration);
        
        // Remove from DOM after hidden
        alertEl.addEventListener('closed.bs.alert', function() {
            alertContainer.removeChild(alertEl);
        });
    }
    
    // Return the public API
    return {
        init: init,
        showAlert: showAlert,
        toggleLoadingState: toggleLoadingState,
        switchToTab: switchToTab
    };
})();

// Initialize UI Controls when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    UIControls.init();
});