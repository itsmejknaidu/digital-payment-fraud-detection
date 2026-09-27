import React, { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

const API_URL = "http://127.0.0.1:8000";

const initialTransaction = {
  step: 1,
  type: "TRANSFER",
  amount: 181,
  oldbalanceOrg: 181,
  newbalanceOrig: 0,
  oldbalanceDest: 0,
  newbalanceDest: 0,
  isFlaggedFraud: 0,
};

function App() {
  // ============================================================
  // SINGLE TRANSACTION
  // ============================================================

  const [transaction, setTransaction] = useState(initialTransaction);

  const [prediction, setPrediction] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState("");

  // ============================================================
  // BATCH
  // ============================================================

  const [selectedFile, setSelectedFile] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [batchResult, setBatchResult] = useState(null);

  // ============================================================
  // UPDATE TRANSACTION
  // ============================================================

  const updateTransaction = (field, value) => {
    setTransaction((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  // ============================================================
  // SINGLE PREDICTION
  // ============================================================

  const detectFraud = async () => {
    setPredictionLoading(true);
    setPredictionError("");
    setPrediction(null);

    try {
      const payload = {
        step: Number(transaction.step),
        type: transaction.type,
        amount: Number(transaction.amount),
        oldbalanceOrg: Number(transaction.oldbalanceOrg),
        newbalanceOrig: Number(transaction.newbalanceOrig),
        oldbalanceDest: Number(transaction.oldbalanceDest),
        newbalanceDest: Number(transaction.newbalanceDest),
        isFlaggedFraud: Number(transaction.isFlaggedFraud),
      };

      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`Prediction failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      console.log("PREDICTION RESPONSE:", data);

      setPrediction(data);
    } catch (error) {
      console.error("Prediction error:", error);

      setPredictionError(
        error.message || "Unable to connect to the fraud detection backend.",
      );
    } finally {
      setPredictionLoading(false);
    }
  };

  // ============================================================
  // RESET
  // ============================================================

  const resetTransaction = () => {
    setTransaction(initialTransaction);
    setPrediction(null);
    setPredictionError("");
  };

  // ============================================================
  // FILE CHANGE
  // ============================================================

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    setSelectedFile(file || null);
    setBatchResult(null);
    setBatchError("");
  };

  // ============================================================
  // NORMALIZE BATCH RESULT
  // ============================================================

  const normalizeBatchResult = (data) => {
    const total = Number(data.total_transactions ?? data.total ?? 0);

    const processed = Number(
      data.processed_transactions ?? data.processed ?? total,
    );

    const fraud = Number(
      data.fraud_transactions ?? data.fraud_count ?? data.fraud ?? 0,
    );

    const legitimate = Number(
      data.legitimate_transactions ??
        data.legitimate_count ??
        data.legitimate ??
        Math.max(total - fraud, 0),
    );

    let fraudRate = 0;

    if (
      data.fraud_rate_percentage !== undefined &&
      data.fraud_rate_percentage !== null
    ) {
      fraudRate = Number(data.fraud_rate_percentage);
    } else if (total > 0) {
      fraudRate = (fraud / total) * 100;
    }

    const progress = Number(
      data.progress_percentage ?? (total > 0 ? (processed / total) * 100 : 0),
    );

    return {
      ...data,
      status: data.status || "completed",
      job_id: data.job_id || "",
      total_transactions: total,
      processed_transactions: processed,
      fraud_transactions: fraud,
      legitimate_transactions: legitimate,
      fraud_rate_percentage: fraudRate,
      progress_percentage: progress,
      result_file: data.result_file || null,
    };
  };

  // ============================================================
  // BATCH DETECTION
  // ============================================================

  const startBatchDetection = async () => {
    if (!selectedFile) {
      setBatchError("Please select a CSV file first.");
      return;
    }

    setBatchLoading(true);
    setBatchError("");

    setBatchResult({
      status: "uploading",
      total_transactions: 0,
      processed_transactions: 0,
      fraud_transactions: 0,
      legitimate_transactions: 0,
      fraud_rate_percentage: 0,
      progress_percentage: 0,
    });

    try {
      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await fetch(`${API_URL}/predict-batch`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `Batch upload failed (${response.status}): ${errorText}`,
        );
      }

      const data = await response.json();

      console.log("BATCH START RESPONSE:", data);

      if (data.status === "completed") {
        setBatchResult(normalizeBatchResult(data));
        setBatchLoading(false);
        return;
      }

      if (data.job_id) {
        await pollBatchStatus(data.job_id);
      } else {
        throw new Error("Backend did not return a job_id.");
      }
    } catch (error) {
      console.error("Batch error:", error);

      setBatchError(error.message || "Unable to process the batch file.");

      setBatchLoading(false);
    }
  };

  // ============================================================
  // BATCH STATUS
  // ============================================================

  const pollBatchStatus = async (jobId) => {
    let completed = false;

    while (!completed) {
      const response = await fetch(`${API_URL}/batch-status/${jobId}`);

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `Unable to get batch status (${response.status}): ${errorText}`,
        );
      }

      const data = await response.json();

      console.log("BATCH STATUS:", data);

      setBatchResult((previous) => ({
        ...(previous || {}),
        ...data,
      }));

      if (data.status === "completed") {
        setBatchResult(normalizeBatchResult(data));

        completed = true;
        setBatchLoading(false);

        return;
      }

      if (data.status === "failed" || data.status === "error") {
        throw new Error(
          data.detail || data.message || "Batch processing failed.",
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  };

  // ============================================================
  // DOWNLOAD RESULT
  // ============================================================

  const downloadResult = () => {
    if (!batchResult?.result_file) {
      return;
    }

    const resultPath = batchResult.result_file;

    const downloadUrl = resultPath.startsWith("http")
      ? resultPath
      : `${API_URL}${resultPath}`;

    window.open(downloadUrl, "_blank");
  };

  // ============================================================
  // FORMATTING
  // ============================================================

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString("en-IN");
  };

  const formatPercentage = (value) => {
    return `${Number(value || 0).toFixed(4)}%`;
  };

  // ============================================================
  // DASHBOARD DATA
  // ============================================================

  const dashboardTotal = batchResult?.total_transactions || 100000;

  const dashboardFraud = batchResult?.fraud_transactions ?? 4997;

  const dashboardLegitimate = batchResult?.legitimate_transactions ?? 95003;

  const dashboardFraudRate = batchResult?.fraud_rate_percentage ?? 4.997;

  const distributionData = [
    {
      name: "Legitimate",
      value: dashboardLegitimate,
    },
    {
      name: "Fraud",
      value: dashboardFraud,
    },
  ];

  const typeData = [
    {
      type: "PAYMENT",
      transactions: 40000,
    },
    {
      type: "TRANSFER",
      transactions: 20000,
    },
    {
      type: "CASH_OUT",
      transactions: 25000,
    },
    {
      type: "CASH_IN",
      transactions: 12000,
    },
    {
      type: "DEBIT",
      transactions: 3000,
    },
  ];

  const PIE_COLORS = ["#18a86b", "#ff5b35"];

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="app">
      {/* ======================================================
          GLOBAL STYLE
      ====================================================== */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family:
            Inter,
            Arial,
            Helvetica,
            sans-serif;

          background:
            linear-gradient(
              135deg,
              #eef5ff 0%,
              #f7f9fc 45%,
              #edf7f4 100%
            );

          color: #102a43;
        }

        button,
        input,
        select {
          font-family: inherit;
        }

        .app {
          min-height: 100vh;
          padding: 28px;
        }

        .container {
          width: 100%;
          max-width: 1500px;
          margin: auto;
        }

        /* ====================================================
           HEADER
        ==================================================== */

        .main-header {
          position: relative;

          background:
            linear-gradient(
              135deg,
              #ffffff 0%,
              #eef5ff 100%
            );

          border-radius: 28px;

          padding: 34px 40px;

          margin-bottom: 26px;

          box-shadow:
            0 15px 45px rgba(28, 68, 120, 0.12);

          border: 1px solid #dce8f7;

          overflow: hidden;
        }

        .main-header::before {
          content: "";

          position: absolute;

          width: 230px;
          height: 230px;

          border-radius: 50%;

          background: rgba(45, 105, 235, 0.08);

          top: -120px;
          right: 80px;
        }

        .main-header::after {
          content: "";

          position: absolute;

          width: 180px;
          height: 180px;

          border-radius: 50%;

          background: rgba(24, 168, 107, 0.07);

          bottom: -100px;
          left: 50px;
        }

        .header-content {
          position: relative;
          z-index: 2;

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 30px;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .header-icon {
          width: 64px;
          height: 64px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 18px;

          background:
            linear-gradient(
              135deg,
              #2563eb,
              #4f46e5
            );

          color: white;

          font-size: 31px;

          box-shadow:
            0 10px 25px rgba(37, 99, 235, 0.25);
        }

        .main-header h1 {
          margin: 0;

          font-size: 35px;

          color: #082b52;

          font-weight: 850;

          letter-spacing: -0.8px;
        }

        .main-header p {
          margin: 7px 0 0;

          font-size: 16px;

          color: #66809f;
        }

        .model-badge {
          padding: 12px 20px;

          border-radius: 30px;

          background: #e7efff;

          color: #2459c7;

          font-weight: 800;

          white-space: nowrap;

          border: 1px solid #cddcff;
        }

        /* ====================================================
           SINGLE TRANSACTION
        ==================================================== */

        .single-grid {
          display: grid;

          grid-template-columns:
            minmax(0, 1.55fr)
            minmax(360px, 0.75fr);

          gap: 25px;

          margin-bottom: 25px;
        }

        .card {
          background: rgba(255, 255, 255, 0.95);

          border-radius: 25px;

          padding: 30px;

          box-shadow:
            0 15px 40px rgba(28, 68, 120, 0.09);

          border: 1px solid #dce7f4;
        }

        .card h2 {
          margin: 0 0 8px;

          color: #082b52;

          font-size: 28px;
        }

        .subtitle {
          color: #6883a2;

          margin-bottom: 28px;

          font-size: 16px;
        }

        .form-grid {
          display: grid;

          grid-template-columns: 1fr 1fr;

          gap: 20px;
        }

        .field {
          display: flex;

          flex-direction: column;

          gap: 8px;
        }

        .field label {
          font-size: 14px;

          font-weight: 800;

          color: #16416e;
        }

        .field input,
        .field select {
          width: 100%;

          height: 54px;

          padding: 0 15px;

          border: 1px solid #cbd9ea;

          border-radius: 12px;

          font-size: 16px;

          color: #173b63;

          background: #ffffff;

          outline: none;

          transition:
            border-color 0.2s,
            box-shadow 0.2s;
        }

        .field input:focus,
        .field select:focus {
          border-color: #3675e8;

          box-shadow:
            0 0 0 4px rgba(54, 117, 232, 0.10);
        }

        .actions {
          display: flex;

          justify-content: flex-end;

          gap: 12px;

          margin-top: 25px;
        }

        .button {
          border: none;

          border-radius: 12px;

          padding: 14px 23px;

          font-size: 16px;

          font-weight: 800;

          cursor: pointer;

          transition:
            transform 0.15s,
            box-shadow 0.15s,
            background 0.15s;
        }

        .button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .primary {
          background:
            linear-gradient(
              135deg,
              #2563eb,
              #4f46e5
            );

          color: white;

          box-shadow:
            0 8px 20px rgba(37, 99, 235, 0.22);
        }

        .primary:hover:not(:disabled) {
          box-shadow:
            0 12px 25px rgba(37, 99, 235, 0.30);
        }

        .secondary {
          background: #edf2f8;

          color: #173b63;
        }

        .button:disabled {
          opacity: 0.55;

          cursor: not-allowed;
        }

        /* ====================================================
           RESULT
        ==================================================== */

        .result-panel {
          min-height: 520px;

          display: flex;

          align-items: center;

          justify-content: center;
        }

        .empty-result {
          width: 100%;

          min-height: 400px;

          border:
            2px dashed #d2deed;

          border-radius: 20px;

          display: flex;

          flex-direction: column;

          align-items: center;

          justify-content: center;

          text-align: center;

          padding: 30px;

          background:
            linear-gradient(
              145deg,
              #fbfdff,
              #f5f9ff
            );
        }

        .empty-result-icon {
          width: 75px;
          height: 75px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 50%;

          background: #e9f1ff;

          font-size: 40px;

          margin-bottom: 14px;
        }

        .empty-result h3 {
          margin: 0 0 10px;

          font-size: 22px;

          color: #173b63;
        }

        .empty-result p {
          max-width: 320px;

          line-height: 1.6;

          color: #7890a8;

          margin: 0;
        }

        .result-box {
          width: 100%;

          border-radius: 22px;

          padding: 32px;

          text-align: center;

          box-shadow:
            0 10px 30px rgba(30, 60, 90, 0.08);
        }

        .fraud {
          background:
            linear-gradient(
              145deg,
              #fff8f2,
              #fff1e7
            );

          border: 1px solid #ffb979;
        }

        .legitimate {
          background:
            linear-gradient(
              145deg,
              #f1fff8,
              #e9faf2
            );

          border: 1px solid #91ddb5;
        }

        .result-icon {
          font-size: 52px;

          margin-bottom: 10px;
        }

        .result-title {
          font-size: 36px;

          font-weight: 900;

          margin-bottom: 24px;
        }

        .fraud .result-title {
          color: #d94b0b;
        }

        .legitimate .result-title {
          color: #16834d;
        }

        .probability {
          margin: 20px 0 25px;
        }

        .probability-label {
          display: flex;

          justify-content: space-between;

          align-items: center;

          margin-bottom: 10px;

          color: #67829f;

          font-size: 16px;
        }

        .probability-value {
          font-size: 25px;

          font-weight: 900;

          color: #102a43;
        }

        .progress {
          height: 14px;

          background: #e3e9f0;

          border-radius: 20px;

          overflow: hidden;
        }

        .progress-bar {
          height: 100%;

          border-radius: 20px;

          background:
            linear-gradient(
              90deg,
              #ff8a3d,
              #ff4d21
            );

          transition: width 0.5s;
        }

        .legitimate .progress-bar {
          background:
            linear-gradient(
              90deg,
              #19a968,
              #10b981
            );
        }

        .result-details {
          margin-top: 15px;

          display: grid;

          gap: 9px;

          color: #183c60;

          line-height: 1.4;
        }

        .result-details strong {
          color: #0b3157;
        }

        .error {
          background: #fff0f0;

          color: #b42323;

          padding: 14px 16px;

          border-radius: 12px;

          margin-top: 16px;

          border: 1px solid #ffcaca;
        }

        /* ====================================================
           BATCH
        ==================================================== */

        .batch-card {
          margin-bottom: 25px;
        }

        .upload-area {
          border:
            2px dashed #b7cde8;

          background:
            linear-gradient(
              145deg,
              #f7fbff,
              #f0f6ff
            );

          border-radius: 20px;

          padding: 28px;

          margin-top: 20px;
        }

        .upload-row {
          display: flex;

          align-items: center;

          gap: 18px;

          flex-wrap: wrap;
        }

        .file-input {
          font-size: 15px;

          color: #315579;
        }

        .file-name {
          color: #315579;

          font-weight: 700;

          background: white;

          padding: 11px 15px;

          border-radius: 10px;

          border: 1px solid #d8e3f0;
        }

        .batch-status {
          margin-top: 28px;
        }

        .status-header {
          display: flex;

          justify-content: space-between;

          align-items: center;

          gap: 15px;

          margin-bottom: 18px;
        }

        .status-header h3 {
          margin: 0;

          font-size: 21px;

          color: #123b65;
        }

        .status-badge {
          padding: 9px 16px;

          border-radius: 30px;

          font-weight: 800;

          background: #e8f0ff;

          color: #2864e6;
        }

        .completed {
          background: #dcf9e8;

          color: #08783f;
        }

        .stats-grid {
          display: grid;

          grid-template-columns:
            repeat(4, 1fr);

          gap: 18px;

          margin-top: 22px;
        }

        .stat {
          position: relative;

          overflow: hidden;

          background:
            linear-gradient(
              145deg,
              #ffffff,
              #f5f8fc
            );

          border: 1px solid #dbe5f0;

          border-radius: 18px;

          padding: 24px 18px;

          text-align: center;

          box-shadow:
            0 7px 20px rgba(30, 70, 110, 0.05);
        }

        .stat::before {
          content: "";

          position: absolute;

          top: 0;
          left: 0;

          width: 100%;
          height: 4px;

          background: #3675e8;
        }

        .stat:nth-child(2)::before {
          background: #ff5b35;
        }

        .stat:nth-child(3)::before {
          background: #18a86b;
        }

        .stat:nth-child(4)::before {
          background: #8b5cf6;
        }

        .stat-label {
          color: #6783a1;

          margin-bottom: 10px;

          font-size: 14px;

          font-weight: 700;
        }

        .stat-value {
          font-size: 30px;

          font-weight: 900;

          color: #102a43;
        }

        .fraud-stat {
          color: #dc4b22;
        }

        .legitimate-stat {
          color: #138b54;
        }

        .batch-progress {
          margin-top: 25px;
        }

        .batch-progress-label {
          display: flex;

          justify-content: space-between;

          margin-bottom: 9px;

          color: #607d9a;
        }

        .batch-progress-track {
          height: 14px;

          border-radius: 20px;

          background: #e3eaf2;

          overflow: hidden;
        }

        .batch-progress-fill {
          height: 100%;

          background:
            linear-gradient(
              90deg,
              #2563eb,
              #4f46e5
            );

          border-radius: 20px;

          transition: width 0.3s ease;
        }

        .download-button {
          margin-top: 22px;
        }

        /* ====================================================
           DASHBOARD
        ==================================================== */

        .dashboard-section {
          position: relative;

          background:
            linear-gradient(
              145deg,
              #f9fcff,
              #eef5ff 50%,
              #f0fbf7
            );

          border-radius: 28px;

          padding: 32px;

          box-shadow:
            0 15px 45px rgba(28, 68, 120, 0.10);

          border: 1px solid #dce7f4;

          overflow: hidden;
        }

        .dashboard-section::before {
          content: "";

          position: absolute;

          width: 320px;
          height: 320px;

          border-radius: 50%;

          background: rgba(37, 99, 235, 0.055);

          top: -180px;
          right: -70px;
        }

        .dashboard-header {
          position: relative;

          z-index: 2;

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 20px;

          margin-bottom: 25px;
        }

        .dashboard-header h2 {
          margin: 0;

          font-size: 30px;

          color: #082b52;
        }

        .dashboard-header p {
          margin: 7px 0 0;

          color: #6783a1;

          font-size: 15px;
        }

        .dashboard-header .model-badge {
          background:
            linear-gradient(
              135deg,
              #e9efff,
              #f0eaff
            );

          color: #4f46e5;

          border: 1px solid #d8d7ff;
        }

        .dashboard-cards {
          position: relative;

          z-index: 2;

          display: grid;

          grid-template-columns:
            repeat(4, 1fr);

          gap: 18px;

          margin-bottom: 24px;
        }

        .dashboard-card {
          position: relative;

          overflow: hidden;

          min-height: 145px;

          padding: 23px;

          border-radius: 20px;

          background:
            linear-gradient(
              145deg,
              #ffffff,
              #f1f6ff
            );

          border: 1px solid #dce7f3;

          box-shadow:
            0 9px 25px rgba(31, 74, 118, 0.07);
        }

        .dashboard-card::after {
          content: "";

          position: absolute;

          width: 80px;
          height: 80px;

          border-radius: 50%;

          right: -25px;
          top: -25px;

          background: rgba(37, 99, 235, 0.08);
        }

        .dashboard-card:nth-child(2) {
          background:
            linear-gradient(
              145deg,
              #fff9f5,
              #fff0e9
            );

          border-color: #ffd4c2;
        }

        .dashboard-card:nth-child(2)::after {
          background: rgba(255, 91, 53, 0.10);
        }

        .dashboard-card:nth-child(3) {
          background:
            linear-gradient(
              145deg,
              #f4fff9,
              #e8faf2
            );

          border-color: #c5ead7;
        }

        .dashboard-card:nth-child(3)::after {
          background: rgba(24, 168, 107, 0.10);
        }

        .dashboard-card:nth-child(4) {
          background:
            linear-gradient(
              145deg,
              #faf7ff,
              #f2edff
            );

          border-color: #ded4fa;
        }

        .card-label {
          display: block;

          color: #65809f;

          font-size: 14px;

          font-weight: 800;

          margin-bottom: 12px;
        }

        .dashboard-card strong {
          display: block;

          font-size: 32px;

          color: #082b52;

          font-weight: 900;

          margin-bottom: 6px;
        }

        .dashboard-card small {
          color: #7890a8;

          font-size: 13px;
        }

        .fraud-card strong {
          color: #e04b22;
        }

        .legitimate-card strong {
          color: #13935a;
        }

        .dashboard-grid {
          position: relative;

          z-index: 2;

          display: grid;

          grid-template-columns: 1fr 1fr;

          gap: 22px;

          margin-bottom: 22px;
        }

        .chart-card {
          min-height: 440px;

          padding: 25px;

          background: white;

          border-radius: 22px;

          border: 1px solid #dce7f3;

          box-shadow:
            0 9px 28px rgba(31, 74, 118, 0.06);
        }

        .chart-card h3 {
          margin: 0;

          color: #123b65;

          font-size: 21px;
        }

        .chart-card > p {
          margin: 7px 0 0;

          color: #7a91aa;

          font-size: 14px;
        }

        .chart-container {
          width: 100%;

          height: 330px;

          margin-top: 15px;
        }

        .model-information {
          position: relative;

          z-index: 2;

          display: grid;

          grid-template-columns:
            1.8fr
            1fr
            1fr
            1fr;

          gap: 16px;

          padding: 22px;

          border-radius: 20px;

          background:
            linear-gradient(
              135deg,
              #102a56,
              #174a82
            );

          color: white;

          box-shadow:
            0 12px 30px rgba(16, 42, 86, 0.20);
        }

        .model-information h3 {
          margin: 0 0 7px;

          font-size: 19px;
        }

        .model-information p {
          margin: 0;

          color: #c5d7ed;

          line-height: 1.5;

          font-size: 14px;
        }

        .model-stat {
          display: flex;

          flex-direction: column;

          justify-content: center;

          align-items: center;

          padding: 10px;

          border-left: 1px solid rgba(255,255,255,0.15);
        }

        .model-stat span {
          color: #bcd1e8;

          font-size: 13px;

          margin-bottom: 5px;
        }

        .model-stat strong {
          font-size: 22px;

          color: white;
        }

        /* ====================================================
           RESPONSIVE
        ==================================================== */

        @media (max-width: 1100px) {

          .single-grid {
            grid-template-columns: 1fr;
          }

          .dashboard-cards {
            grid-template-columns: 1fr 1fr;
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .model-information {
            grid-template-columns: 1fr 1fr;
          }

        }

        @media (max-width: 750px) {

          .app {
            padding: 15px;
          }

          .main-header {
            padding: 25px;
          }

          .header-content {
            flex-direction: column;

            align-items: flex-start;
          }

          .main-header h1 {
            font-size: 27px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .dashboard-cards {
            grid-template-columns: 1fr;
          }

          .model-information {
            grid-template-columns: 1fr;
          }

          .model-stat {
            border-left: none;

            border-top: 1px solid rgba(255,255,255,0.15);

            padding-top: 15px;
          }

          .dashboard-section {
            padding: 20px;
          }

          .dashboard-header {
            flex-direction: column;

            align-items: flex-start;
          }

        }

        @media (max-width: 500px) {

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .actions {
            flex-direction: column;
          }

          .button {
            width: 100%;
          }

          .upload-row {
            flex-direction: column;

            align-items: stretch;
          }

          .file-name {
            word-break: break-word;
          }

        }

      `}</style>

      <div className="container">
        {/* ====================================================
            HEADER
        ==================================================== */}

        <header className="main-header">
          <div className="header-content">
            <div className="header-title">
              <div className="header-icon">🛡️</div>

              <div>
                <h1>Digital Payment Fraud Detection</h1>

                <p>
                  Machine-learning based fraud detection using Random Forest.
                </p>
              </div>
            </div>

            <div className="model-badge">🌲 Random Forest</div>
          </div>
        </header>

        {/* ====================================================
            SINGLE TRANSACTION
        ==================================================== */}

        <div className="single-grid">
          <div className="card">
            <h2>Transaction Detection</h2>

            <div className="subtitle">
              Analyze a single digital payment transaction.
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Step</label>

                <input
                  type="number"
                  value={transaction.step}
                  onChange={(e) => updateTransaction("step", e.target.value)}
                />
              </div>

              <div className="field">
                <label>Transaction Type</label>

                <select
                  value={transaction.type}
                  onChange={(e) => updateTransaction("type", e.target.value)}
                >
                  <option value="PAYMENT">PAYMENT</option>

                  <option value="TRANSFER">TRANSFER</option>

                  <option value="CASH_OUT">CASH_OUT</option>

                  <option value="CASH_IN">CASH_IN</option>

                  <option value="DEBIT">DEBIT</option>
                </select>
              </div>

              <div className="field">
                <label>Transaction Amount</label>

                <input
                  type="number"
                  value={transaction.amount}
                  onChange={(e) => updateTransaction("amount", e.target.value)}
                />
              </div>

              <div className="field">
                <label>Old Origin Balance</label>

                <input
                  type="number"
                  value={transaction.oldbalanceOrg}
                  onChange={(e) =>
                    updateTransaction("oldbalanceOrg", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>New Origin Balance</label>

                <input
                  type="number"
                  value={transaction.newbalanceOrig}
                  onChange={(e) =>
                    updateTransaction("newbalanceOrig", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Old Destination Balance</label>

                <input
                  type="number"
                  value={transaction.oldbalanceDest}
                  onChange={(e) =>
                    updateTransaction("oldbalanceDest", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>New Destination Balance</label>

                <input
                  type="number"
                  value={transaction.newbalanceDest}
                  onChange={(e) =>
                    updateTransaction("newbalanceDest", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Flagged Fraud</label>

                <select
                  value={transaction.isFlaggedFraud}
                  onChange={(e) =>
                    updateTransaction("isFlaggedFraud", Number(e.target.value))
                  }
                >
                  <option value={0}>No</option>

                  <option value={1}>Yes</option>
                </select>
              </div>
            </div>

            <div className="actions">
              <button className="button secondary" onClick={resetTransaction}>
                Reset
              </button>

              <button
                className="button primary"
                onClick={detectFraud}
                disabled={predictionLoading}
              >
                {predictionLoading ? "🔄 Analyzing..." : "🔍 Detect Fraud"}
              </button>
            </div>

            {predictionError && <div className="error">{predictionError}</div>}
          </div>

          {/* ==================================================
              RESULT
          ================================================== */}

          <div className="card result-panel">
            {!prediction && !predictionError && (
              <div className="empty-result">
                <div className="empty-result-icon">🔍</div>

                <h3>Detection Result</h3>

                <p>Enter transaction details and click Detect Fraud.</p>
              </div>
            )}

            {prediction && (
              <div
                className={`result-box ${
                  Number(prediction.prediction) === 1 ? "fraud" : "legitimate"
                }`}
              >
                <div className="result-icon">
                  {Number(prediction.prediction) === 1 ? "⚠️" : "✅"}
                </div>

                <div className="result-title">
                  {prediction.result ||
                    (Number(prediction.prediction) === 1
                      ? "FRAUD"
                      : "LEGITIMATE")}
                </div>

                <div className="probability">
                  <div className="probability-label">
                    <span>Fraud Probability</span>

                    <span className="probability-value">
                      {formatPercentage(
                        Number(prediction.fraud_probability || 0) * 100,
                      )}
                    </span>
                  </div>

                  <div className="progress">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${Math.min(
                          Number(prediction.fraud_probability || 0) * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="result-details">
                  <div>
                    <strong>Transaction Type:</strong> {transaction.type}
                  </div>

                  <div>
                    <strong>Amount:</strong> ₹
                    {Number(transaction.amount || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </div>

                  {prediction.risk_level && (
                    <div>
                      <strong>Risk Level:</strong> {prediction.risk_level}
                    </div>
                  )}

                  {prediction.explanation && (
                    <div>{prediction.explanation}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ====================================================
            BATCH ANALYSIS
        ==================================================== */}

        <div className="card batch-card">
          <h2>Large Dataset Analysis</h2>

          <div className="subtitle">
            Upload a CSV file for high-volume fraud detection using chunk
            processing.
          </div>

          <div className="upload-area">
            <div className="upload-row">
              <input
                className="file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
              />

              {selectedFile && (
                <div className="file-name">
                  📄 {selectedFile.name} (
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}

              <button
                className="button primary"
                onClick={startBatchDetection}
                disabled={!selectedFile || batchLoading}
              >
                {batchLoading ? "🔄 Processing..." : "🚀 Start Batch Detection"}
              </button>
            </div>
          </div>

          {batchError && <div className="error">{batchError}</div>}

          {batchResult && (
            <div className="batch-status">
              <div className="status-header">
                <h3>Batch Analysis</h3>

                <span
                  className={`status-badge ${
                    batchResult.status === "completed" ? "completed" : ""
                  }`}
                >
                  {batchResult.status === "completed"
                    ? "✓ Completed"
                    : batchResult.status === "processing"
                      ? "🔄 Processing..."
                      : "⏳ Starting..."}
                </span>
              </div>

              <div className="stats-grid">
                <div className="stat">
                  <div className="stat-label">Total Transactions</div>

                  <div className="stat-value">
                    {formatNumber(batchResult.total_transactions)}
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-label">Fraud Transactions</div>

                  <div className="stat-value fraud-stat">
                    {formatNumber(batchResult.fraud_transactions)}
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-label">Legitimate Transactions</div>

                  <div className="stat-value legitimate-stat">
                    {formatNumber(batchResult.legitimate_transactions)}
                  </div>
                </div>

                <div className="stat">
                  <div className="stat-label">Fraud Rate</div>

                  <div className="stat-value">
                    {formatPercentage(batchResult.fraud_rate_percentage)}
                  </div>
                </div>
              </div>

              <div className="batch-progress">
                <div className="batch-progress-label">
                  <span>Processing Progress</span>

                  <strong>
                    {Number(batchResult.progress_percentage || 0).toFixed(2)}%
                  </strong>
                </div>

                <div className="batch-progress-track">
                  <div
                    className="batch-progress-fill"
                    style={{
                      width: `${Math.min(
                        Number(batchResult.progress_percentage || 0),
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {batchResult.status === "completed" &&
                batchResult.result_file && (
                  <button
                    className="button primary download-button"
                    onClick={downloadResult}
                  >
                    ⬇️ Download Prediction Results
                  </button>
                )}
            </div>
          )}
        </div>

        {/* ====================================================
            COLORFUL DASHBOARD
        ==================================================== */}

        <section className="dashboard-section">
          <div className="dashboard-header">
            <div>
              <h2>Fraud Detection Dashboard</h2>

              <p>
                Overview of transaction analysis and machine-learning
                predictions.
              </p>
            </div>

            <div className="model-badge">🌲 Random Forest</div>
          </div>

          {/* SUMMARY CARDS */}

          <div className="dashboard-cards">
            <div className="dashboard-card">
              <span className="card-label">Total Transactions</span>

              <strong>{formatNumber(dashboardTotal)}</strong>

              <small>Transactions analyzed</small>
            </div>

            <div className="dashboard-card">
              <span className="card-label">Fraud Transactions</span>

              <strong>{formatNumber(dashboardFraud)}</strong>

              <small>Potentially fraudulent</small>
            </div>

            <div className="dashboard-card">
              <span className="card-label">Legitimate Transactions</span>

              <strong>{formatNumber(dashboardLegitimate)}</strong>

              <small>Classified as legitimate</small>
            </div>

            <div className="dashboard-card">
              <span className="card-label">Fraud Rate</span>

              <strong>{Number(dashboardFraudRate).toFixed(4)}%</strong>

              <small>Of analyzed transactions</small>
            </div>
          </div>

          {/* CHARTS */}

          <div className="dashboard-grid">
            {/* PIE */}

            <div className="chart-card">
              <h3>Transaction Distribution</h3>

              <p>Fraud vs legitimate transaction predictions.</p>

              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={115}
                      innerRadius={55}
                      paddingAngle={3}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(1)}%`
                      }
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                      ))}
                    </Pie>

                    <Tooltip />

                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* BAR */}

            <div className="chart-card">
              <h3>Transactions by Type</h3>

              <p>Distribution of analyzed digital payment types.</p>

              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={typeData}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 0,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey="type"
                      tick={{
                        fontSize: 12,
                      }}
                    />

                    <YAxis />

                    <Tooltip />

                    <Bar
                      dataKey="transactions"
                      name="Transactions"
                      fill="#3267e8"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* MODEL INFORMATION */}

          <div className="model-information">
            <div>
              <h3>Machine Learning Model</h3>

              <p>
                Random Forest classifier trained on digital payment transaction
                data.
              </p>
            </div>

            <div className="model-stat">
              <span>ROC-AUC</span>

              <strong>0.998975</strong>
            </div>

            <div className="model-stat">
              <span>PR-AUC</span>

              <strong>0.998138</strong>
            </div>

            <div className="model-stat">
              <span>Fraud Recall</span>

              <strong>99.76%</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
