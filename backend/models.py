from database import db
from datetime import datetime, timezone

class Poll(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question = db.Column(db.String(255), nullable=False)
    # Added the createdAt requirement here:
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    total_votes = db.Column(db.Integer, default=0, nullable=False)
    
    # Add indexes for performance
    __table_args__ = (
        db.Index('idx_poll_created_at', 'created_at'),
        db.Index('idx_poll_total_votes', 'total_votes'),
        db.Index('idx_poll_active', 'is_active'),
    )
    
    options = db.relationship('Option', backref='poll', cascade="all, delete-orphan", lazy='joined')

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
    
    # Add index for performance
    __table_args__ = (
        db.Index('idx_option_poll_id', 'poll_id'),
    )

    def to_dict(self):
        return {"id": self.id, "text": self.text, "votes": self.votes}

class Vote(db.Model):
    """Track individual votes for rate limiting and integrity"""
    id = db.Column(db.Integer, primary_key=True)
    poll_id = db.Column(db.Integer, db.ForeignKey('poll.id'), nullable=False)
    option_id = db.Column(db.Integer, db.ForeignKey('option.id'), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)  # IPv6 compatible
    user_agent = db.Column(db.String(500))
    voted_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Add indexes for performance
    __table_args__ = (
        db.Index('idx_vote_poll_ip', 'poll_id', 'ip_address'),
        db.Index('idx_vote_ip_time', 'ip_address', 'voted_at'),
        db.UniqueConstraint('poll_id', 'ip_address', name='unique_poll_ip_vote'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "poll_id": self.poll_id,
            "option_id": self.option_id,
            "voted_at": self.voted_at.isoformat()
        }