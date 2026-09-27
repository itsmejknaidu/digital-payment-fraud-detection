from pathlib import Path

import pandas as pd


# ==========================================================
# FRAUD DETECTION - STRESS TEST DATA GENERATOR
# ==========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

RAW_DATA = (
    BASE_DIR
    / "data"
    / "raw"
    / "PS_20174392719_1491204439457_log.csv"
)

OUTPUT_DIR = (
    BASE_DIR
    / "data"
    / "stress_test"
)

OUTPUT_FILE = (
    OUTPUT_DIR
    / "transactions_100k.csv"
)


# ==========================================================
# SETTINGS
# ==========================================================

TOTAL_ROWS = 100_000

LEGITIMATE_ROWS = 95_000
FRAUD_ROWS = 5_000

CHUNK_SIZE = 250_000

RANDOM_STATE = 42


# ==========================================================
# COLUMNS REQUIRED BY BATCH PREDICTION
# ==========================================================

REQUIRED_COLUMNS = [
    "step",
    "type",
    "amount",
    "oldbalanceOrg",
    "newbalanceOrig",
    "oldbalanceDest",
    "newbalanceDest",
    "isFlaggedFraud",
    "isFraud",
]


# ==========================================================
# MAIN
# ==========================================================

def main():

    print("=" * 60)
    print("FRAUD DETECTION - STRESS TEST DATA GENERATOR")
    print("=" * 60)

    print()
    print("Checking original dataset...")

    if not RAW_DATA.exists():
        print()
        print("ERROR: Original dataset was not found.")
        print()
        print("Expected file:")
        print(RAW_DATA)
        print()
        print("Make sure the CSV is inside:")
        print("data\\raw")
        return

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    print("Original dataset found!")
    print()

    print("Generating stress-test dataset...")
    print()
    print(f"Total transactions : {TOTAL_ROWS:,}")
    print(f"Legitimate         : {LEGITIMATE_ROWS:,}")
    print(f"Fraud              : {FRAUD_ROWS:,}")
    print()

    # ------------------------------------------------------
    # Containers
    # ------------------------------------------------------

    legitimate_parts = []
    fraud_parts = []

    legitimate_count = 0
    fraud_count = 0

    # ------------------------------------------------------
    # Read original dataset in chunks
    # ------------------------------------------------------

    print("Reading original dataset in chunks...")
    print("This may take a few minutes.")
    print()

    for chunk_number, chunk in enumerate(
        pd.read_csv(
            RAW_DATA,
            usecols=REQUIRED_COLUMNS,
            chunksize=CHUNK_SIZE
        ),
        start=1
    ):

        print(
            f"Processing dataset chunk {chunk_number}..."
        )

        # ----------------------------------------------
        # Separate legitimate and fraud transactions
        # ----------------------------------------------

        if legitimate_count < LEGITIMATE_ROWS:

            legitimate_needed = (
                LEGITIMATE_ROWS
                - legitimate_count
            )

            legitimate_chunk = chunk[
                chunk["isFraud"] == 0
            ]

            if len(legitimate_chunk) > legitimate_needed:
                legitimate_chunk = legitimate_chunk.sample(
                    n=legitimate_needed,
                    random_state=RANDOM_STATE
                )

            if len(legitimate_chunk) > 0:

                legitimate_parts.append(
                    legitimate_chunk
                )

                legitimate_count += len(
                    legitimate_chunk
                )

        # ----------------------------------------------
        # Fraud transactions
        # ----------------------------------------------

        if fraud_count < FRAUD_ROWS:

            fraud_needed = (
                FRAUD_ROWS
                - fraud_count
            )

            fraud_chunk = chunk[
                chunk["isFraud"] == 1
            ]

            if len(fraud_chunk) > fraud_needed:
                fraud_chunk = fraud_chunk.sample(
                    n=fraud_needed,
                    random_state=RANDOM_STATE
                )

            if len(fraud_chunk) > 0:

                fraud_parts.append(
                    fraud_chunk
                )

                fraud_count += len(
                    fraud_chunk
                )

        # ----------------------------------------------
        # Stop once enough rows are collected
        # ----------------------------------------------

        if (
            legitimate_count >= LEGITIMATE_ROWS
            and fraud_count >= FRAUD_ROWS
        ):
            break

    # ======================================================
    # Verify enough transactions were found
    # ======================================================

    if legitimate_count < LEGITIMATE_ROWS:

        print()
        print("ERROR:")
        print(
            f"Only {legitimate_count:,} legitimate "
            "transactions were found."
        )
        return

    if fraud_count < FRAUD_ROWS:

        print()
        print("ERROR:")
        print(
            f"Only {fraud_count:,} fraud "
            "transactions were found."
        )
        return

    # ======================================================
    # Combine data
    # ======================================================

    legitimate_df = pd.concat(
        legitimate_parts,
        ignore_index=True
    )

    fraud_df = pd.concat(
        fraud_parts,
        ignore_index=True
    )

    # ------------------------------------------------------
    # Remove actual target column
    # ------------------------------------------------------

    legitimate_df = legitimate_df.drop(
        columns=["isFraud"]
    )

    fraud_df = fraud_df.drop(
        columns=["isFraud"]
    )

    # ======================================================
    # Combine legitimate + fraud
    # ======================================================

    stress_df = pd.concat(
        [
            legitimate_df,
            fraud_df
        ],
        ignore_index=True
    )

    # ======================================================
    # Shuffle transactions
    # ======================================================

    stress_df = stress_df.sample(
        frac=1,
        random_state=RANDOM_STATE
    ).reset_index(drop=True)

    # ======================================================
    # Save CSV
    # ======================================================

    stress_df.to_csv(
        OUTPUT_FILE,
        index=False
    )

    # ======================================================
    # Final information
    # ======================================================

    print()
    print("=" * 60)
    print("STRESS TEST FILE CREATED SUCCESSFULLY!")
    print("=" * 60)

    print()
    print(f"Rows    : {len(stress_df):,}")
    print(f"Columns : {len(stress_df.columns)}")

    print()
    print("Expected distribution:")
    print(
        f"Legitimate : {LEGITIMATE_ROWS:,}"
    )
    print(
        f"Fraud      : {FRAUD_ROWS:,}"
    )

    print()
    print("Fraud percentage in stress-test dataset:")
    print(
        f"{(FRAUD_ROWS / TOTAL_ROWS) * 100:.2f}%"
    )

    print()
    print("File:")
    print(OUTPUT_FILE)

    print()
    print("Columns:")

    for column in stress_df.columns:
        print(f"- {column}")

    print()
    print("=" * 60)


if __name__ == "__main__":
    main()