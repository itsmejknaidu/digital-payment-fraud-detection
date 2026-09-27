import os

import joblib
import pandas as pd


# ==========================================
# FRAUD DETECTION PROJECT
# STEP 10 - MODEL TESTING
# ==========================================

MODEL_PATH = os.path.join(
    "ml",
    "models",
    "fraud_model.joblib"
)

DATA_PATH = os.path.join(
    "data",
    "processed",
    "fraud_processed.csv"
)


def main():

    print("=" * 60)
    print("FRAUD DETECTION - SAVED MODEL TEST")
    print("=" * 60)

    # ------------------------------------------
    # 1. Load trained model
    # ------------------------------------------

    print("\nLoading trained model...")

    model = joblib.load(MODEL_PATH)

    print("Model loaded successfully!")

    # ------------------------------------------
    # 2. Load processed data
    # ------------------------------------------

    print("\nLoading processed dataset...")

    df = pd.read_csv(DATA_PATH)

    print("Dataset loaded successfully!")
    print("Dataset shape:", df.shape)

    # ------------------------------------------
    # 3. Select a small sample
    # ------------------------------------------

    sample = df.sample(
        n=10,
        random_state=42
    )

    X_sample = sample.drop(
        columns=["isFraud"]
    )

    y_actual = sample["isFraud"]

    # ------------------------------------------
    # 4. Predict
    # ------------------------------------------

    predictions = model.predict(
        X_sample
    )

    probabilities = model.predict_proba(
        X_sample
    )[:, 1]

    # ------------------------------------------
    # 5. Display results
    # ------------------------------------------

    print("\n" + "=" * 60)
    print("TRANSACTION PREDICTIONS")
    print("=" * 60)

    for i in range(len(sample)):

        actual = int(y_actual.iloc[i])
        prediction = int(predictions[i])
        probability = probabilities[i]

        if prediction == 1:
            result = "FRAUD"
        else:
            result = "LEGITIMATE"

        print("\nTransaction:", i + 1)
        print("Actual      :", actual)
        print("Prediction  :", result)
        print(
            "Fraud Score : {:.4f}".format(
                probability
            )
        )

    print("\nModel testing completed successfully!")


if __name__ == "__main__":
    main()