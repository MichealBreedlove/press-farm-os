from supabase import create_client

url = 'https://rxdfjaseilmjvcwamqyk.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGZqYXNlaWxtanZjd2FtcXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4Mjg3OCwiZXhwIjoyMDg5NTU4ODc4fQ.o-chOlGIh7suwWRsMkW7XQ0mHuvfu3Bq09meCtNFK6A'

supabase = create_client(url, key)

# Check items that have image_url set
items = supabase.table('items').select('id, name, image_url').not_.is_('image_url', 'null').execute()
print(f"Items with image_url set: {len(items.data)}")
for i in items.data[:10]:
    print(f"  {i['name'][:40]:40s} -> {i['image_url'][:60] if i['image_url'] else 'None'}")

# Check archived items too
archived = supabase.table('items').select('id, name, image_url').is_('is_archived', True).not_.is_('image_url', 'null').execute()
print(f"\nArchived items with image_url: {len(archived.data)}")

# Show all unique image URLs
urls = set()
for i in items.data + archived.data:
    if i['image_url']:
        urls.add(i['image_url'])
print(f"\nUnique image URLs: {len(urls)}")
for u in sorted(list(urls))[:10]:
    print(f"  {u}")
