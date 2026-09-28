# Digital Payment Fraud Detection

A full-stack machine learning application for detecting potentially fraudulent digital payment transactions.

The system uses a trained Machine Learning model to classify transactions as **FRAUD** or **LEGITIMATE**, calculate fraud probability, assign a risk level, and provide results through a web-based dashboard.

It also supports **batch CSV processing** for large transaction datasets.

---

## 🚀 Live Demo

### Frontend

https://digital-payment-fraud-detection-1.onrender.com

### Backend API

https://digital-payment-fraud-detection-z2r8.onrender.com

### Swagger API Documentation

https://digital-payment-fraud-detection-z2r8.onrender.com/docs

---

## 📌 Project Overview

Digital payment systems process a large number of transactions every day. Detecting fraudulent transactions manually is difficult because of the volume and complexity of the data.

This project provides an automated fraud detection system using Machine Learning.

The application provides:

- Single transaction fraud prediction
- Fraud probability calculation
- Risk-level classification
- Batch CSV transaction processing
- Background batch processing
- Processing progress tracking
- Fraud and legitimate transaction statistics
- CSV result download
- REST API
- Interactive Swagger documentation
- Web-based frontend dashboard

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────────┐
                    │       User / Client     │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    React Frontend       │
                    │    Vite Dashboard       │
                    └────────────┬────────────┘
                                 │
                          HTTP / REST API
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      FastAPI Backend    │
                    │                         │
                    │ /predict                │
                    │ /predict-batch          │
                    │ /batch-status/{id}      │
                    │ /download/{id}          │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Machine Learning      │
                    │      Model              │
                    │                         │
                    │   Random Forest         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Fraud Prediction        │
                    │ Probability             │
                    │ Risk Level              │
                    └─────────────────────────┘
🧠 Machine Learning

The application uses a trained Random Forest machine learning model.

The trained model is stored at:

ml/models/fraud_model.joblib

The backend loads this model when the application starts.

Input Features

The prediction system uses the following transaction information:

step
amount
oldbalanceOrg
newbalanceOrig
oldbalanceDest
newbalanceDest
isFlaggedFraud
type

Transaction type is transformed into one-hot encoded features:

type_CASH_IN
type_CASH_OUT
type_DEBIT
type_PAYMENT
type_TRANSFER

Additional engineered features include:

origin_balance_error
destination_balance_error
🔍 Fraud Prediction

For a single transaction, the API returns information such as:

{
  "prediction": 1,
  "result": "FRAUD",
  "risk_level": "HIGH",
  "fraud_probability": 0.999972,
  "fraud_percentage": 99.9972,
  "transaction": {
    "type": "TRANSFER",
    "amount": 181
  },
  "explanation": "The machine-learning model identified this transaction as potentially fraudulent."
}
Prediction Values
0 → LEGITIMATE
1 → FRAUD
Risk Levels

The API provides:

LOW
MEDIUM
HIGH

based on the model's fraud probability and prediction.

📊 Batch Processing

The application supports uploading transaction CSV files for batch fraud detection.

Large files are processed in chunks instead of loading the entire dataset into memory.

Current chunk size:

50,000 transactions

The batch system:

Uploads the CSV file
Creates a unique job ID
Determines the number of transactions
Starts background processing
Processes transactions chunk-by-chunk
Generates predictions
Calculates fraud probabilities
Tracks processing progress
Generates a result CSV
Provides the result for download
🔄 Batch Processing Flow
CSV Upload
    │
    ▼
Generate Job ID
    │
    ▼
Save CSV
    │
    ▼
Start Background Worker
    │
    ▼
Read 50,000 rows
    │
    ▼
Prepare Features
    │
    ▼
ML Prediction
    │
    ▼
Calculate Probability
    │
    ▼
Write Results
    │
    ▼
Update Progress
    │
    ▼
Repeat Until Complete
    │
    ▼
Generate Result CSV
    │
    ▼
Download Results
🌐 API Endpoints
Root
GET /

Returns the API status.

Health Check
GET /health

Returns backend health and model-loading information.

Single Transaction Prediction
POST /predict

Accepts transaction information and returns the fraud prediction.

Example request:

{
  "step": 1,
  "amount": 181,
  "oldbalanceOrg": 1000,
  "newbalanceOrig": 819,
  "oldbalanceDest": 500,
  "newbalanceDest": 681,
  "isFlaggedFraud": 0,
  "type": "TRANSFER"
}
Batch Prediction
POST /predict-batch

Accepts a CSV file and starts a background batch-processing job.

Example response:

{
  "status": "processing",
  "job_id": "example-job-id",
  "total_transactions": 100000,
  "processed_transactions": 0,
  "progress_percentage": 0,
  "status_url": "/batch-status/example-job-id"
}
Batch Status
GET /batch-status/{job_id}

Returns the current processing status.

Example information includes:

status
total_transactions
processed_transactions
fraud_transactions
legitimate_transactions
progress_percentage
fraud_rate_percentage
Download Batch Results
GET /download/{job_id}

Downloads the generated fraud detection result CSV.

🖥️ Frontend

The frontend is built using:

React
Vite
JavaScript
CSS

The frontend communicates with the FastAPI backend using REST APIs.

Frontend Environment Variable

The frontend uses:

VITE_API_URL

Example:

VITE_API_URL=https://digital-payment-fraud-detection-z2r8.onrender.com

For local development:

VITE_API_URL=http://localhost:8000

The .env file should not be committed to Git.

A template is provided:

frontend/.env.example
📁 Project Structure
Fraud Detection in digital payments/
│
├── backend/
│   └── main.py
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   └── Dashboard.jsx
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── ml/
│   ├── 01_explore_data.py
│   ├── 02_preprocess_data.py
│   ├── 03_train_model.py
│   ├── 04_test_model.py
│   ├── models/
│   │   └── fraud_model.joblib
│   └── requirements.txt
│
├── tests/
│   └── 05_generate_stress_test.py
│
├── data/
│   └── test_batch.csv
│
├── requirements.txt
├── .gitignore
├── .python-version
└── README.md
⚙️ Technologies Used
Machine Learning
Python
Pandas
NumPy
Scikit-learn
Joblib
Backend
FastAPI
Uvicorn
Pydantic
Python Multipart
Frontend
React
Vite
JavaScript
CSS
Deployment
GitHub
Render
💻 Local Installation
1. Clone the Repository
git clone https://github.com/thisisjknaidu/digital-payment-fraud-detection.git

Move into the project:

cd digital-payment-fraud-detection
🐍 Backend Setup

Create a virtual environment:

python -m venv venv

Activate it on Windows:

venv\Scripts\activate

Install dependencies:

pip install -r requirements.txt

Start the FastAPI backend:

uvicorn backend.main:app --reload

Backend will be available at:

http://127.0.0.1:8000

Swagger documentation:

http://127.0.0.1:8000/docs
⚛️ Frontend Setup

Open another terminal.

Move to the frontend directory:

cd frontend

Install dependencies:

npm install

Create:

frontend/.env

Add:

VITE_API_URL=http://localhost:8000

Start the development server:

npm run dev

The frontend will normally be available at:

http://localhost:5173
🔐 CORS Configuration

The FastAPI backend allows the deployed frontend origin through the FRONTEND_URL environment variable.

Example:

FRONTEND_URL=https://digital-payment-fraud-detection-1.onrender.com

Local development origins are also supported.

🚀 Deployment

The application is deployed using Render.

Backend

The backend runs as a Render Web Service.

Start command:

uvicorn backend.main:app --host 0.0.0.0 --port $PORT
Frontend

The React application is deployed as a Render Static Site.

Build command:

npm install && npm run build

Publish directory:

frontend/dist

The frontend communicates with the deployed FastAPI backend using:

VITE_API_URL
🧪 Testing

The project includes scripts for testing the machine learning model and generating stress-test transaction data.

Test scripts are located in:

ml/
tests/

Example:

python ml/04_test_model.py

Stress-test data generation:

python tests/05_generate_stress_test.py
📦 Dependencies

Backend dependencies are listed in:

requirements.txt

The frontend dependencies are managed through:

frontend/package.json
📈 Features
Feature	Status
Machine Learning Fraud Detection	✅
Random Forest Model	✅
Single Transaction Prediction	✅
Fraud Probability	✅
Risk Level	✅
REST API	✅
Swagger Documentation	✅
CSV Batch Upload	✅
Background Batch Processing	✅
Progress Tracking	✅
Result CSV Download	✅
React Dashboard	✅
CORS Configuration	✅
GitHub Repository	✅
Render Backend Deployment	✅
Render Frontend Deployment	✅
⚠️ Important Note

This project is intended for academic, demonstration, and research purposes.

The predictions generated by the machine learning model should not be treated as a definitive determination of financial fraud without appropriate validation, monitoring, and human or organizational review.

👨‍💻 Author

Jaya Krishna Uppu

GitHub:

https://github.com/itsmejknaidu

Repository:

https://github.com/itsmejknaidu/digital-payment-fraud-detection
```
