import datetime
import re
from flask import request, jsonify, session
import database
from routes.utils import is_logged_in

def register_chat_routes(app):
    @app.route('/api/chat', methods=['POST'])
    def chatbot_api():
        if not is_logged_in():
            return jsonify({'error': 'Unauthorized'}), 401
            
        payload = request.get_json()
        if not payload or 'message' not in payload:
            return jsonify({'error': 'No message provided.'}), 400
            
        user_msg = payload['message'].strip()
        user_msg_lower = user_msg.lower()
        user_id = session['user_id']
        
        # Get active currency symbol
        currency = database.get_active_currency() or {'symbol': '₹'}
        symbol = currency.get('symbol', '₹')
        
        # Establish target month and year
        now = datetime.datetime.now()
        month = f"{now.month:02d}"
        year = str(now.year)
        month_label = now.strftime("%B %Y")
        
        # Check if the query asks for "last month" or "previous month"
        if re.search(r'\b(last|previous|past)\s+month\b', user_msg_lower):
            first_of_this_month = now.replace(day=1)
            last_month_dt = first_of_this_month - datetime.timedelta(days=1)
            month = f"{last_month_dt.month:02d}"
            year = str(last_month_dt.year)
            month_label = last_month_dt.strftime("%B %Y")
            
        # Parse query intent
        # 1. Category breakdown
        if re.search(r'\b(category|categories|breakdown|where did i spend)\b', user_msg_lower):
            expenses = database.get_expenses(user_id, month=month, year=year)
            if not expenses:
                return jsonify({'reply': f"You don't have any expenses recorded for **{month_label}** yet!"})
            
            breakdown = {}
            for e in expenses:
                cat = e['category']
                breakdown[cat] = breakdown.get(cat, 0.0) + float(e['amount'])
                
            sorted_b = sorted(breakdown.items(), key=lambda x: x[1], reverse=True)
            
            reply = f"Here is your category breakdown for **{month_label}**:\n\n"
            for cat, amt in sorted_b:
                reply += f"- **{cat}**: {symbol}{amt:,.2f}\n"
            return jsonify({'reply': reply})
            
        # 2. Total credit card spent
        elif re.search(r'\bcredit\b', user_msg_lower):
            expenses = database.get_expenses(user_id, month=month, year=year, payment_method='Credit')
            total = sum(float(e['amount']) for e in expenses)
            return jsonify({'reply': f"Your total credit spending for **{month_label}** is **{symbol}{total:,.2f}** (across {len(expenses)} transactions)."})
            
        # 3. Total debit spent
        elif re.search(r'\bdebit\b', user_msg_lower):
            expenses = database.get_expenses(user_id, month=month, year=year, payment_method='Debit')
            total = sum(float(e['amount']) for e in expenses)
            return jsonify({'reply': f"Your total debit spending for **{month_label}** is **{symbol}{total:,.2f}** (across {len(expenses)} transactions)."})
            
        # 4. Total spent (expenses)
        elif re.search(r'\b(total spent|total amount spent|how much did i spend|total expense|total expenses)\b', user_msg_lower) or 'spent' in user_msg_lower or 'expense' in user_msg_lower:
            expenses = database.get_expenses(user_id, month=month, year=year)
            total = sum(float(e['amount']) for e in expenses)
            return jsonify({'reply': f"Your total spending for **{month_label}** is **{symbol}{total:,.2f}** (across {len(expenses)} transactions)."})
            
        # 5. Greeting / Help
        elif any(word in user_msg_lower for word in ['hi', 'hello', 'hey', 'help', 'chatbot', 'help me', 'who are you']):
            reply = (
                f"Hello! I am your SpendSmart Assistant. I can help you analyze your expense data. "
                f"You can ask me questions like:\n\n"
                f"- *What is the total spent this month?*\n"
                f"- *Total credit card spending this month?*\n"
                f"- *Show my category breakdown this month.*\n"
                f"- *What was my spending last month?*"
            )
            return jsonify({'reply': reply})
            
        # 6. Fallback
        else:
            reply = (
                f"I didn't quite get that. Try asking:\n"
                f"- *'total spent this month'*\n"
                f"- *'credit spent this month'*\n"
                f"- *'category breakdown'*"
            )
            return jsonify({'reply': reply})
