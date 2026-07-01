-- Function to purge a soft-deleted (or any) auth user by email.
-- Called from admin-manage-users when re-creating a previously deleted account.
-- SECURITY DEFINER runs as the function owner (postgres) which has access to auth schema.
CREATE OR REPLACE FUNCTION purge_auth_user_by_email(target_email text)
RETURNS void AS $$
BEGIN
  DELETE FROM auth.users WHERE email = target_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only service_role should be able to call this
REVOKE ALL ON FUNCTION purge_auth_user_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_auth_user_by_email(text) FROM authenticated;
REVOKE ALL ON FUNCTION purge_auth_user_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION purge_auth_user_by_email(text) TO service_role;
