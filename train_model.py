"""
AEGIS UPI Fraud Detection - Real ML Model Training
Trained on: creditcard.csv (284,807 real transactions, 492 real frauds)
Features: Time, Amount, V1-V28 (PCA behavioral features)
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import StandardScaler
import joblib

print("Loading real transaction dataset...")
df = pd.read_csv('creditcard.csv')
print(f"Dataset: {df.shape[0]:,} transactions | {df['Class'].sum()} frauds ({df['Class'].mean()*100:.2f}%)")

# Features and label
X = df.drop('Class', axis=1)
y = df['Class']

# Scale Amount and Time (V1-V28 are already PCA scaled)
scaler = StandardScaler()
X['Amount'] = scaler.fit_transform(X[['Amount']])
X['Time'] = scaler.fit_transform(X[['Time']])

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
print(f"Training on {len(X_train):,} samples...")

# Train Random Forest
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    class_weight='balanced',  # Handle imbalanced data (492 fraud vs 284k safe)
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
print(f"\nAccuracy: {accuracy_score(y_test, y_pred)*100:.2f}%")
print(classification_report(y_test, y_pred, target_names=['Safe', 'Fraud']))

# Save model and scaler
joblib.dump(model, 'upi_fraud_model.pkl')
joblib.dump(scaler, 'scaler.pkl')

# Save sample transactions for the manual lookup tool
print("\nSaving sample transactions for demo...")
fraud_samples = df[df['Class'] == 1].head(10).copy()
safe_samples = df[df['Class'] == 0].head(20).copy()
samples = pd.concat([fraud_samples, safe_samples])
samples.to_csv('sample_transactions.csv', index=True)
print(f"Saved {len(samples)} sample transactions to sample_transactions.csv")
print("\nModel training complete! Real RF model saved to upi_fraud_model.pkl")
