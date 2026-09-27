import os
import pandas as pd


# ==========================================
# FRAUD DETECTION PROJECT
# STEP 8 - DATA PREPROCESSING
# ==========================================

INPUT_PATH = os.path.join(
    "data",
    "raw",
    "PS_20174392719_1491204439457_log.csv"
)

OUTPUT_PATH = os.path.join(
    "data",
    "processed",
    "fraud_processed.csv"
)


def main():

    print("=" * 60)
    print("FRAUD DETECTION - DATA PREPROCESSING")
    print("=" * 60)

    print("\nLoading dataset...")

    df = pd.read_csv(INPUT_PATH)

    print(f"Original dataset shape: {df.shape}")

    # ------------------------------------------
    # 1. Remove account identifier columns
    # ------------------------------------------

    columns_to_remove = [
        "nameOrig",
        "nameDest"
    ]

    df = df.drop(columns=columns_to_remove)

    print("\nRemoved identifier columns:")
    print(columns_to_remove)

    # ------------------------------------------
    # 2. Convert transaction type to numbers
    # ------------------------------------------

    df = pd.get_dummies(
        df,
        columns=["type"],
        dtype=int
    )

    # ------------------------------------------
    # 3. Create balance-related features
    # ------------------------------------------

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

    # ------------------------------------------
    # 4. Save processed dataset
    # ------------------------------------------

    os.makedirs(
        os.path.dirname(OUTPUT_PATH),
        exist_ok=True
    )

    df.to_csv(
        OUTPUT_PATH,
        index=False
    )

    print("\nProcessed dataset shape:")
    print(df.shape)

    print("\nProcessed columns:")

    for column in df.columns:
        print("-", column)

    print("\nProcessed dataset saved to:")
    print(OUTPUT_PATH)

    print("\nPreprocessing completed successfully!")


if __name__ == "__main__":
    main()