FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . /app/

# Create a /data folder for SQLite volume persistence
# chmod 777 ensures that whatever user Render executes the container as can write the sqlite file
RUN mkdir -p /data && chmod 777 /data

# Expose the default port (Render will override this via the PORT environment variable)
EXPOSE 5000

# Set default database path in the container pointing to the volume mount
ENV DATABASE_PATH=/data/expenses.db

# Run via Gunicorn production WSGI server
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} app:app"]
