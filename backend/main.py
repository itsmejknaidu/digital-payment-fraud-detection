from pathlib import Path
import os
import threading
import uuid

import joblib
import pandas as pd

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel


# ==========================================================
# PATHS
# ==========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = (
    BASE_DIR
    / "ml"
    / "models"
    / "fraud_model.joblib"
)

UPLOAD_DIR = (
    BASE_DIR
    / "data"
    / "batch_uploads"
)

RESULT_DIR = (
    BASE_DIR
    / "data"
    / "batch_results"
)


# ==========================================================
# CREATE DIRECTORIES
# ==========================================================

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
RESULT_DIR.mkdir(parents=True, exist_ok=True)


# ==========================================================
# LOAD MODEL
# ==========================================================

print("=" * 60)
print("DIGITAL PAYMENT FRAUD DETECTION API")
print("=" * 60)

print()
print("Loading machine learning model...")
print()

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model file not found: {MODEL_PATH}"
    )

model = joblib.load(MODEL_PATH)

print("Model loaded successfully!")
print()


# ==========================================================
# FASTAPI
# ==========================================================

app = FastAPI(
    title="Digital Payment Fraud Detection API",
    description=(
        "Machine Learning API for detecting potentially "
        "fraudulent digital payment transactions."
    ),
    version="2.1.0",
)


# ==========================================================
# CORS
# ==========================================================

frontend_url = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173",
)

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://digital-payment-fraud-detection-1.onrender.com",
]

if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(allowed_origins)),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================================
# BATCH JOB STORAGE
# ==========================================================

batch_jobs = {}
batch_jobs_lock = threading.Lock()


# ==========================================================
# TRANSACTION REQUEST MODEL
# ==========================================================

class Transaction(BaseModel):
    step: int
    amount: float
    oldbalanceOrg: float
    newbalanceOrig: float
    oldbalanceDest: float
    newbalanceDest: float
    isFlaggedFraud: int
    type: str


# ==========================================================
# FEATURE PREPARATION
# ==========================================================

def prepare_features(df: pd.DataFrame) -> pd.DataFrame:

    df = df.copy()

    required_columns = [
        "step",
        "type",
        "amount",
        "oldbalanceOrg",
        "newbalanceOrig",
        "oldbalanceDest",
        "newbalanceDest",
        "isFlaggedFraud",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Missing required columns: "
            + ", ".join(missing_columns)
        )

    numeric_columns = [
        "step",
        "amount",
        "oldbalanceOrg",
        "newbalanceOrig",
        "oldbalanceDest",
        "newbalanceDest",
        "isFlaggedFraud",
    ]

    for column in numeric_columns:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

    df = df.dropna(
        subset=numeric_columns
    ).copy()

    # ------------------------------------------------------
    # One-hot transaction type
    # ------------------------------------------------------

    df["type_CASH_IN"] = (
        df["type"] == "CASH_IN"
    ).astype("int8")

    df["type_CASH_OUT"] = (
        df["type"] == "CASH_OUT"
    ).astype("int8")

    df["type_DEBIT"] = (
        df["type"] == "DEBIT"
    ).astype("int8")

    df["type_PAYMENT"] = (
        df["type"] == "PAYMENT"
    ).astype("int8")

    df["type_TRANSFER"] = (
        df["type"] == "TRANSFER"
    ).astype("int8")

    # ------------------------------------------------------
    # Engineered features
    # ------------------------------------------------------

    df["origin_balance_error"] = (
        df["oldbalanceOrg"]
        - df["amount"]
        - df["newbalanceOrig"]
    )

    df["destination_balance_error"] = (
        df["oldbalanceDest"]
        + df["amount"]
        - df["newbalanceDest"]
    )

    # ------------------------------------------------------
    # EXACT MODEL FEATURE ORDER
    # ------------------------------------------------------

    feature_columns = [
        "step",
        "amount",
        "oldbalanceOrg",
        "newbalanceOrig",
        "oldbalanceDest",
        "newbalanceDest",
        "isFlaggedFraud",
        "type_CASH_IN",
        "type_CASH_OUT",
        "type_DEBIT",
        "type_PAYMENT",
        "type_TRANSFER",
        "origin_balance_error",
        "destination_balance_error",
    ]

    return df[feature_columns]


# ==========================================================
# SINGLE TRANSACTION PREPARATION
# ==========================================================

def prepare_single_transaction(
    transaction: Transaction,
) -> pd.DataFrame:

    data = transaction.model_dump()

    df = pd.DataFrame([data])

    return prepare_features(df)


# ==========================================================
# ROOT
# ==========================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "message": "Digital Payment Fraud Detection API",
        "model": "Random Forest",
        "version": "2.1.0",
    }


# ==========================================================
# HEALTH
# ==========================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "model_loaded": True,
        "model_path": str(MODEL_PATH),
    }


# ==========================================================
# SINGLE PREDICTION
# ==========================================================

@app.post("/predict")
def predict(transaction: Transaction):

    try:

        input_data = prepare_single_transaction(
            transaction
        )

        prediction = int(
            model.predict(input_data)[0]
        )

        fraud_probability = float(
            model.predict_proba(input_data)[0][1]
        )

        fraud_percentage = (
            fraud_probability * 100
        )

        if prediction == 1:

            result = "FRAUD"
            risk_level = "HIGH"

            explanation = (
                "The machine-learning model "
                "identified this transaction as "
                "potentially fraudulent."
            )

        else:

            result = "LEGITIMATE"

            if fraud_probability >= 0.50:
                risk_level = "HIGH"

            elif fraud_probability >= 0.20:
                risk_level = "MEDIUM"

            else:
                risk_level = "LOW"

            explanation = (
                "The machine-learning model "
                "identified this transaction as "
                "likely legitimate."
            )

        return {

            "prediction": prediction,

            "result": result,

            "risk_level": risk_level,

            "fraud_probability": round(
                fraud_probability,
                6,
            ),

            "fraud_percentage": round(
                fraud_percentage,
                4,
            ),

            "transaction": {
                "type": transaction.type,
                "amount": transaction.amount,
            },

            "explanation": explanation,
        }

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )


# ==========================================================
# BATCH PROCESSOR
# ==========================================================

def process_batch_job(
    job_id: str,
    input_path: Path,
    output_path: Path,
):

    try:

        chunk_size = 50_000

        total_transactions = 0
        fraud_transactions = 0
        legitimate_transactions = 0

        first_chunk = True

        for df in pd.read_csv(
            input_path,
            chunksize=chunk_size,
        ):

            original_df = df.copy()

            feature_df = prepare_features(df)

            predictions = model.predict(
                feature_df
            )

            probabilities = model.predict_proba(
                feature_df
            )[:, 1]

            original_df["prediction"] = (
                predictions.astype(int)
            )

            original_df["fraud_probability"] = (
                probabilities
            )

            original_df["fraud_percentage"] = (
                probabilities * 100
            ).round(4)

            original_df["result"] = (
                original_df["prediction"]
                .map(
                    {
                        0: "LEGITIMATE",
                        1: "FRAUD",
                    }
                )
            )

            chunk_total = len(original_df)

            chunk_fraud = int(
                (
                    original_df["prediction"] == 1
                ).sum()
            )

            chunk_legitimate = (
                chunk_total - chunk_fraud
            )

            total_transactions += chunk_total
            fraud_transactions += chunk_fraud
            legitimate_transactions += chunk_legitimate

            original_df.to_csv(
                output_path,
                mode="w" if first_chunk else "a",
                header=first_chunk,
                index=False,
            )

            first_chunk = False

            with batch_jobs_lock:

                job = batch_jobs[job_id]

                job["processed_transactions"] = (
                    total_transactions
                )

                job["fraud_transactions"] = (
                    fraud_transactions
                )

                job["legitimate_transactions"] = (
                    legitimate_transactions
                )

                total_rows = job[
                    "total_transactions"
                ]

                if total_rows > 0:

                    progress = (
                        total_transactions
                        / total_rows
                    ) * 100

                    job["progress_percentage"] = round(
                        min(progress, 100),
                        2,
                    )

        if total_transactions > 0:

            fraud_rate = (
                fraud_transactions
                / total_transactions
            ) * 100

        else:

            fraud_rate = 0

        with batch_jobs_lock:

            job = batch_jobs[job_id]

            job["status"] = "completed"

            job["processed_transactions"] = (
                total_transactions
            )

            job["fraud_transactions"] = (
                fraud_transactions
            )

            job["legitimate_transactions"] = (
                legitimate_transactions
            )

            job["progress_percentage"] = 100

            job["fraud_rate_percentage"] = round(
                fraud_rate,
                4,
            )

            job["result_file"] = (
                f"/download/{job_id}"
            )

    except Exception as exc:

        with batch_jobs_lock:

            if job_id in batch_jobs:

                batch_jobs[job_id]["status"] = "failed"

                batch_jobs[job_id]["error"] = str(exc)


# ==========================================================
# START BATCH
# ==========================================================

@app.post("/predict-batch")
async def predict_batch(
    file: UploadFile = File(...),
):

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    if not file.filename.lower().endswith(".csv"):

        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported.",
        )

    job_id = uuid.uuid4().hex

    input_path = (
        UPLOAD_DIR
        / f"{job_id}.csv"
    )

    output_path = (
        RESULT_DIR
        / f"{job_id}_result.csv"
    )

    try:

        with open(
            input_path,
            "wb",
        ) as buffer:

            while True:

                chunk = await file.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                buffer.write(chunk)

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to save uploaded file: "
                + str(exc)
            ),
        )

    finally:

        await file.close()

    # ------------------------------------------------------
    # Count rows
    # ------------------------------------------------------

    try:

        total_transactions = 0

        for chunk in pd.read_csv(
            input_path,
            chunksize=50_000,
        ):

            total_transactions += len(chunk)

    except Exception as exc:

        if input_path.exists():
            input_path.unlink()

        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to read CSV file: "
                + str(exc)
            ),
        )

    # ------------------------------------------------------
    # Create job
    # ------------------------------------------------------

    with batch_jobs_lock:

        batch_jobs[job_id] = {

            "status": "processing",

            "job_id": job_id,

            "total_transactions":
                total_transactions,

            "processed_transactions": 0,

            "fraud_transactions": 0,

            "legitimate_transactions": 0,

            "fraud_rate_percentage": 0,

            "progress_percentage": 0,

            "result_file":
                f"/download/{job_id}",
        }

    # ------------------------------------------------------
    # Start worker
    # ------------------------------------------------------

    worker = threading.Thread(
        target=process_batch_job,
        args=(
            job_id,
            input_path,
            output_path,
        ),
        daemon=True,
    )

    worker.start()

    return {

        "status": "processing",

        "job_id": job_id,

        "total_transactions":
            total_transactions,

        "processed_transactions": 0,

        "progress_percentage": 0,

        "status_url":
            f"/batch-status/{job_id}",
    }


# ==========================================================
# BATCH STATUS
# ==========================================================

@app.get("/batch-status/{job_id}")
def batch_status(job_id: str):

    with batch_jobs_lock:

        job = batch_jobs.get(job_id)

        if job is None:

            raise HTTPException(
                status_code=404,
                detail="Batch job not found.",
            )

        return job


# ==========================================================
# DOWNLOAD
# ==========================================================

@app.get("/download/{job_id}")
def download_result(job_id: str):

    result_path = (
        RESULT_DIR
        / f"{job_id}_result.csv"
    )

    if not result_path.exists():

        raise HTTPException(
            status_code=404,
            detail="Result file is not available yet.",
        )

    return FileResponse(
        path=result_path,
        filename="fraud_detection_results.csv",
        media_type="text/csv",
    )


# ==========================================================
# SERVER STARTUP MESSAGE
# ==========================================================

print("=" * 60)
print("API READY")
print("=" * 60)

print()
print("Swagger UI:")
print("http://127.0.0.1:8000/docs")

print()
print("Frontend:")
print("http://localhost:5173")

print()