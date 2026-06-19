import { supabase } from './supabaseClient';

async function inspect() {
  console.log("Querying Supabase passes table...");
  const { data, error } = await supabase.from('passes').select('*').limit(1);
  if (error) {
    console.error("Supabase error:", error);
    return;
  }
  if (!data || data.length === 0) {
    console.log("No data in passes table. Querying columns via RPC or metadata...");
    // Let's try inserting a dummy pass with wrong columns to see the database error message
    // which list the valid columns!
    const { error: insertError } = await supabase.from('passes').insert({ dummy_column_test: 1 });
    console.log("Insert response:", insertError);
    return;
  }
  console.log("Columns in passes table:", Object.keys(data[0]));
}

inspect();
