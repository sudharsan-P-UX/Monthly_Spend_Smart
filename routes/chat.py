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
        
        now = datetime.datetime.now()
        this_month_num = f"{now.month:02d}"
        this_year_num = str(now.year)
        this_month_label = now.strftime("%B %Y")
        
        # Check if user specified "last month" or "previous month"
        is_last_month = bool(re.search(r'\b(last|previous|past)\s+month\b', user_msg_lower))
        is_all_time = bool(re.search(r'\b(all\s*time|overall|history|total|every|always)\b', user_msg_lower)) and not is_last_month
        
        if is_last_month:
            first_of_this_month = now.replace(day=1)
            last_month_dt = first_of_this_month - datetime.timedelta(days=1)
            target_month = f"{last_month_dt.month:02d}"
            target_year = str(last_month_dt.year)
            target_label = last_month_dt.strftime("%B %Y")
        else:
            target_month = this_month_num
            target_year = this_year_num
            target_label = this_month_label
            
        # -------------------------------------------------------------
        # INTENT 1: EMI QUERIES (emis, loan, installment, due date)
        # -------------------------------------------------------------
        if re.search(r'\b(emi|emis|loan|loans|installment|installments|due\s*day|due\s*date|pending\s*principal)\b', user_msg_lower):
            emis = database.get_emis(user_id)
            if not emis:
                return jsonify({'reply': "You don't have any active EMIs recorded yet. You can add one from the EMI Menu!"})
                
            total_monthly_emi = sum(float(e.get('emi_amount', 0)) for e in emis)
            total_principal = sum(float(e.get('principal_amount', 0)) for e in emis)
            
            def parse_day(d):
                m = re.search(r'\d+', str(d))
                return int(m.group(0)) if m else 999
            emis_sorted = sorted(emis, key=lambda x: parse_day(x.get('due_date')))
            
            reply = f"📊 **Your EMI Overview** ({len(emis)} Active EMIs):\n\n"
            reply += f"- **Total Monthly EMI**: **{symbol}{total_monthly_emi:,.2f}**\n"
            reply += f"- **Total Loan Principal**: **{symbol}{total_principal:,.2f}**\n\n"
            reply += "**EMI List (Ordered by Due Day):**\n"
            
            for e in emis_sorted:
                name = e.get('name', 'EMI')
                amt = float(e.get('emi_amount', 0))
                due = e.get('due_date', 'N/A')
                p_type = e.get('payment_type', 'Auto')
                tenure = e.get('tenure_months', '-')
                reply += f"• **{name}**: {symbol}{amt:,.2f}/mo | Due Day: **{due}** | Type: **{p_type}** | Tenure: {tenure}m\n"
                
            return jsonify({'reply': reply})

        # -------------------------------------------------------------
        # INTENT 2: HIGHEST / LARGEST EXPENSE
        # -------------------------------------------------------------
        elif re.search(r'\b(highest|largest|biggest|max|maximum|most\s+expensive)\b', user_msg_lower):
            all_exp = database.get_expenses(user_id)
            if not all_exp:
                return jsonify({'reply': "You don't have any expenses recorded yet."})
            max_exp = max(all_exp, key=lambda x: float(x.get('amount', 0)))
            amt = float(max_exp.get('amount', 0))
            cat = max_exp.get('category', 'General')
            desc = max_exp.get('description', '')
            dt = max_exp.get('date', '')
            
            reply = f"🏆 **Highest Single Expense**:\n"
            reply += f"- **Amount**: **{symbol}{amt:,.2f}**\n"
            reply += f"- **Category**: {cat}\n"
            if desc:
                reply += f"- **Description**: {desc}\n"
            reply += f"- **Date**: {dt}"
            return jsonify({'reply': reply})

        # -------------------------------------------------------------
        # INTENT 3: CATEGORY BREAKDOWN / WHERE DID I SPEND
        # -------------------------------------------------------------
        elif re.search(r'\b(category|categories|breakdown|where did i spend)\b', user_msg_lower):
            if is_all_time:
                expenses = database.get_expenses(user_id)
                period_str = "All Time"
            else:
                expenses = database.get_expenses(user_id, month=target_month, year=target_year)
                if not expenses and not is_last_month:
                    expenses = database.get_expenses(user_id)
                    period_str = "All Time (no data for current month)"
                else:
                    period_str = target_label

            if not expenses:
                return jsonify({'reply': f"You don't have any expenses recorded for **{period_str}** yet!"})
            
            breakdown = {}
            for e in expenses:
                cat = e.get('category', 'Uncategorized')
                breakdown[cat] = breakdown.get(cat, 0.0) + float(e.get('amount', 0))
                
            sorted_b = sorted(breakdown.items(), key=lambda x: x[1], reverse=True)
            
            reply = f" Here is your category breakdown for **{period_str}**:\n\n"
            for cat, amt in sorted_b:
                reply += f"- **{cat}**: {symbol}{amt:,.2f}\n"
            return jsonify({'reply': reply})

        # -------------------------------------------------------------
        # INTENT 4: CREDIT CARD SPEND
        # -------------------------------------------------------------
        elif re.search(r'\bcredit\b', user_msg_lower):
            if is_all_time:
                expenses = database.get_expenses(user_id, payment_method='Credit')
                period_str = "All Time"
            else:
                expenses = database.get_expenses(user_id, month=target_month, year=target_year, payment_method='Credit')
                if not expenses and not is_last_month:
                    expenses = database.get_expenses(user_id, payment_method='Credit')
                    period_str = "All Time"
                else:
                    period_str = target_label
                    
            total = sum(float(e.get('amount', 0)) for e in expenses)
            return jsonify({'reply': f"💳 Your total credit card spending for **{period_str}** is **{symbol}{total:,.2f}** (across {len(expenses)} transactions)."})

        # -------------------------------------------------------------
        # INTENT 5: DEBIT CARD SPEND
        # -------------------------------------------------------------
        elif re.search(r'\bdebit\b', user_msg_lower):
            if is_all_time:
                expenses = database.get_expenses(user_id, payment_method='Debit')
                period_str = "All Time"
            else:
                expenses = database.get_expenses(user_id, month=target_month, year=target_year, payment_method='Debit')
                if not expenses and not is_last_month:
                    expenses = database.get_expenses(user_id, payment_method='Debit')
                    period_str = "All Time"
                else:
                    period_str = target_label
                    
            total = sum(float(e.get('amount', 0)) for e in expenses)
            return jsonify({'reply': f"🏦 Your total debit spending for **{period_str}** is **{symbol}{total:,.2f}** (across {len(expenses)} transactions)."})

        # -------------------------------------------------------------
        # INTENT 6: SUMMARY / OVERVIEW
        # -------------------------------------------------------------
        elif re.search(r'\b(summary|overview|status|dashboard|finances|health)\b', user_msg_lower):
            all_exp = database.get_expenses(user_id)
            emis = database.get_emis(user_id)
            total_exp = sum(float(e.get('amount', 0)) for e in all_exp)
            total_emi = sum(float(e.get('emi_amount', 0)) for e in emis)
            
            reply = f"📋 **Overall Financial Summary**:\n\n"
            reply += f"- **Total Expenses Recorded**: **{symbol}{total_exp:,.2f}** ({len(all_exp)} entries)\n"
            reply += f"- **Active EMIs**: **{len(emis)}** (Monthly EMI: **{symbol}{total_emi:,.2f}**)\n\n"
            reply += "Ask me specific details anytime! e.g., *'Show category breakdown'*, *'What are my EMIs?'*, or *'Credit spent'*"
            return jsonify({'reply': reply})

        # -------------------------------------------------------------
        # INTENT 7: TOTAL SPENT / EXPENSE SEARCH
        # -------------------------------------------------------------
        elif re.search(r'\b(total spent|total amount|how much|total expense|total expenses|spending|spent|expenses)\b', user_msg_lower):
            if is_all_time or ("all" in user_msg_lower and "time" in user_msg_lower):
                expenses = database.get_expenses(user_id)
                period_str = "All Time"
            else:
                expenses = database.get_expenses(user_id, month=target_month, year=target_year)
                if not expenses and not is_last_month:
                    all_expenses = database.get_expenses(user_id)
                    if all_expenses:
                        total_all = sum(float(e.get('amount', 0)) for e in all_expenses)
                        return jsonify({'reply': f"You have no expenses logged for **{target_label}**. Overall all-time spending is **{symbol}{total_all:,.2f}** across {len(all_expenses)} transactions."})
                    period_str = target_label
                else:
                    period_str = target_label

            total = sum(float(e.get('amount', 0)) for e in expenses)
            return jsonify({'reply': f"💰 Your total spending for **{period_str}** is **{symbol}{total:,.2f}** (across {len(expenses)} transactions)."})

        # -------------------------------------------------------------
        # INTENT 8: GREETING / HELP
        # -------------------------------------------------------------
        elif any(word in user_msg_lower for word in ['hi', 'hello', 'hey', 'help', 'chatbot', 'who are you', 'what can you do']):
            reply = (
                f"👋 Hello! I am your SpendSmart Financial Assistant. Here is what I can answer for you:\n\n"
                f"- 📄 *'What are my EMIs?'* or *'Total EMI amount'*\n"
                f"- 💰 *'Total spent this month'* or *'All time expenses'*\n"
                f"- 📊 *'Category breakdown'*\n"
                f"- 💳 *'Credit card spending'* / *'Debit spending'*\n"
                f"- 🏆 *'What is my highest expense?'*\n"
                f"- 📋 *'Overall summary'*"
            )
            return jsonify({'reply': reply})

        # -------------------------------------------------------------
        # INTENT 9: DYNAMIC FALLBACK
        # -------------------------------------------------------------
        else:
            all_exp = database.get_expenses(user_id)
            emis = database.get_emis(user_id)
            total_exp = sum(float(e.get('amount', 0)) for e in all_exp)
            total_emi = sum(float(e.get('emi_amount', 0)) for e in emis)
            
            reply = (
                f"I couldn't quite understand your query. Here are your account highlights:\n\n"
                f"- Total Recorded Expenses: **{symbol}{total_exp:,.2f}** ({len(all_exp)} items)\n"
                f"- Active EMIs: **{len(emis)}** (**{symbol}{total_emi:,.2f}**/mo)\n\n"
                f"Try asking:\n"
                f"- *'Show my EMIs'*\n"
                f"- *'Total spent this month'*\n"
                f"- *'Category breakdown'*\n"
                f"- *'Highest expense'*"
            )
            return jsonify({'reply': reply})
