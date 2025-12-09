# Backend Dockerfile - FastAPI with hot-reload
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir watchfiles

# Copy server code
COPY server/ ./server/
COPY migrations/ ./migrations/

# Create directories
RUN mkdir -p logs uploaded_reports

# Expose API port
EXPOSE 8080

# Run with hot-reload for development
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8080", "--reload"]

