from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_caching import Cache
from flask_compress import Compress
from flask_wtf.csrf import CSRFProtect
from models import db, Poll, Option, Vote
from database import db, init_db
import os
import bleach
from sqlalchemy import func, desc, text

app = Flask(__name__)

# Configuration
app.config['CACHE_TYPE'] = 'simple'  # Simple in-memory cache
app.config['CACHE_DEFAULT_TIMEOUT'] = 60  # Cache timeout in seconds
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Initialize CSRF protection
csrf = CSRFProtect(app)

# Exempt API endpoints from CSRF protection since they use JSON
csrf.exempt('/api/polls')
csrf.exempt('/api/polls/<int:poll_id>/vote')
csrf.exempt('/api/polls/<int:poll_id>')
csrf.exempt('/api/polls/<int:poll_id>/results')
csrf.exempt('/api/polls/stats')
csrf.exempt('/api/health')

# Initialize extensions
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:5173", 
    "http://localhost:3000",
    "https://poll-master-v2-frontend.onrender.com"
]}})

# Enable compression for faster responses
Compress(app)

# Initialize cache
cache = Cache(app)

# Initialize database
init_db(app)

# Helper function to add pagination info
def paginate(query, page, per_page):
    """Helper to paginate SQLAlchemy queries"""
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        'items': paginated.items,
        'total': paginated.total,
        'page': page,
        'per_page': per_page,
        'pages': paginated.pages,
        'has_next': paginated.has_next,
        'has_prev': paginated.has_prev
    }

# Helper functions for consistent API responses
def success_response(data=None, message=None, status_code=200):
    """Return a standardized success response"""
    response_data = {'success': True}
    if data is not None:
        response_data['data'] = data
    if message:
        response_data['message'] = message
    return jsonify(response_data), status_code

def error_response(message, status_code=400, error_code=None):
    """Return a standardized error response"""
    response_data = {'success': False, 'error': message}
    if error_code:
        response_data['error_code'] = error_code
    return jsonify(response_data), status_code

# --- OPTIMIZED API ENDPOINTS ---

@app.route('/api/csrf-token', methods=['GET'])
def get_csrf_token():
    """Provide CSRF token for frontend"""
    try:
        return success_response({'csrf_token': csrf.generate_token()})
    except Exception as e:
        app.logger.error(f"Error generating CSRF token: {str(e)}")
        return error_response('Failed to generate CSRF token', 500)

@app.route('/api/polls', methods=['GET'])
@cache.cached(timeout=30, query_string=True)  # Cache for 30 seconds, vary by query params
def get_polls():
    """Get all polls with pagination and optimized queries"""
    try:
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        sort = request.args.get('sort', 'newest')  # newest, popular, oldest
        
        # Base query
        query = Poll.query.filter_by(is_active=True)
        
        # Apply sorting
        if sort == 'newest':
            query = query.order_by(desc(Poll.created_at))
        elif sort == 'oldest':
            query = query.order_by(Poll.created_at)
        elif sort == 'popular':
            query = query.order_by(desc(Poll.total_votes))
        
        # Paginate results
        paginated_polls = paginate(query, page, per_page)
        
        # Convert to dict with eager loading of options
        polls_dict = []
        for poll in paginated_polls['items']:
            poll_data = poll.to_dict()
            # Ensure options are loaded
            if not poll_data.get('options'):
                poll_data['options'] = [opt.to_dict() for opt in poll.options]
            polls_dict.append(poll_data)
        
        return success_response({
            'polls': polls_dict,
            'pagination': {
                'current_page': paginated_polls['page'],
                'per_page': paginated_polls['per_page'],
                'total': paginated_polls['total'],
                'total_pages': paginated_polls['pages'],
                'has_next': paginated_polls['has_next'],
                'has_prev': paginated_polls['has_prev']
            }
        })
        
    except Exception as e:
        app.logger.error(f"Error fetching polls: {str(e)}")
        return error_response('Failed to fetch polls', 500)

@app.route('/api/polls', methods=['POST'])
def create_poll():
    """Create a new poll with validation"""
    try:
        data = request.json
        
        # Enhanced validation and sanitization
        if not data.get('question'):
            return error_response('Question is required')
        
        # Sanitize and validate question
        question = bleach.clean(data['question'].strip(), tags=[], strip=True)
        if len(question) > 200:
            return error_response('Question must be less than 200 characters')
        if not question:
            return error_response('Question cannot be empty after sanitization')
        
        options = data.get('options', [])
        if len(options) < 2:
            return error_response('At least 2 options are required')
        if len(options) > 4:
            return error_response('Maximum 4 options allowed')
        
        # Validate and sanitize options
        sanitized_options = []
        for opt_text in options:
            if not opt_text or not opt_text.strip():
                return error_response('Options cannot be empty')
            
            sanitized_text = bleach.clean(opt_text.strip(), tags=[], strip=True)
            if len(sanitized_text) > 100:
                return error_response('Each option must be less than 100 characters')
            if not sanitized_text:
                return error_response('Option cannot be empty after sanitization')
            
            sanitized_options.append(sanitized_text)
        
        # Create new poll with sanitized data
        new_poll = Poll(question=question)
        for opt_text in sanitized_options:
            new_option = Option(text=opt_text)
            new_poll.options.append(new_option)
        
        db.session.add(new_poll)
        db.session.commit()
        
        # Clear targeted cache entries after creating new poll
        cache.delete('view:/api/polls')
        cache.delete('view:/api/polls/stats')
        
        return success_response(new_poll.to_dict(), 'Poll created successfully', 201)
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error creating poll: {str(e)}")
        return error_response('Failed to create poll', 500)

@app.route('/api/polls/<int:poll_id>/vote', methods=['POST'])
def vote(poll_id):
    """Vote on a poll option with server-side tracking and rate limiting"""
    try:
        data = request.json
        option_id = data.get('optionId')
        
        if not option_id:
            return error_response('Option ID is required')
        
        # Get client IP for rate limiting
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))
        if client_ip and ',' in client_ip:
            client_ip = client_ip.split(',')[0].strip()  # Take first IP in list
        
        if not client_ip:
            return error_response('Unable to determine client IP')
        
        # Check if this IP has already voted on this poll
        existing_vote = Vote.query.filter_by(poll_id=poll_id, ip_address=client_ip).first()
        if existing_vote:
            return error_response('You have already voted on this poll', 429)
        
        # Find the option and verify it belongs to the poll
        option = Option.query.filter_by(id=option_id, poll_id=poll_id).first()
        if not option:
            return error_response('Option not found', 404)
        
        # Verify poll is active
        poll = Poll.query.get(poll_id)
        if not poll or not poll.is_active:
            return error_response('Poll not found or inactive', 404)
        
        # Atomic vote recording
        try:
            # Create vote record
            vote_record = Vote(
                poll_id=poll_id,
                option_id=option_id,
                ip_address=client_ip,
                user_agent=request.headers.get('User-Agent', '')[:500]
            )
            db.session.add(vote_record)
            
            # Update option votes atomically
            option.votes = Option.votes + 1
            
            # Update poll total votes atomically
            poll.total_votes = Poll.total_votes + 1
            
            db.session.commit()
            
        except Exception as db_error:
            db.session.rollback()
            app.logger.error(f"Database error during vote: {str(db_error)}")
            return error_response('Failed to record vote', 500)
        
        # Clear cache for this poll
        cache.delete_memoized(get_poll_results, poll_id)
        cache.delete(f'api/polls/{poll_id}/results')
        
        # Return updated poll data
        return success_response(poll.to_dict(), 'Vote recorded successfully')
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error voting: {str(e)}")
        return error_response('Failed to record vote', 500)

@app.route('/api/polls/<int:poll_id>', methods=['DELETE'])
def delete_poll(poll_id):
    """Delete a poll"""
    try:
        poll = Poll.query.get_or_404(poll_id)
        
        # Soft delete instead of hard delete (optional - keeps data for analytics)
        poll.is_active = False
        
        db.session.commit()
        
        # Clear targeted cache entries
        cache.delete('view:/api/polls')
        cache.delete('view:/api/polls/stats')
        cache.delete_memoized(get_poll_results, poll_id)
        cache.delete(f'api/polls/{poll_id}/results')
        
        return success_response(None, 'Poll deleted successfully')
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting poll: {str(e)}")
        return error_response('Failed to delete poll', 500)

@app.route('/api/polls/<int:poll_id>/results', methods=['GET'])
@cache.cached(timeout=60, key_prefix=lambda: f'api/polls/{poll_id}/results')
def get_poll_results(poll_id):  # Make sure poll_id is in the function parameters
    """Get detailed results for a specific poll"""
    try:
        poll = Poll.query.get_or_404(poll_id)
        
        # Calculate total votes if not stored
        total_votes = poll.total_votes
        if total_votes == 0:
            total_votes = sum(opt.votes for opt in poll.options)
        
        # Structure results as requested
        return success_response({
            "question": poll.question,
            "totalVotes": total_votes,
            "results": [
                {
                    "option": opt.text,
                    "votes": opt.votes,
                    "percentage": round((opt.votes / total_votes * 100), 1) if total_votes > 0 else 0
                } for opt in poll.options
            ]
        })
        
    except Exception as e:
        app.logger.error(f"Error fetching results: {str(e)}")
        return error_response('Failed to fetch results', 500)

@app.route('/api/polls/stats', methods=['GET'])
@cache.cached(timeout=300)  # Cache for 5 minutes
def get_stats():
    """Get global statistics about polls"""
    try:
        total_polls = Poll.query.filter_by(is_active=True).count()
        total_votes = db.session.query(func.sum(Option.votes)).scalar() or 0
        most_popular_poll = Poll.query.filter_by(is_active=True).order_by(desc(Poll.total_votes)).first()
        
        return success_response({
            "total_polls": total_polls,
            "total_votes": total_votes,
            "most_popular_poll": most_popular_poll.to_dict() if most_popular_poll else None
        })
        
    except Exception as e:
        app.logger.error(f"Error fetching stats: {str(e)}")
        return error_response('Failed to fetch stats', 500)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Test database connection
        db.session.execute(text('SELECT 1'))
        return success_response({
            "status": "healthy",
            "database": "connected",
            "cache": "active"
        })
    except Exception as e:
        return error_response(str(e), 500)

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return error_response('Resource not found', 404)

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return error_response('Internal server error', 500)

# Performance middleware to add response headers
@app.after_request
def add_performance_headers(response):
    """Add caching headers for better performance"""
    if request.method == 'GET':
        response.headers['Cache-Control'] = 'public, max-age=30'
        response.headers['X-Content-Type-Options'] = 'nosniff'
    return response

if __name__ == '__main__':
    # Get port from environment variable (Render uses PORT)
    port = int(os.environ.get("PORT", 10000))
    
    # Enable debug mode only in development
    debug = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    
    # Run the app
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        threaded=True  # Handle multiple requests efficiently
    )