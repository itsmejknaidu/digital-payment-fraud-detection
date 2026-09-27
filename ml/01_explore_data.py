import os
import pandas as pd


# ==========================================
# FRAUD DETECTION PROJECT
# STEP 6 - DATASET EXPLORATION
# ==========================================

DATA_PATH = os.path.join(
    "data",
    "raw",
    "PS_20174392719_1491204439457_log.csv"
)


def main():
    print("=" * 60)
    print("FRAUD DETECTION - DATASET EXPLORATION")
    print("=" * 60)

    if not os.path.exists(DATA_PATH):
        print("\nDataset not found.")
        print(f"Expected location:\n{DATA_PATH}")
        print("\nPlease place the PaySim CSV file inside:")
        print("data/raw/")
        return

    print("\nLoading dataset...")

    df = pd.read_csv(DATA_PATH)

    print("\nDataset loaded successfully!")

    print("\nDataset shape:")
    print(df.shape)

    print("\nColumns:")
    for column in df.columns:
        print("-", column)

    print("\nFirst 5 rows:")
    print(df.head())

    print("\nData types:")
    print(df.dtypes)

    print("\nMissing values:")
    print(df.isnull().sum())

    print("\nFraud distribution:")
    print(df["isFraud"].value_counts())

    print("\nFraud percentage:")
    print(df["isFraud"].value_counts(normalize=True) * 100)


if __name__ == "__main__":
    main()