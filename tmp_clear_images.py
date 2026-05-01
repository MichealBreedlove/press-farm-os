from supabase import create_client

url = 'https://rxdfjaseilmjvcwamqyk.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZGZqYXNlaWxtanZjd2FtcXlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4Mjg3OCwiZXhwIjoyMDg5NTU4ODc4fQ.o-chOlGIh7suwWRsMkW7XQ0mHuvfu3Bq09meCtNFK6A'

supabase = create_client(url, key)

# Clear image_url on archived items that have it set
result = supabase.table('items').update({'image_url': None}).is_('is_archived', True).not_.is_('image_url', 'null').execute()
print(f"Cleared image_url on {len(result.data)} archived items")

# Verify
remaining = supabase.table('items').select('id', count='exact').not_.is_('image_url', 'null').execute()
print(f"Items still with image_url: {remaining.count}")
