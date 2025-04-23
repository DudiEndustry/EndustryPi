import cups
from datetime import datetime

class TicketPrinter:
    def __init__(self, printer_name="PiPrinter"):
        self.printer_name = printer_name
        self.conn = cups.Connection()

    def print_ticket(self, ticket_data):
        try:
            # Format ticket content for 2x3 inch thermal paper
            content = []
            content.append("\x1B\x40")  # Initialize printer
            content.append("\x1B\x61\x01")  # Center alignment
            content.append("WEIGHT TICKET")
            content.append("\x1B\x61\x00")  # Left alignment
            content.append(f"\nTicket #: {ticket_data['id']}")
            content.append(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            content.append(f"Customer: {ticket_data['customer_name']}")
            content.append("-" * 24)  # Narrower separator for thermal paper
            content.append(f"Gross: {ticket_data['gross_weight']:.2f} kg")
            content.append(f"Tare:  {ticket_data['tare_weight']:.2f} kg")
            content.append(f"Net:   {ticket_data['net_weight']:.2f} kg")
            content.append("-" * 24)
            content.append("\x1B\x61\x01")  # Center alignment
            content.append("Thank you!")
            content.append("\n\n\n")  # Paper feed
            content.append("\x1B\x69")  # Cut paper
            
            # Create temporary file with content
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
                f.write('\n'.join(content))
                temp_path = f.name

            # Print using CUPS with specific options for thermal receipt
            options = {
                'media': 'custom_2x3in_2x3in',
                'fit-to-page': 'True',
                'page-left': '0',
                'page-right': '0',
                'page-top': '0',
                'page-bottom': '0'
            }
            self.conn.printFile(self.printer_name, temp_path, "Weight Ticket", options)
            
            # Clean up temp file
            import os
            os.unlink(temp_path)
            
        except Exception as e:
            print(f"Error printing ticket: {e}")
            raise e

    def print_customer_label(self, customer_data):
        try:
            # Format label content for 2x3 inch label
            content = []
            content.append("\x1B\x40")  # Initialize printer
            content.append("\x1B\x61\x01")  # Center alignment
            content.append("RFID CARD")
            content.append("\x1B\x61\x00")  # Left alignment
            content.append(f"\nID: {customer_data['id']}")
            content.append(f"Name: {customer_data['name']}")
            content.append(f"Card: {customer_data['rfid_card']}")
            content.append("\x1B\x69")  # Cut paper
            
            # Create temporary file with content
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
                f.write('\n'.join(content))
                temp_path = f.name

            # Print using CUPS with specific options for label
            options = {
                'media': 'custom_2x3in_2x3in',
                'fit-to-page': 'True',
                'page-left': '0',
                'page-right': '0',
                'page-top': '0',
                'page-bottom': '0'
            }
            self.conn.printFile(self.printer_name, temp_path, "Customer Label", options)
            
            # Clean up temp file
            import os
            os.unlink(temp_path)
            
        except Exception as e:
            print(f"Error printing label: {e}")
            raise e