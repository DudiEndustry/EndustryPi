from flask import Flask, render_template, request, jsonify
from models import db, Customer, WeightTicket
from rfid_reader import RFIDReader
from printer import TicketPrinter
import threading
import queue
import random  # Temporary for weight simulation
from werkzeug.exceptions import HTTPException
import traceback
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///weight_system.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Initialize RFID reader and printer
rfid_reader = RFIDReader()
printer = TicketPrinter()
rfid_queue = queue.Queue()

def rfid_callback(card_id):
    rfid_queue.put(card_id)

@app.errorhandler(Exception)
def handle_error(error):
    code = 500
    if isinstance(error, HTTPException):
        code = error.code
    
    # Only return JSON for API routes
    if request.path.startswith('/api/'):
        return jsonify(error=str(error)), code
    
    # For non-API routes, render an error template or return the default Werkzeug error page
    # Re-raising the error here causes the 500 Internal Server Error for 404s etc.
    # Instead, let Werkzeug handle it or render a custom error page
    # For now, let's return the error directly, which Werkzeug should handle
    return error

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/customers')
def customers():
    customers_list = Customer.query.all()
    return render_template('customers.html', customers=customers_list)

@app.route('/tickets')
def tickets():
    tickets_list = WeightTicket.query.all()
    customers_list = Customer.query.all()  # Added for manual ticket creation
    return render_template('tickets.html', tickets=tickets_list, customers=customers_list)

@app.route('/api/weight/read')
def read_weight():
    try:
        # TODO: Replace with actual weight reading from hardware
        # This is just a simulation for testing
        weight = random.uniform(3000, 4500)
        return jsonify({"weight": weight})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/customers', methods=['POST'])
def add_customer():
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        data = request.json
        if not data.get('name') or not data.get('rfid_card'):
            return jsonify({"error": "Name and RFID card are required"}), 400
            
        customer = Customer(name=data['name'], rfid_card=data['rfid_card'])
        db.session.add(customer)
        db.session.commit()
        return jsonify({"id": customer.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/rfid/read')
def read_rfid():
    try:
        card_id = rfid_queue.get_nowait()
        return jsonify({"card_id": card_id})
    except queue.Empty:
        return jsonify({"card_id": None})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tickets', methods=['POST'])
def create_ticket():
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        data = request.json
        if not data.get('rfid_card') or 'gross_weight' not in data:
            return jsonify({"error": "RFID card and gross weight are required"}), 400
            
        customer = Customer.query.filter_by(rfid_card=data['rfid_card']).first()
        if not customer:
            return jsonify({"error": "Customer not found"}), 404
        
        ticket = WeightTicket(
            customer_id=customer.id,
            gross_weight=data['gross_weight']
        )
        db.session.add(ticket)
        db.session.commit()
        return jsonify({"id": ticket.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>/close', methods=['POST'])
def close_ticket(ticket_id):
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        data = request.json
        if 'tare_weight' not in data:
            return jsonify({"error": "Tare weight is required"}), 400
            
        ticket = WeightTicket.query.get_or_404(ticket_id)
        
        if ticket.status != 'open':
            return jsonify({"error": "Ticket is not open"}), 400
        
        ticket.close_ticket(data['tare_weight'])
        db.session.commit()
        
        # Print ticket
        ticket_data = {
            'id': ticket.id,
            'customer_name': ticket.customer.name,
            'gross_weight': ticket.gross_weight,
            'tare_weight': ticket.tare_weight,
            'net_weight': ticket.net_weight
        }
        printer.print_ticket(ticket_data)
        
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/customers/<int:customer_id>/print-label', methods=['POST'])
def print_customer_label(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        
        # Print customer label
        customer_data = {
            'id': customer.id,
            'name': customer.name,
            'rfid_card': customer.rfid_card
        }
        printer.print_customer_label(customer_data)
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/customers/<int:customer_id>/tickets', methods=['GET'])
def get_customer_tickets(customer_id):
    try:
        # Get date range from query parameters
        date_from = request.args.get('from', None)
        date_to = request.args.get('to', None)
        
        # Parse dates if provided
        from_date = None
        to_date = None
        
        if date_from:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
            except ValueError:
                return jsonify({"error": "Invalid 'from' date format. Use YYYY-MM-DD"}), 400
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                # Set to end of day
                to_date = to_date + timedelta(days=1, microseconds=-1)
            except ValueError:
                return jsonify({"error": "Invalid 'to' date format. Use YYYY-MM-DD"}), 400
        
        # Query for tickets with optional date filtering
        query = WeightTicket.query.filter_by(customer_id=customer_id)
        
        if from_date:
            query = query.filter(WeightTicket.created_at >= from_date)
        
        if to_date:
            query = query.filter(WeightTicket.created_at <= to_date)
        
        # Order by most recent first
        tickets = query.order_by(WeightTicket.created_at.desc()).all()
        
        # Format tickets for JSON response
        ticket_list = []
        for ticket in tickets:
            ticket_dict = {
                'id': ticket.id,
                'gross_weight': ticket.gross_weight,
                'tare_weight': ticket.tare_weight,
                'net_weight': ticket.net_weight,
                'status': ticket.status,
                'created_at': ticket.created_at.isoformat(),
                'closed_at': ticket.closed_at.isoformat() if ticket.closed_at else None
            }
            ticket_list.append(ticket_dict)
            
        return jsonify(ticket_list)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>/print', methods=['POST'])
def print_ticket_receipt_api(ticket_id):
    try:
        ticket = WeightTicket.query.get_or_404(ticket_id)
        
        if ticket.status != 'closed':
            return jsonify({"error": "Cannot print receipt for an open ticket"}), 400
            
        ticket_data = {
            'id': ticket.id,
            'customer_name': ticket.customer.name,
            'gross_weight': ticket.gross_weight,
            'tare_weight': ticket.tare_weight,
            'net_weight': ticket.net_weight,
            # Add date/time if needed by the printer function
            'closed_at': ticket.closed_at 
        }
        printer.print_ticket(ticket_data)
        
        return jsonify({"success": True, "message": f"Ticket #{ticket_id} sent to printer."})
    except Exception as e:
        # Log the detailed error
        traceback.print_exc() 
        return jsonify({"error": str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>', methods=['DELETE'])
def delete_ticket_api(ticket_id):
    try:
        ticket = WeightTicket.query.get_or_404(ticket_id)
        
        # Optional: Add checks here, e.g., only allow deleting closed tickets
        # if ticket.status == 'open':
        #     return jsonify({"error": "Cannot delete an open ticket"}), 400

        db.session.delete(ticket)
        db.session.commit()
        
        return jsonify({"success": True, "message": f"Ticket #{ticket_id} deleted successfully."})
    except Exception as e:
        db.session.rollback()
        # Log the detailed error
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    rfid_reader.start(rfid_callback)
    app.run(host='0.0.0.0', port=5000)