FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY data/ data/ src/ src/ api/ api/
EXPOSE 8000
CMD ["sh", "-c", "test -f models/supervised.pkl || (python data/generator.py && python src/train.py); uvicorn api.main:app --host 0.0.0.0 --port 8000"]
