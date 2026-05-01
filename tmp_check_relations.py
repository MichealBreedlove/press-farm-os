from supabase import create_client

url = 'https://rxdfjaseilmjvcwamqyk.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGZqYXNlaWxtanZjd2FtcXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4Mjg3OCwiZXhwIjoyMDg5NTU4ODc4fQ.o-chOlGIh7suwWRsMkW7XQ0mHuvfu3Bq09meCtNFK6A'

supabase = create_client(url, key)

# Check related tables
tables = ['availability_items', 'order_items', 'delivery_items', 'price_history', 'price_catalog', 'plantings']
for table in tables:
    try:
        result = supabase.table(table).select('id', count='exact').limit(1).execute()
        print(f"{table}: {result.count} rows")
    except Exception as e:
        print(f"{table}: ERROR - {e}")
