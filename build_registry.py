import pandas as pd
import hashlib

df = pd.read_csv('creditcard.csv')

def make_txn_id(row):
    raw = str(row.name) + str(row['Amount']) + str(row['Time'])
    return 'TXN' + hashlib.md5(raw.encode()).hexdigest()[:10].upper()

print('Building transaction ID registry...')
df['txn_id'] = df.apply(make_txn_id, axis=1)

fraud = df[df['Class'] == 1].copy()
safe = df[df['Class'] == 0].sample(n=len(fraud), random_state=42).copy()
registry = pd.concat([fraud, safe])
registry.to_csv('txn_registry.csv', index=True)
print(f'Registry: {len(fraud)} fraud + {len(safe)} safe = {len(registry)} total')

print('\n=== REAL FRAUD TRANSACTION IDs ===')
print(fraud[['txn_id', 'Amount', 'Class']].head(10).to_string())
print('\n=== REAL SAFE TRANSACTION IDs ===')
print(safe[['txn_id', 'Amount', 'Class']].head(10).to_string())
