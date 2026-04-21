from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, Poll, Option
from database import db, init_db
import os

app = Flask(__name__)

# Use a list of allowed origins for security
CORS(app, resources={r"/*": {"origins": [
    "http://localhost:5173", 
    "https://poll-master-v2-frontend.onrender.com" # Replaced with real frontend URL
]}})

init_db(app)

# --- API ENDPOINTS ---

@app.route('/polls', methods=['GET'])
def get_polls():
    polls = Poll.query.all()
    return jsonify([p.to_dict() for p in polls])

@app.route('/polls', methods=['POST'])
def create_poll():
    data = request.json
    # Validation: 2-4 options required
    if not data.get('question') or len(data.get('options', [])) < 2:
        return jsonify({"error": "Question and at least 2 options required"}), 400
    
    new_poll = Poll(question=data['question'])
    for opt_text in data['options']:
        new_option = Option(text=opt_text)
        new_poll.options.append(new_option)
    
    db.session.add(new_poll)
    db.session.commit()
    return jsonify(new_poll.to_dict()), 201

@app.route('/polls/<int:poll_id>/vote', methods=['POST'])
def vote(poll_id):
    data = request.json
    option_id = data.get('optionId') # Use ID for precision
    
    option = Option.query.filter_by(id=option_id, poll_id=poll_id).first()
    if not option:
        return jsonify({"error": "Option not found"}), 404
    
    option.votes += 1
    db.session.commit()
    
    # Return updated poll results
    poll = Poll.query.get(poll_id)
    return jsonify(poll.to_dict())

@app.route('/polls/<int:poll_id>', methods=['DELETE'])
def delete_poll(poll_id):
    poll = Poll.query.get_or_404(poll_id)
    db.session.delete(poll)
    db.session.commit()
    return jsonify({"message": "Poll deleted successfully"})

@app.route('/polls/<int:poll_id>/results', methods=['GET'])
def get_results(poll_id):
    poll = Poll.query.get_or_404(poll_id)
    
    # Structure exactly as requested in the requirements table
    return jsonify({
        "question": poll.question,
        "totalVotes": poll.totalVotes,
        "results": [
            {
                "option": opt.text,
                "votes": opt.votes,
                "percentage": round((opt.votes / poll.totalVotes * 100), 1) if poll.totalVotes > 0 else 0
            } for opt in poll.options
        ]
    })

if __name__ == '__main__':
    # Render assigns a port, usually 10000. 
    # If not found, it defaults to 5000 for local dev.
    port = int(os.environ.get("PORT", 10000)) 
    app.run(host='0.0.0.0', port=port)