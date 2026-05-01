from supabase import create_client
from collections import Counter

url = 'https://rxdfjaseilmjvcwamqyk.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGZqYXNlaWxtanZjd2FtcXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4Mjg3OCwiZXhwIjoyMDg5NTU4ODc4fQ.o-chOlGIh7suwWRsMkW7XQ0mHuvfu3Bq09meCtNFK6A'

supabase = create_client(url, key)

farm = supabase.table('farms').select('id').limit(1).execute()
farm_id = farm.data[0]['id']

items = supabase.table('items').select('id, name, created_at').eq('farm_id', farm_id).order('created_at').execute()

name_counts = Counter(i['name'] for i in items.data)
dupes = {n: c for n, c in name_counts.items() if c > 1}

print(f"Total items: {len(items.data)}, Duplicate groups: {len(dupes)}")

for name, count in sorted(dupes.items()):
    matching = sorted(items.data, key=lambda x: x['created_at'])
    matching = [i for i in matching if i['name'] == name]
    keep = matching[0]  # oldest created
    to_delete = matching[1:]

    for dup in to_delete:
        # Reassign delivery_items references to the kept item
        di = supabase.table('delivery_items').update({'item_id': keep['id']}).eq('item_id', dup['id']).execute()
        print(f"  '{name}': reassigned delivery_items from {dup['id'][:8]} -> {keep['id'][:8]} ({len(di.data)} rows)")

        # Now delete the duplicate
        supabase.table('items').delete().eq('id', dup['id']).execute()
        print(f"    deleted duplicate {dup['id'][:8]}")

print("\nDone deduplicating. Now you can run the UNIQUE constraint.")
