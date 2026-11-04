# Service data (FastAPI). Same image in development and on the servers: it is
# only reachable from the API, on the internal Docker network.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY reglo_data ./reglo_data

# Not root; "data/" holds the default SQLite database of the service
RUN useradd --create-home --uid 1000 reglo && mkdir -p data && chown reglo data
USER reglo

EXPOSE 8000

CMD ["uvicorn", "reglo_data.api:app", "--host", "0.0.0.0", "--port", "8000"]
