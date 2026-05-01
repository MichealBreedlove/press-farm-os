from supabase import create_client

url = 'https://rxdfjaseilmjvcwamqyk.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGZqYXNlaWxtanZjd2FtcXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4Mjg3OCwiZXhwIjoyMDg5NTU4ODc4fQ.o-chOlGIh7suwWRsMkW7XQ0mHuvfu3Bq09meCtNFK6A'

supabase = create_client(url, key)

result = supabase.table('items').select('id', count='exact').execute()
print(f"Total items: {result.count}")

result_a = supabase.table('items').select('id', count='exact').is_('is_archived', True).execute()
print(f"Archived: {result_a.count}")

result_u = supabase.table('items').select('id', count='exact').is_('is_archived', False).execute()
print(f"Active (non-archived): {result_u.count}")

# Check for duplicates
items = supabase.table('items').select('name').is_('is_archived', False).execute()
names = [i['name'] for i in items.data]
from collections import Counter
dupes = {n: c for n, c in Counter(names).items() if c > 1}
if dupes:
    print(f"\nDuplicate active names found: {len(dupes)}")
    for name, count in list(dupes.items())[:20]:
        print(f"  '{name}' appears {count} times")
else:
    print("\nNo duplicate active names")

# Check for names without [ARCHIVED] that might be from failed import
non_archived = [i['name'] for i in items.data if not i['name'].startswith('[ARCHIVED]')]
print(f"\nActive items without [ARCHIVED] prefix: {len(non_archived)}")
