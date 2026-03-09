import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Si alguien entra desde el navegador sin datos, le damos un saludo nítido
    if (req.method !== 'GET' || !req.query.id) {
        return res.status(200).json({ status: "Ruterik API Activa", mensaje: "Esperando señal del chofer..." });
    }

    const { id, lat, lon } = req.query;
    
    const supabase = createClient(
        "https://trdfieobkewwjhzxwpxc.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyZGZpZW9ia2V3d2poenh3cHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4ODYyMTAsImV4cCI6MjA4ODQ2MjIxMH0.aU6dMbELmJRAVmdGVqkHwy60Mth8jaGkeaHVjrGqRZk"
    );

    try {
        const { error } = await supabase.from('rastreo_chofer')
            .update({ 
                lat: parseFloat(lat), 
                lng: parseFloat(lon), 
                actualizado_en: new Date() 
            })
            .eq('id', id);

        if (error) throw error;
        res.status(200).send("ok");
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
