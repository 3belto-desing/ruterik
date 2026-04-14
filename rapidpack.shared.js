// rapidpack.shared.js
const SUPABASE_URL = 'https://trdfieobkewwjhzxwpxc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyZGZpZW9ia2V3d2poenh3cHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4ODYyMTAsImV4cCI6MjA4ODQ2MjIxMH0.aU6dMbELmJRAVmdGVqkHwy60Mth8jaGkeaHVjrGqRZk';

// Inicialización del cliente de Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Ruterik: Conexión con Supabase establecida.");