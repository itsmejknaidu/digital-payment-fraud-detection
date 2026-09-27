import os

import joblib
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    average_precision_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split


# ==========================================
# FRAUD DETECTION PROJECT
# STEP 9 - MODEL TRAINING
# ==========================================

INPUT_PATH = os.path.join(
    "data",
    "processed",
    "fraud_processed.csv"
)

MODEL_DIR = "ml/models"

MODEL_PATH = os.path.join(
    MODEL_DIR,
    "fraud_model.joblib"
)


def main():

    print("=" * 60)
    print("FRAUD DETECTION - MODEL TRAINING")
    print("=" * 60)

    # ------------------------------------------
    # 1. Load processed dataset
    # ------------------------------------------

    print("\nLoading processed dataset...")

    df = pd.read_csv(INPUT_PATH)

    print("Dataset shape:", df.shape)

    # ------------------------------------------
    # 2. Separate features and target
    # ------------------------------------------

    X = df.drop(columns=["isFraud"])
    y = df["isFraud"]

    print("\nFeature shape:", X.shape)
    print("Target shape:", y.shape)

    print("\nFraud distribution:")
    print(y.value_counts())

    # ------------------------------------------
    # 3. Train-test split
    # ------------------------------------------

    print("\nSplitting dataset...")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y
    )

    print("Training rows:", len(X_train))
    print("Testing rows:", len(X_test))

    # ------------------------------------------
    # 4. Create Random Forest model
    # ------------------------------------------

    print("\nCreating Random Forest model...")

    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=20,
        min_samples_leaf=2,
        class_weight="balanced",
        n_jobs=-1,
        random_state=42
    )

    # ------------------------------------------
    # 5. Train model
    # ------------------------------------------

    print("\nTraining model...")
    print("This may take several minutes.")

    model.fit(X_train, y_train)

    print("\nModel training completed!")

    # ------------------------------------------
    # 6. Predictions
    # ------------------------------------------

    print("\nGenerating predictions...")

    y_pred = model.predict(X_test)

    y_probability = model.predict_proba(X_test)[:, 1]

    # ------------------------------------------
    # 7. Evaluation
    # ------------------------------------------

    print("\n" + "=" * 60)
    print("MODEL EVALUATION")
    print("=" * 60)

    print("\nClassification Report:")
    print(
        classification_report(
            y_test,
            y_pred,
            digits=4
        )
    )

    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    print("\nROC-AUC:")
    print(
        roc_auc_score(
            y_test,
            y_probability
        )
    )

    print("\nPR-AUC:")
    print(
        average_precision_score(
            y_test,
            y_probability
        )
    )

    # ------------------------------------------
    # 8. Save model
    # ------------------------------------------

    os.makedirs(
        MODEL_DIR,
        exist_ok=True
    )

    joblib.dump(
        model,
        MODEL_PATH
    )

    print("\nModel saved successfully!")

    print("Model location:")
    print(MODEL_PATH)


if __name__ == "__main__":
    main()