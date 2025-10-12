# Core314 Scripts

## Migration Runner

### Programmatic Migration Execution

The `run-migration-programmatic.js` script allows you to execute Supabase migrations programmatically without manual intervention in the Supabase dashboard.

#### Prerequisites

You need the Supabase Service Role Key, which can be found in:
- Supabase Dashboard → Settings → API → service_role key (secret)

#### Usage

```bash
# Set the service role key as an environment variable
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Run the migration
npm run migrate

# Or run directly with the key inline
SUPABASE_SERVICE_ROLE_KEY="your-key" node scripts/run-migration-programmatic.js
```

#### What It Does

1. Checks if migration tables already exist
2. Reads the migration SQL file (004_fusion_scoring.sql)
3. Attempts to execute the SQL via multiple methods:
   - Direct PostgREST RPC endpoint
   - Custom SQL executor function
4. Verifies that tables are accessible
5. Triggers schema cache refresh
6. Provides manual instructions if automated execution fails

#### Future Migrations

To add new migrations:
1. Create a new SQL file in `supabase/migrations/`
2. Update the script to reference the new migration file
3. Run the migration using the same command

#### Troubleshooting

If the automated migration fails:
1. The script will provide manual instructions
2. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/ygvkegcstaowikessigx/sql/new
3. Copy the contents of the migration file
4. Paste and click "Run"
5. Execute: `NOTIFY pgrst, 'reload schema';`
6. Wait 30-60 seconds for schema cache to refresh

#### Security Note

⚠️ **NEVER commit the service role key to the repository!**

The service role key should:
- Be stored in environment variables
- Be passed at runtime
- Never be hardcoded in scripts or config files
