from supabase import create_client

url = 'https://rxdfjaseilmjvcwamqyk.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGZqYXNlaWxtanZjd2FtcXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4Mjg3OCwiZXhwIjoyMDg5NTU4ODc4fQ.o-chOlGIh7suwWRsMkW7XQ0mHuvfu3Bq09meCtNFK6A'
supabase = create_client(url, key)

# Check ALL items with image_url (archived or not)
items = supabase.table('items').select('id, name, is_archived, image_url').not_.is_('image_url', 'null').execute()
print(f"Items with image_url: {len(items.data)}")
for i in items.data:
    print(f"  [{i['name'][:45]:45s}] archived={i['is_archived']} -> {i['image_url']}")
