from database import db
from datetime import datetime, timezone

class Poll(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question = db.Column(db.String(255), nullable=False)
    # Added the createdAt requirement here:
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    options = db.relationship('Option', backref='poll', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "question": self.question,
            "options": [opt.to_dict() for opt in self.options],
            "totalVotes": sum(opt.votes for opt in self.options),
            "createdAt": self.created_at.isoformat() # Convert to string for JSON
        }

class Option(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(100), nullable=False)
    votes = db.Column(db.Integer, default=0)
    poll_id = db.Column(db.Integer, db.ForeignKey('poll.id'), nullable=False)

    def to_dict(self):
        return {"id": self.id, "text": self.text, "votes": self.votes}