from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    rfid_card = db.Column(db.String(50), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    tickets = db.relationship('WeightTicket', backref='customer', lazy=True)

class WeightTicket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    gross_weight = db.Column(db.Float)
    tare_weight = db.Column(db.Float)
    net_weight = db.Column(db.Float)
    status = db.Column(db.String(20), default='open')  # 'open' or 'closed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    closed_at = db.Column(db.DateTime)

    def close_ticket(self, tare_weight):
        self.tare_weight = tare_weight
        self.net_weight = self.gross_weight - self.tare_weight
        self.status = 'closed'
        self.closed_at = datetime.utcnow()