import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oakalsshzwmvpxxadlqo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ha2Fsc3NoendtdnB4eGFkbHFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzEwODAsImV4cCI6MjA4NDU0NzA4MH0.g12lnEBqsHrCvMsmb0SG7cWHxKk1Vy10pYYvn6UXYhQ';

export const supabase = createClient(supabaseUrl, supabaseKey);
