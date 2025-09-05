# Storage Configuration

This bot supports two storage backends:

## Memory Storage (Default)
- **Configuration**: `STORAGE_TYPE=memory` or no configuration
- **Persistence**: Data is lost when bot restarts
- **Performance**: Fastest for small datasets
- **Use case**: Development, testing, or temporary setups

## SQLite Storage
- **Configuration**: `STORAGE_TYPE=sqlite`
- **Persistence**: Data survives bot restarts
- **Performance**: Excellent for production use
- **Database path**: Set via `DATABASE_PATH` (default: `./data/potluck.db`)

## Switching Storage Types

### To use SQLite:
```bash
# In .env file
STORAGE_TYPE=sqlite
DATABASE_PATH=./data/potluck.db
```

### To use Memory (default):
```bash
# In .env file
STORAGE_TYPE=memory
# or simply omit STORAGE_TYPE
```

## Database Schema

**Potlucks Table:**
- id (TEXT PRIMARY KEY)
- name, date, theme (TEXT)
- created_by, guild_id, channel_id (TEXT)
- message_id (TEXT, nullable)
- message_created_at, created_at (INTEGER timestamps)

**Items Table:**
- id (TEXT PRIMARY KEY) 
- potluck_id (TEXT, foreign key)
- name (TEXT)
- claimed_by (TEXT, JSON array)

## Performance Notes

- SQLite uses WAL mode for better concurrent access
- Prepared statements for optimal query performance
- Indexes on guild_id and channel_id for fast lookups
- Transactions ensure data consistency for complex operations