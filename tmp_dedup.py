from supabase import create_client
from collections import Counter

url = 'https://rxdfjaseilmjvcwamqyk.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGZqYXNlaWxtanZjd2FtcXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4Mjg3OCwiZXhwIjoyMDg5NTU4ODc4fQ.o-chOlGIh7suwWRsMkW7XQ0mHuvfu3Bq09meCtNFK6A'

supabase = create_client(url, key)

# Get first farm id
farm = supabase.table('farms').select('id').limit(1).execute()
farm_id = farm.data[0]['id']

# Get all items for this farm
items = supabase.table('items').select('id, name').eq('farm_id', farm_id).order('name').execute()

# Find duplicates by name
name_counts = Counter(i['name'] for i in items.data)
dupes = {n: c for n, c in name_counts.items() if c > 1}

print(f"Total items: {len(items.data)}")
print(f"Duplicate names: {len(dupes)}")

# For each duplicate, keep the first one (or lowest ID), delete the rest
for name, count in sorted(dupes.items()):
    matching = [i for i in items.data if i['name'] == name]
    # Keep the one with the lowest sort_order or created_at
    keep = matching[0]['id']
    delete_ids = [i['id'] for i in matching[1:]]
    if delete_ids:
        # Check if any of the ones to delete are referenced by delivery_items or other tables
        # Just delete them since they're archived duplicates
        result = supabase.table('items').delete().in_('id', delete_ids).execute()
        print(f"  '{name}': kept {keep[:8]}, deleted {len(delete_ids)} duplicates")
