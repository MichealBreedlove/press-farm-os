from supabase import create_client
from collections import Counter

url = 'https://rxdfjaseilmjvcwamqyk.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGZqYXNlaWxtanZjd2FtcXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4Mjg3OCwiZXhwIjoyMDg5NTU4ODc4fQ.o-chOlGIh7suwWRsMkW7XQ0mHuvfu3Bq09meCtNFK6A'

supabase = create_client(url, key)

farm = supabase.table('farms').select('id').limit(1).execute()
farm_id = farm.data[0]['id']

result = supabase.table('items').select('id', count='exact').eq('farm_id', farm_id).execute()
print(f"Total items: {result.count}")

result_a = supabase.table('items').select('id', count='exact').eq('farm_id', farm_id).is_('is_archived', True).execute()
print(f"Archived: {result_a.count}")

result_u = supabase.table('items').select('id', count='exact').eq('farm_id', farm_id).is_('is_archived', False).execute()
print(f"Active (new imports): {result_u.count}")

# Show active items by category
if result_u.count > 0:
    active = supabase.table('items').select('name, category').eq('farm_id', farm_id).is_('is_archived', False).order('category').execute()
    cats = Counter(i['category'] for i in active.data)
    print(f"\nCategories:")
    for c, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {c}: {n}")
    print(f"\nFirst 10 active items:")
    for i in active.data[:10]:
        print(f"  {i['name']} ({i['category']})")

# Check deliveries intact
di = supabase.table('delivery_items').select('id', count='exact').limit(1).execute()
d = supabase.table('deliveries').select('id', count='exact').limit(1).execute()
print(f"\nDelivery items: {di.count} | Deliveries: {d.count}")
