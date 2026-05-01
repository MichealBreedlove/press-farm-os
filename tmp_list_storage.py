from supabase import create_client

url = 'https://rxdfjaseilmjvcwamqyk.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGZqYXNlaWxtanZjd2FtcXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4Mjg3OCwiZXhwIjoyMDg5NTU4ODc4fQ.o-chOlGIh7suwWRsMkW7XQ0mHuvfu3Bq09meCtNFK6A'

supabase = create_client(url, key)

# List all buckets
buckets = supabase.storage.list_buckets()
print("Buckets:")
for b in buckets:
    print(f"  {b.name}")
    # List root
    for prefix in ['', 'items/', 'photos/', 'public/']:
        try:
            resp = supabase.storage.from_(b.name).list(path=prefix)
            if resp:
                print(f"    path='{prefix or 'root'}': {len(resp)} items")
                for f in resp[:5]:
                    print(f"      {f.get('name', f.name)}")
        except Exception as e:
            print(f"    path='{prefix}': error")
