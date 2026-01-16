# Backend Dockerfile - FastAPI with Go cross-compilation support
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including Go for beacon cross-compilation
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install Go 1.21 for beacon cross-compilation
# This allows compiling Windows EXE from Linux!
ENV GO_VERSION=1.21.6
RUN wget -q https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz \
    && tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz \
    && rm go${GO_VERSION}.linux-amd64.tar.gz

ENV PATH="${PATH}:/usr/local/go/bin"
ENV GOPATH="/go"
ENV GOCACHE="/tmp/go-cache"

# Verify Go installation
RUN go version

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir watchfiles

# Copy server code
COPY server/ ./server/
COPY migrations/ ./migrations/

# Copy Go beacon source for compilation
COPY client/beacon-go/ ./client/beacon-go/

# Pre-download Go dependencies for faster compilation
WORKDIR /app/client/beacon-go
RUN go mod download

WORKDIR /app

# Create directories
RUN mkdir -p logs uploaded_reports

# Expose API port
EXPOSE 8080

# Run with hot-reload for development
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8080", "--reload"]
