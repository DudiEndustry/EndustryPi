/**
 * Ticket Manager module for handling ticket operations
 */
const TicketManager = (function() {
    // Private variables
    let isProcessing = false;
    
    // Show feedback in the card action message
    function updateCardActionMessage(message, isSuccess = true) {
        const messageElement = document.getElementById('cardActionMessage');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.parentElement.className = isSuccess ? 
                'alert alert-info py-2 mb-0' : 'alert alert-danger py-2 mb-0';
        }
    }
    
    // Show a loading spinner in the given element
    function setLoadingState(elementId, isLoading) {
        if (UIControls && typeof UIControls.toggleLoadingState === 'function') {
            UIControls.toggleLoadingState(elementId, isLoading);
        }
    }
    
    // Create a new ticket
    async function createTicket(rfidCard, weight) {
        if (isProcessing) return;
        isProcessing = true;
        
        try {
            updateCardActionMessage('Creating new ticket...', true);
            
            const response = await fetch('/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    rfid_card: rfidCard,
                    gross_weight: weight
                })
            });
            
            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const error = await response.json();
                    throw new Error(error.error || 'Error creating ticket');
                } else {
                    throw new Error(`Server error: ${response.status}`);
                }
            }
            
            const data = await response.json();
            
            // Show success message then reload
            updateCardActionMessage(`Ticket #${data.id || 'new'} created successfully!`, true);
            setTimeout(() => {
                location.reload();
            }, 1000);
        } catch (error) {
            console.error('Error:', error);
            updateCardActionMessage(error.message || 'Error creating ticket', false);
        } finally {
            isProcessing = false;
        }
    }

    // Close an existing ticket
    async function closeTicket(ticketId, tareWeight) {
        if (isProcessing) return;
        isProcessing = true;
        
        try {
            updateCardActionMessage(`Closing ticket #${ticketId}...`, true);
            
            const response = await fetch(`/api/tickets/${ticketId}/close`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    tare_weight: tareWeight
                })
            });
            
            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const error = await response.json();
                    throw new Error(error.error || 'Error closing ticket');
                } else {
                    throw new Error(`Server error: ${response.status}`);
                }
            }

            const data = await response.json();
            
            // Show success message then reload
            updateCardActionMessage(`Ticket #${ticketId} closed successfully!`, true);
            setTimeout(() => {
                location.reload();
            }, 1000);
        } catch (error) {
            console.error('Error:', error);
            updateCardActionMessage(error.message || 'Error closing ticket', false);
        } finally {
            isProcessing = false;
        }
    }

    // Delete a ticket
    async function deleteTicket(ticketId) {
        setLoadingState('confirmDeleteBtn', true);
        
        try {
            const response = await fetch(`/api/tickets/${ticketId}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            const data = await response.json(); // Try to parse JSON regardless of status

            if (!response.ok) {
                throw new Error(data.error || `Server error: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('Error:', error);
            if (UIControls && typeof UIControls.showAlert === 'function') {
                UIControls.showAlert(error.message || 'Error deleting ticket', 'danger');
            } else {
                alert(error.message || 'Error deleting ticket');
            }
            return false;
        } finally {
            setLoadingState('confirmDeleteBtn', false);
        }
    }

    // Print a ticket receipt
    async function printReceipt(ticketId) {
        try {
            if (UIControls && typeof UIControls.showAlert === 'function') {
                UIControls.showAlert('Sending print job...', 'info', 1000);
            }
            
            const response = await fetch(`/api/tickets/${ticketId}/print`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Error printing ticket: ${response.status}`);
            }
            
            if (UIControls && typeof UIControls.showAlert === 'function') {
                UIControls.showAlert(data.message || `Ticket #${ticketId} printed successfully`, 'success');
            } else {
                alert(data.message || `Ticket #${ticketId} printed successfully`);
            }
            
            return true;
        } catch (error) {
            console.error('Error:', error);
            if (UIControls && typeof UIControls.showAlert === 'function') {
                UIControls.showAlert(error.message || 'Error printing ticket', 'danger');
            } else {
                alert(error.message || 'Error printing ticket');
            }
            return false;
        }
    }

    // Handle RFID scan and process ticket accordingly
    async function handleRfidScan(cardId, weight) {
        try {
            updateCardActionMessage('Processing card...', true);
            
            if (!cardId) {
                throw new Error('Invalid card ID');
            }
            
            if (isNaN(weight) || weight <= 0) {
                throw new Error('Invalid weight reading. Please check the scale.');
            }
            
            // Check if there's an open ticket for this card
            const openTicket = document.querySelector(`.ticket-card[data-customer-rfid="${cardId}"]`);
            
            if (openTicket) {
                // Close the existing ticket
                const ticketId = openTicket.dataset.ticketId;
                await closeTicket(ticketId, weight);
            } else {
                // Create a new ticket
                await createTicket(cardId, weight);
            }
        } catch (error) {
            console.error('Error:', error);
            updateCardActionMessage(error.message || 'Error processing ticket', false);
        }
    }
    
    // Get the open ticket for a card if it exists
    function getOpenTicketForCard(cardId) {
        if (!cardId) return null;
        
        const openTicket = document.querySelector(`.ticket-card[data-customer-rfid="${cardId}"]`);
        if (openTicket) {
            return {
                id: openTicket.dataset.ticketId,
                element: openTicket
            };
        }
        
        return null;
    }
    
    // Highlight an open ticket
    function highlightOpenTicket(ticketId) {
        if (!ticketId) return;
        
        // Remove highlight from all tickets
        document.querySelectorAll('.ticket-card').forEach(card => {
            card.classList.remove('border-primary');
            card.classList.remove('shadow');
        });
        
        // Add highlight to the specified ticket
        const ticket = document.querySelector(`.ticket-card[data-ticket-id="${ticketId}"]`);
        if (ticket) {
            ticket.classList.add('border-primary');
            ticket.classList.add('shadow');
            
            // Scroll the ticket into view if needed
            ticket.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // Public API
    return {
        createTicket: createTicket,
        closeTicket: closeTicket,
        deleteTicket: deleteTicket,
        printReceipt: printReceipt,
        handleRfidScan: handleRfidScan,
        getOpenTicketForCard: getOpenTicketForCard,
        highlightOpenTicket: highlightOpenTicket
    };
})();