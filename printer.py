import cups
from datetime import datetime
import tempfile
import os

# ESC/POS Command Constants
ESC = b'\x1B'
GS = b'\x1D'
LF = b'\n'

# Initialize Printer
INIT_PRINTER = ESC + b'@'
# Alignment
ALIGN_LEFT = ESC + b'a\x00'
ALIGN_CENTER = ESC + b'a\x01'
ALIGN_RIGHT = ESC + b'a\x02'
# Text Formatting
TXT_NORMAL = ESC + b'!\x00'
TXT_BOLD = ESC + b'!\x08' # Or ESC E 1
TXT_2HEIGHT = ESC + b'!\x10'
TXT_2WIDTH = ESC + b'!\x20'
TXT_UNDERLINE = ESC + b'!\x80' # Or ESC - 1
# Cut Paper
PAPER_FULL_CUT = GS + b'V\x00'
PAPER_PART_CUT = GS + b'V\x01'
PAPER_FULL_CUT_FEED = GS + b'V\x41' # Cut and feed
# Feed Paper
FEED_LINES = lambda n: ESC + b'd' + bytes([n])
# Code Page Selection (PC864 Arabic = 28 = 0x1C)
CODE_PAGE_PC864 = ESC + b't\x1C'

class TicketPrinter:
    def __init__(self, printer_name="EndustryPrinter"):
        self.printer_name = printer_name
        self.conn = cups.Connection()
        # Define default encoding based on printer spec
        self.encoding = 'cp864' 

    def _print_raw(self, data_bytes, job_title, options):
        try:
            with tempfile.NamedTemporaryFile(mode='wb', delete=False) as f:
                f.write(data_bytes)
                temp_path = f.name
            
            print(f"Printing {job_title} to {self.printer_name} with options: {options}")
            print(f"Raw data (first 100 bytes): {data_bytes[:100]}") # Debug: Show data being sent
            
            self.conn.printFile(self.printer_name, temp_path, job_title, options)
            os.unlink(temp_path)
            print(f"{job_title} sent to printer.")
        except Exception as e:
            print(f"Error printing {job_title}: {e}")
            # Log the full exception for debugging
            import traceback
            traceback.print_exc()
            raise e # Re-raise the exception

    def print_ticket(self, ticket_data):
        try:
            content = bytearray()
            # Initialize, set code page
            content.extend(INIT_PRINTER)
            content.extend(CODE_PAGE_PC864)
            
            # Header
            content.extend(ALIGN_CENTER)
            content.extend(TXT_2HEIGHT + TXT_2WIDTH + TXT_BOLD)
            content.extend(b"WEIGHT TICKET" + LF)
            content.extend(TXT_2HEIGHT + TXT_BOLD)
            content.extend(f"Ticket #{ticket_data['id']}".encode(self.encoding, 'ignore') + LF)
            
            # Info
            content.extend(TXT_NORMAL + TXT_BOLD)
            content.extend(ALIGN_LEFT)
            content.extend(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}".encode(self.encoding, 'ignore') + LF)
            content.extend(f"Customer: {ticket_data['customer_name']}".encode(self.encoding, 'ignore') + LF)
            content.extend(b"-" * 32 + LF) # Adjust width as needed
            
            # Weights
            content.extend(TXT_2HEIGHT + TXT_BOLD) # Make weights prominent
            content.extend(f"Gross: {ticket_data['gross_weight']:.2f} kg".encode(self.encoding, 'ignore') + LF)
            content.extend(f"Tare:  {ticket_data['tare_weight']:.2f} kg".encode(self.encoding, 'ignore') + LF)
            content.extend(f"Net:   {ticket_data['net_weight']:.2f} kg".encode(self.encoding, 'ignore') + LF)
            
            # Footer
            content.extend(TXT_NORMAL + TXT_BOLD)
            content.extend(b"-" * 32 + LF) # Adjust width as needed
            content.extend(ALIGN_CENTER)
            content.extend(b"Thank you!" + LF + LF)
            
            # Feed and Cut
            content.extend(FEED_LINES(5))
            content.extend(PAPER_FULL_CUT) # Use full cut for receipts

            # CUPS options for raw ESC/POS receipt printing (continuous paper)
            options = {
                'raw': 'True',
                # Avoid specifying media for continuous paper unless necessary
                # 'media': '...', 
                'page-left': '0',
                'page-right': '0',
                'page-top': '0',
                'page-bottom': '0',
            }
            self._print_raw(bytes(content), f"Weight Ticket #{ticket_data['id']}", options)
            
        except Exception as e:
            # Error already printed in _print_raw, just log context
            print(f"Failed to generate ticket data for ticket ID {ticket_data.get('id', 'N/A')}")
            # Do not raise again if already handled in _print_raw

    def print_customer_label(self, customer_data):
        try:
            content = bytearray()
            # Initialize, set code page
            content.extend(INIT_PRINTER)
            content.extend(CODE_PAGE_PC864)
            
            # Assuming ESC/POS commands for label format
            # Adjust commands based on desired label appearance
            content.extend(ALIGN_CENTER)
            content.extend(TXT_2HEIGHT + TXT_2WIDTH + TXT_BOLD)
            content.extend(customer_data['name'].encode(self.encoding, 'ignore') + LF)
            
            content.extend(TXT_NORMAL + TXT_BOLD) # Reset to smaller bold font
            content.extend(ALIGN_LEFT)
            content.extend(f"ID: {customer_data['id']}".encode(self.encoding, 'ignore') + LF)
            content.extend(f"Card: {customer_data['rfid_card']}".encode(self.encoding, 'ignore') + LF)
            
            # Feed to space out before cut (adjust as needed for label size)
            content.extend(FEED_LINES(3)) 
            # Use cut command appropriate for labels (might be same as receipt)
            content.extend(PAPER_FULL_CUT_FEED) # Cut and feed might position next label

            # CUPS options for raw ESC/POS label printing
            options = {
                'raw': 'True',
                'media': 'custom_3x2in_3x2in', # Specify label size
                'page-left': '0',
                'page-right': '0',
                'page-top': '0',
                'page-bottom': '0',
            }
            self._print_raw(bytes(content), f"Customer Label {customer_data['id']}", options)

        except Exception as e:
            # Error already printed in _print_raw, just log context
            print(f"Failed to generate label data for customer ID {customer_data.get('id', 'N/A')}")
            # Do not raise again if already handled in _print_raw